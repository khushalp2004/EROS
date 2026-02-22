from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.unit import Unit
from models.emergency import Emergency
from models.location import RouteCalculation
from models.user import User
from models.emergency_reporter_contact import EmergencyReporterContact
from models import db
from datetime import datetime
from config import OSRM_BASE_URL
from routes.notification_routes import create_emergency_notification, create_unit_notification
from events import socketio
from services.sms_service import SMSService
import requests
import math
import json
import polyline
import functools
import os
from itsdangerous import URLSafeTimedSerializer
from config import SECRET_KEY

# Max allowed route distance (50 km) for approval/dispatch
MAX_DISTANCE_METERS = 50_000
TRACKING_TOKEN_SALT = "public-emergency-tracking-v1"


def _build_tracking_token(request_id):
    serializer = URLSafeTimedSerializer(SECRET_KEY, salt=TRACKING_TOKEN_SALT)
    return serializer.dumps({"request_id": int(request_id)})


def _normalized_frontend_base_url():
    base = (os.getenv('FRONTEND_BASE_URL') or '').strip() or 'http://127.0.0.1:3000'
    if base.startswith('https://localhost') or base.startswith('https://127.0.0.1'):
        base = base.replace('https://', 'http://', 1)
    if 'localhost' in base:
        base = base.replace('localhost', '127.0.0.1')
    return base.rstrip('/')


def _resolve_unit_driver(unit_id):
    candidates = User.query.filter_by(role='unit').all()
    for user in candidates:
        org = (user.organization or "").strip()
        if not org:
            continue
        normalized = org
        if normalized.upper().startswith("UNIT_ID:"):
            normalized = normalized.split(":", 1)[1].strip()
        if normalized.isdigit() and int(normalized) == int(unit_id):
            full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip() or user.email
            return {"name": full_name, "phone": user.phone}
    return None

def authority_required():
    """
    Decorator to check if current user has authority or admin role
    """
    def decorator(f):
        @jwt_required()
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            current_user = User.query.get(current_user_id)
            
            if not current_user:
                return jsonify({
                    'success': False,
                    'message': 'User not found',
                    'error': 'USER_NOT_FOUND'
                }), 401
            
            # Check if user has authority or admin role
            if current_user.role not in ['authority', 'admin']:
                return jsonify({
                    'success': False,
                    'message': 'Authority access required',
                    'error': 'AUTHORITY_REQUIRED'
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def haversine_m(lat1, lon1, lat2, lon2):
    """
    Great-circle distance between two lat/lon pairs in meters.
    """
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# -------------------------
# Helper: Phase 1 - Fetch full OSRM route with 245 waypoints
# -------------------------
def fetch_full_osrm_route(src_lat, src_lon, dst_lat, dst_lon, timeout=5):
    """
    Fetches complete OSRM route with full geometry and waypoints.
    Returns (distance, duration, route_geometry, waypoints, polyline_positions)
    """
    url = f"{OSRM_BASE_URL}/route/v1/driving/{src_lon},{src_lat};{dst_lon},{dst_lat}"
    params = {
        "overview": "full",           # Get complete route geometry
        "geometries": "polyline",     # Return polyline encoded geometry
        "steps": "false",             # No turn-by-turn steps
        "annotations": "false"        # No additional annotations
    }
    
    try:
        resp = requests.get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        
        routes = data.get("routes") or []
        if not routes:
            raise ValueError("No route from OSRM")
            
        route = routes[0]
        geometry = route.get("geometry", "")
        distance = route.get("distance")
        duration = route.get("duration")
        
        # Decode polyline to get waypoints
        if geometry:
            waypoints = polyline.decode(geometry)
            # Limit to 245 waypoints maximum
            if len(waypoints) > 245:
                # Sample waypoints to get exactly 245 points
                step = len(waypoints) / 245
                waypoints = [waypoints[int(i * step)] for i in range(245)]
            
            # Convert to [lat, lng] format for JSON storage
            waypoints_json = json.dumps([[lat, lng] for lat, lng in waypoints])
            
            # Prepare polyline positions for frontend
            polyline_positions = json.dumps(waypoints)
            
            return distance, duration, geometry, waypoints_json, polyline_positions, len(waypoints)
        else:
            raise ValueError("No geometry in OSRM response")
            
    except Exception as e:
        print(f"Error fetching full OSRM route: {e}")
        return None, None, None, None, None, 0

authority_bp = Blueprint("authority_bp", __name__)

# -------------------------
# Helper: Fallback Euclidean distance (only used if OSRM is unavailable)
# -------------------------
def distance(lat1, lon1, lat2, lon2):
    # Backward-compat shim: now uses haversine meters
    return haversine_m(lat1, lon1, lat2, lon2)

# -------------------------
# Helper: OSRM route distance/duration (driving)
# -------------------------
def osrm_route_distance_duration(src_lat, src_lon, dst_lat, dst_lon, timeout=3):
    """
    Calls OSRM (or your routing host) to get the driving route.
    Returns (distance_meters, duration_seconds).
    Raises on failure so caller can decide fallback/skip.
    """
    url = f"{OSRM_BASE_URL}/route/v1/driving/{src_lon},{src_lat};{dst_lon},{dst_lat}"
    params = {"overview": "false", "alternatives": "false"}
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    routes = data.get("routes") or []
    if not routes:
        raise ValueError("No route from OSRM")
    route = routes[0]
    return route.get("distance"), route.get("duration")

# -------------------------
# Add Unit (for 50% work)
# -------------------------
@authority_bp.route("/authority/add-unit", methods=["POST"])
@authority_required()
def add_unit():
    data = request.json
    if not all(k in data for k in ("service_type", "latitude", "longitude")):
        return jsonify({"error": "Missing fields"}), 400

    unit = Unit(
        service_type=data["service_type"],
        status="AVAILABLE",
        latitude=data["latitude"],
        longitude=data["longitude"]
    )

    db.session.add(unit)
    db.session.commit()

    return jsonify({"message": "Unit added", "unit_id": unit.unit_id})

# -------------------------
# Dispatch emergency (nearest available unit)
# -------------------------
@authority_bp.route("/authority/dispatch/<int:emergency_id>", methods=["POST"])
@authority_required()
def dispatch_emergency(emergency_id):
    emergency = Emergency.query.get(emergency_id)

    if not emergency:
        return jsonify({"error": "Emergency not found"}), 404

    if emergency.status != "PENDING" and emergency.status != "APPROVED":
        return jsonify({"error": f"Emergency already {emergency.status}"}), 400

    # Get available units of same service type
    # Note: emergency.emergency_type should now be in uppercase format
    units = Unit.query.filter_by(
        service_type=emergency.emergency_type,
        status="AVAILABLE"
    ).all()
    
    print(f"🚨 Dispatch attempt for Emergency #{emergency.request_id} (Type: {emergency.emergency_type}) - Found {len(units)} available units")

    if not units:
        return jsonify({"error": "No available units"}), 404

    # Find best unit by OSRM distance (fallback to haversine if OSRM fails for all)
    best = None
    nearest_raw_distance = None  # track closest even if over cap
    for u in units:
        try:
            dist, dur = osrm_route_distance_duration(
                emergency.latitude,
                emergency.longitude,
                u.latitude,
                u.longitude,
            )
            if dist is None:
                raise ValueError("OSRM distance missing")
            candidate = {"unit": u, "distance": dist, "duration": dur}
        except Exception:
            # OSRM failed for this candidate, try Euclidean as a backup
            euclid = distance(
                emergency.latitude,
                emergency.longitude,
                u.latitude,
                u.longitude,
            )
            candidate = {"unit": u, "distance": euclid, "duration": None}

        # Track nearest distance regardless of cap for error reporting
        if candidate["distance"] is not None:
            if nearest_raw_distance is None or candidate["distance"] < nearest_raw_distance:
                nearest_raw_distance = candidate["distance"]

        # Enforce 50 km cap; skip units beyond this distance
        if candidate["distance"] is None or candidate["distance"] > MAX_DISTANCE_METERS:
            continue

        if best is None or candidate["distance"] < best["distance"]:
            best = candidate

    if best is None:
        return jsonify({
            "error": "No available units within 50 km",
            "nearest_distance_m": nearest_raw_distance
        }), 400

    nearest_unit = best["unit"]

    # Phase 1: Fetch full OSRM route with cached waypoints
    try:
        full_distance, full_duration, route_geometry, waypoints_json, polyline_positions, waypoint_count = fetch_full_osrm_route(
            nearest_unit.latitude,
            nearest_unit.longitude,
            emergency.latitude,
            emergency.longitude
        )
        
        if full_distance is None:
            print(f"⚠️ Failed to fetch full route for Emergency #{emergency.request_id}, using basic dispatch")
            # Fallback to basic dispatch without route caching
            full_distance = best["distance"]
            full_duration = best["duration"]
            waypoints_json = None
            polyline_positions = None
            waypoint_count = 0
    except Exception as e:
        print(f"⚠️ Route fetching error: {e}, using basic dispatch")
        full_distance = best["distance"]
        full_duration = best["duration"]
        waypoints_json = None
        polyline_positions = None
        waypoint_count = 0

    # 🔧 CRITICAL: Ensure fresh route progress for new emergency dispatch
    # Clear any existing route calculations for this unit (from previous emergencies)
    RouteCalculation.deactivate_routes_for_unit(nearest_unit.unit_id)
    
    # Update statuses
    nearest_unit.status = "DISPATCHED"
    nearest_unit.last_updated = datetime.utcnow()

    emergency.status = "ASSIGNED"
    emergency.assigned_unit = nearest_unit.unit_id
    emergency.approved_by = "Central Authority"

    # Store route calculation with cached waypoints (Phase 1)
    route_calc = RouteCalculation(
        unit_id=nearest_unit.unit_id,
        emergency_id=emergency.request_id,
        osrm_response=json.dumps({
            "full_route_distance": full_distance,
            "full_route_duration": full_duration,
            "original_distance": best["distance"],
            "original_duration": best["duration"]
        }),
        route_geometry=route_geometry,
        distance=full_distance,
        duration=full_duration,
        profile='driving',
        cached_waypoints=waypoints_json,
        polyline_positions=polyline_positions,
        waypoint_count=waypoint_count,
        start_latitude=nearest_unit.latitude,
        start_longitude=nearest_unit.longitude,
        end_latitude=emergency.latitude,
        end_longitude=emergency.longitude,
        is_active=True
    )
    
    db.session.add(route_calc)
    db.session.commit()

    # Reporter SMS: send tracking link only after assignment
    sms_sent = False
    sms_message = "No reporter phone for this emergency"
    reporter_contact = EmergencyReporterContact.query.filter_by(emergency_id=emergency.request_id).first()
    if reporter_contact and reporter_contact.reporter_phone:
        tracking_token = _build_tracking_token(emergency.request_id)
        tracking_url = f"{_normalized_frontend_base_url()}/track/{tracking_token}"
        driver = _resolve_unit_driver(nearest_unit.unit_id)
        sms_service = SMSService()
        sms_sent, sms_message = sms_service.send_assigned_tracking_message(
            to_phone=reporter_contact.reporter_phone,
            request_id=emergency.request_id,
            tracking_url=tracking_url,
            unit_plate=nearest_unit.unit_vehicle_number,
            driver_name=driver.get("name") if driver else None,
            driver_phone=driver.get("phone") if driver else None
        )

    # Send notifications
    create_emergency_notification(emergency, 'assigned')
    create_unit_notification(nearest_unit, 'dispatched', emergency=emergency)

    # Emit real-time events for emergency dispatch
    emergency_data = {
        'request_id': emergency.request_id,
        'emergency_type': emergency.emergency_type,
        'latitude': emergency.latitude,
        'longitude': emergency.longitude,
        'status': emergency.status,
        'approved_by': emergency.approved_by,
        'assigned_unit': emergency.assigned_unit,
        'created_at': emergency.created_at.isoformat() if emergency.created_at else None,
        # Phase 1: Include cached route positions for polyline
        'route_positions': json.loads(polyline_positions) if polyline_positions else None,
        'waypoint_count': waypoint_count,
        'route_calculation_id': route_calc.id
    }
    
    unit_data = {
        'unit_id': nearest_unit.unit_id,
        'service_type': nearest_unit.service_type,
        'status': nearest_unit.status,
        'latitude': nearest_unit.latitude,
        'longitude': nearest_unit.longitude,
        'emergency_id': emergency.request_id
    }
    
    # Broadcast emergency update to all clients
    socketio.emit('emergency_updated', {
        'action': 'assigned',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_info': {
            'positions': emergency_data['route_positions'],
            'waypoint_count': waypoint_count,
            'distance': full_distance,
            'duration': full_duration
        },
        'route_progress_reset': {
            'unit_id': nearest_unit.unit_id,
            'emergency_id': emergency.request_id,
            'reset_reason': 'new_emergency_dispatch',
            'fresh_start': True,
            'timestamp': datetime.utcnow().isoformat()
        }
    })
    
    # Broadcast to unit tracking room
    socketio.emit('emergency_update', {
        'action': 'assigned',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_info': {
            'positions': emergency_data['route_positions'],
            'waypoint_count': waypoint_count,
            'distance': full_distance,
            'duration': full_duration
        },
        'route_progress_reset': {
            'unit_id': nearest_unit.unit_id,
            'emergency_id': emergency.request_id,
            'reset_reason': 'new_emergency_dispatch',
            'fresh_start': True,
            'timestamp': datetime.utcnow().isoformat()
        }
    }, room='unit_tracking')
    
    # Update unit status
    socketio.emit('unit_status_update', {
        'unit_id': nearest_unit.unit_id,
        'status': 'DISPATCHED',
        'emergency_id': emergency.request_id,
        'assigned_emergency': emergency_data,
        'route_info': {
            'positions': emergency_data['route_positions'],
            'waypoint_count': waypoint_count
        },
        'route_progress_reset': {
            'unit_id': nearest_unit.unit_id,
            'emergency_id': emergency.request_id,
            'reset_reason': 'new_emergency_dispatch',
            'fresh_start': True,
            'timestamp': datetime.utcnow().isoformat()
        }
    })
    
    print(f"🔄 Fresh dispatch: Emergency #{emergency.request_id} dispatched to Unit {nearest_unit.unit_id} with {waypoint_count} cached waypoints - route progress reset to 0%")

    return jsonify({
        "message": "Emergency dispatched successfully",
        "emergency_id": emergency.request_id,
        "assigned_unit_id": nearest_unit.unit_id,
        "distance_m": full_distance,
        "eta_s": full_duration,
        "waypoint_count": waypoint_count,
        "route_positions": emergency_data['route_positions'],
        "route_calculation_id": route_calc.id,
        "routing_source": "osrm_full_geometry" if waypoint_count > 0 else "euclidean_fallback",
        "reporter_sms_sent": sms_sent,
        "reporter_sms_message": sms_message
    })

# -------------------------
# Complete emergency (release unit)
# -------------------------
@authority_bp.route("/authority/complete/<int:emergency_id>", methods=["POST"])
@authority_required()
def complete_emergency(emergency_id):
    emergency = Emergency.query.get(emergency_id)
    if not emergency:
        return jsonify({"error": "Emergency not found"}), 404
    if emergency.status != "ASSIGNED":
        return jsonify({"error": "Emergency not assigned yet"}), 400

    # Release unit
    unit = Unit.query.get(emergency.assigned_unit)
    if unit:
        unit.status = "AVAILABLE"
        unit.last_updated = datetime.utcnow()

    emergency.status = "COMPLETED"
    db.session.commit()

    # Send notifications
    create_emergency_notification(emergency, 'completed')
    create_unit_notification(unit, 'completed', emergency=emergency)

    # Clean up route calculations for this emergency using the new model method
    routes_cleared = RouteCalculation.deactivate_routes_for_emergency(emergency.request_id)
    
    # Emit real-time events for emergency completion
    emergency_data = {
        'request_id': emergency.request_id,
        'emergency_type': emergency.emergency_type,
        'latitude': emergency.latitude,
        'longitude': emergency.longitude,
        'status': emergency.status,
        'approved_by': emergency.approved_by,
        'assigned_unit': emergency.assigned_unit,
        'created_at': emergency.created_at.isoformat() if emergency.created_at else None,
        'completed_at': datetime.utcnow().isoformat()
    }
    
    unit_data = {
        'unit_id': unit.unit_id,
        'service_type': unit.service_type,
        'status': unit.status,
        'latitude': unit.latitude,
        'longitude': unit.longitude
    }
    
    # Broadcast emergency completion to all clients
    socketio.emit('emergency_updated', {
        'action': 'completed',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_reset_info': {
            'emergency_id': emergency.request_id,
            'unit_id': unit.unit_id,
            'routes_cleared': routes_cleared,
            'reset_timestamp': datetime.utcnow().isoformat()
        }
    })
    
    # Broadcast to unit tracking room
    socketio.emit('emergency_update', {
        'action': 'completed',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_reset_info': {
            'emergency_id': emergency.request_id,
            'unit_id': unit.unit_id,
            'routes_cleared': routes_cleared,
            'reset_timestamp': datetime.utcnow().isoformat()
        }
    }, room='unit_tracking')
    
    # Update unit status back to available
    socketio.emit('unit_status_update', {
        'unit_id': unit.unit_id,
        'status': 'AVAILABLE',
        'emergency_id': emergency.request_id,
        'completed_emergency': emergency_data,
        'route_reset_info': {
            'emergency_id': emergency.request_id,
            'unit_id': unit.unit_id,
            'routes_cleared': routes_cleared,
            'reset_timestamp': datetime.utcnow().isoformat()
        }
    })
    
    # Send specific route progress reset event
    socketio.emit('route_progress_reset', {
        'unit_id': unit.unit_id,
        'emergency_id': emergency.request_id,
        'reset_reason': 'emergency_completed',
        'routes_cleared': routes_cleared,
        'timestamp': datetime.utcnow().isoformat(),
        'ready_for_new_assignment': True
    }, room='unit_tracking')
    
    print(f"🔄 Route progress reset: Emergency #{emergency.request_id} completed, Unit {unit.unit_id} cleared {routes_cleared} route calculations")

    return jsonify({
        "message": f"Emergency {emergency.request_id} completed and unit {unit.unit_id} is now available"
    })

# -------------------------
# Get all units (dashboard view)
# -------------------------
@authority_bp.route("/authority/units", methods=["GET"])
@authority_required()
def get_units():
    page_arg = request.args.get("page")
    per_page_arg = request.args.get("per_page")

    # Backward compatibility: return full array when pagination is not requested.
    if page_arg is None and per_page_arg is None:
        units = Unit.query.all()
        data = []
        for u in units:
            data.append({
                "unit_id": u.unit_id,
                "unit_vehicle_number": u.unit_vehicle_number,
                "service_type": u.service_type,
                "status": u.status,
                "latitude": u.latitude,
                "longitude": u.longitude,
                "last_updated": u.last_updated
            })
        return jsonify(data)

    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)
    page = max(1, page)
    per_page = max(1, min(per_page, 100))

    query = Unit.query.order_by(Unit.unit_id.asc())
    total = query.count()
    total_pages = max(1, math.ceil(total / per_page)) if total else 1
    page = min(page, total_pages)
    offset = (page - 1) * per_page

    units = query.offset(offset).limit(per_page).all()
    data = []
    for u in units:
        data.append({
            "unit_id": u.unit_id,
            "unit_vehicle_number": u.unit_vehicle_number,
            "service_type": u.service_type,
            "status": u.status,
            "latitude": u.latitude,
            "longitude": u.longitude,
            "last_updated": u.last_updated
        })

    return jsonify({
        "data": data,
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    })

# -------------------------
# Get all emergencies (dashboard view)
# -------------------------
@authority_bp.route("/authority/emergencies", methods=["GET"])
@authority_required()
def get_emergencies():
    emergencies = Emergency.query.all()
    data = []
    for e in emergencies:
        data.append({
            "request_id": e.request_id,
            "emergency_type": e.emergency_type,
            "latitude": e.latitude,
            "longitude": e.longitude,
            "status": e.status,
            "approved_by": e.approved_by,
            "assigned_unit": e.assigned_unit,
            "created_at": e.created_at
        })
    
    return jsonify(data)
