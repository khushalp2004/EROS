from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Unit, UnitLocation
from models.location import RouteCalculation
from models.emergency import Emergency
from models.user import User
from models import db
from datetime import datetime
import json
import math
import functools
from routes.notification_routes import create_emergency_notification, create_unit_notification
from events import socketio

def calculate_route_progress(lat, lng, route_geometry):
    """Calculate progress along route from current position"""
    try:

        # Parse route geometry
        if isinstance(route_geometry, str):
            geometry = json.loads(route_geometry)
        else:
            geometry = route_geometry

        coordinates = geometry.get('coordinates', [])
        if not coordinates or len(coordinates) < 2:
            return 0.0

        # Convert [lng, lat] to [lat, lng] for consistency
        route_coords = [[coord[1], coord[0]] for coord in coordinates]

        # Find closest point on route and calculate progress
        min_distance = float('inf')
        total_distance = 0.0
        distance_to_point = 0.0

        for i in range(len(route_coords) - 1):
            start = route_coords[i]
            end = route_coords[i + 1]

            # Calculate segment distance
            segment_distance = haversine_distance(start[0], start[1], end[0], end[1])
            total_distance += segment_distance

            # Calculate distance from current position to this segment
            point_distance = point_to_segment_distance([lat, lng], start, end)

            if point_distance['distance'] < min_distance:
                min_distance = point_distance['distance']
                distance_to_point = total_distance - segment_distance + point_distance['distanceAlongSegment']

        # Calculate progress (0.0 to 1.0)
        progress = min(1.0, max(0.0, distance_to_point / total_distance)) if total_distance > 0 else 0.0

        return progress

    except Exception as e:
        print(f"Error calculating route progress: {e}")
        return 0.0

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth's radius in kilometers

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (math.sin(delta_lat / 2) * math.sin(delta_lat / 2) +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon / 2) * math.sin(delta_lon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c * 1000  # Convert to meters

def point_to_segment_distance(point, segment_start, segment_end):
    """Calculate distance from point to line segment"""
    px, py = point
    x1, y1 = segment_start
    x2, y2 = segment_end

    # Vector from start to end
    dx = x2 - x1
    dy = y2 - y1

    # Vector from start to point
    fx = px - x1
    fy = py - y1

    # Calculate projection parameter
    dot = fx * dx + fy * dy
    length_squared = dx * dx + dy * dy

    t = 0
    if length_squared > 0:
        t = dot / length_squared

    # Clamp to segment
    t = max(0, min(1, t))

    # Calculate closest point on segment
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy

    # Calculate distance
    distance = haversine_distance(px, py, closest_x, closest_y)

    # Calculate distance along segment
    segment_length = haversine_distance(x1, y1, x2, y2)
    distance_along_segment = t * segment_length

    return {
        'distance': distance,
        'closestPoint': [closest_x, closest_y],
        'distanceAlongSegment': distance_along_segment,
        'projectionParameter': t
    }

unit_bp = Blueprint('unit_bp', __name__)


def _get_user_unit_id(user):
    """
    Resolve a unit user to unit_id using organization field.
    Supported formats:
    - "UNIT_ID:12"
    - "12"
    """
    org = (user.organization or "").strip()
    if not org:
        return None
    if org.upper().startswith("UNIT_ID:"):
        org = org.split(":", 1)[1].strip()
    if org.isdigit():
        return int(org)
    return None


def unit_required():
    def decorator(f):
        @jwt_required()
        @functools.wraps(f)
        def wrapped(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({"success": False, "message": "User not found"}), 401
            if user.role != "unit":
                return jsonify({"success": False, "message": "Unit access required"}), 403
            return f(user, *args, **kwargs)
        return wrapped
    return decorator

@unit_bp.route('/units', methods=['GET'])
def get_units():
    units = Unit.query.all()
    output = []
    for u in units:
        output.append({
            'unit_id': u.unit_id,
            'unit_vehicle_number': u.unit_vehicle_number,
            'service_type': u.service_type,
            'latitude': u.latitude,
            'longitude': u.longitude,
            'status': u.status,
            'last_updated': u.last_updated
        })
    
    return jsonify(output)

@unit_bp.route('/units/vehicle-number/<string:vehicle_number>', methods=['DELETE'])
def delete_unit_by_vehicle_number(vehicle_number):
    """Delete a unit by vehicle number"""
    try:
        # Validate vehicle number format
        if not vehicle_number or len(vehicle_number.strip()) < 3 or len(vehicle_number.strip()) > 15:
            return jsonify({"error": "Vehicle number must be between 3 and 15 characters"}), 400
        
        # Find the unit by vehicle number
        unit = Unit.query.filter_by(unit_vehicle_number=vehicle_number.upper().strip()).first()
        
        if not unit:
            return jsonify({"error": f"Vehicle with number '{vehicle_number}' not found"}), 404
        
        # Get unit details before deletion for confirmation
        unit_data = {
            'unit_id': unit.unit_id,
            'unit_vehicle_number': unit.unit_vehicle_number,
            'service_type': unit.service_type,
            'status': unit.status
        }
        
        # Delete the unit
        db.session.delete(unit)
        db.session.commit()
        
        return jsonify({
            "message": f"Vehicle '{vehicle_number}' deleted successfully",
            "deleted_unit": unit_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete vehicle: {str(e)}"}), 500

@unit_bp.route('/units', methods=['POST'])
def create_unit():
    """Create a new emergency response unit with vehicle number"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['unit_vehicle_number', 'service_type', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Check if vehicle number already exists
        existing_unit = Unit.query.filter_by(unit_vehicle_number=data['unit_vehicle_number']).first()
        if existing_unit:
            return jsonify({"error": "Vehicle number already exists"}), 409
        
        # Validate service type with backwards compatibility
        valid_service_types = ['AMBULANCE', 'FIRE_TRUCK', 'POLICE']
        # Legacy support for old format
        legacy_mapping = {
            'Ambulance': 'AMBULANCE',
            'Fire': 'FIRE_TRUCK', 
            'Police': 'POLICE',
            'ambulance': 'AMBULANCE',
            'fire': 'FIRE_TRUCK',
            'police': 'POLICE'
        }
        
        service_type_input = data['service_type'].strip().upper()
        
        # Map legacy service types to new format
        if service_type_input in legacy_mapping:
            data['service_type'] = legacy_mapping[service_type_input]
        elif service_type_input in valid_service_types:
            data['service_type'] = service_type_input
        else:
            return jsonify({
                "error": f"Invalid service type. Must be one of: {valid_service_types}",
                "received": service_type_input,
                "valid_types": valid_service_types
            }), 400
        
        # Create new unit
        new_unit = Unit(
            unit_vehicle_number=data['unit_vehicle_number'].upper(),
            service_type=data['service_type'],
            latitude=float(data['latitude']),
            longitude=float(data['longitude']),
            status='AVAILABLE'
        )
        
        db.session.add(new_unit)
        db.session.commit()
        
        # Return the created unit
        unit_data = {
            'unit_id': new_unit.unit_id,
            'unit_vehicle_number': new_unit.unit_vehicle_number,
            'service_type': new_unit.service_type,
            'latitude': new_unit.latitude,
            'longitude': new_unit.longitude,
            'status': new_unit.status,
            'last_updated': new_unit.last_updated
        }
        
        return jsonify({
            "message": "Unit created successfully",
            "unit": unit_data
        }), 201
        
    except ValueError as e:
        return jsonify({"error": f"Invalid coordinate values: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create unit: {str(e)}"}), 500

@unit_bp.route('/unit-routes/<int:unit_id>', methods=['GET'])
def get_unit_routes(unit_id):
    """
    Fetch active route data for a specific unit including polylines_position for animation
    """
    unit = Unit.query.get(unit_id)
    if not unit:
        return jsonify({"error": "Unit not found"}), 404
    
    # Get active route calculation for this unit
    route_calc = RouteCalculation.query.filter_by(
        unit_id=unit_id,
        is_active=True
    ).first()
    
    if not route_calc:
        return jsonify({"unit_id": unit_id, "route": None})
    
    # Get associated emergency
    emergency = None
    if route_calc.emergency_id:
        emergency = Emergency.query.get(route_calc.emergency_id)
    
    # Parse polylines_position from database
    route_positions = None
    if route_calc.polyline_positions:
        try:
            route_positions = json.loads(route_calc.polyline_positions)
        except json.JSONDecodeError:
            print(f"Error parsing polylines_position for unit {unit_id}")
            route_positions = None
    
    # 🔧 FIXED: Calculate progress with improved logic
    dispatch_time = route_calc.timestamp
    current_time = datetime.utcnow()
    elapsed_seconds = (current_time - dispatch_time).total_seconds()
    estimated_duration = route_calc.duration or 300  # Default 5 minutes if no duration
    
    # 🔧 FIXED: Fresh dispatches start with reasonable progress
    time_since_dispatch = elapsed_seconds
    is_fresh_dispatch = time_since_dispatch < 60  # First minute = fresh start
    
    if is_fresh_dispatch:
        # 🚀 FRESH DISPATCH: Start with 5% progress and increase more naturally
        initial_progress = 0.05  # Start at 5%
        progress = initial_progress + (time_since_dispatch / 300) * 0.20  # Up to 25% in first minute
        progress = min(progress, 0.30)  # Cap at 30% in first minute
        print(f"🚨 Fresh unit route dispatch: Unit {unit_id}, {time_since_dispatch:.1f}s elapsed, progress: {progress:.3f}")
    else:
        # ✅ FIXED: Allow full progression without artificial caps
        time_based_progress = elapsed_seconds / estimated_duration
        progress = min(time_based_progress, 1.0)  # Allow 100% completion
    
    # Determine current position along route
    current_position = None
    current_segment = 0
    if route_positions and len(route_positions) > 1:
        # Calculate current position based on progress
        total_points = len(route_positions)
        progress_index = progress * (total_points - 1)
        
        if progress_index < total_points - 1:
            current_segment = int(progress_index)
            next_segment = min(current_segment + 1, total_points - 1)
            
            # Linear interpolation between current and next point
            segment_progress = progress_index - current_segment
            current_lat = route_positions[current_segment][0] + (
                route_positions[next_segment][0] - route_positions[current_segment][0]
            ) * segment_progress
            current_lng = route_positions[current_segment][1] + (
                route_positions[next_segment][1] - route_positions[current_segment][1]
            ) * segment_progress
            
            current_position = [current_lat, current_lng]
    
    response_data = {
        "unit_id": unit_id,
        "emergency_id": route_calc.emergency_id,
        "route": {
            "positions": route_positions,  # Full route coordinates for polylines
            "current_position": current_position,  # Current interpolated position
            "progress": progress,  # 0.0 to 1.0
            "total_distance": route_calc.distance,
            "estimated_duration": estimated_duration,
            "start_time": dispatch_time.isoformat() if dispatch_time else None,
            "elapsed_seconds": elapsed_seconds,
            "current_segment": current_segment,
            "waypoint_count": route_calc.waypoint_count,
            "emergency_location": {
                "latitude": route_calc.end_latitude,
                "longitude": route_calc.end_longitude
            } if route_calc.end_latitude and route_calc.end_longitude else None,
            "service_type": unit.service_type,
            # 🔧 ENHANCED: Add metadata for frontend
            "is_fresh_dispatch": is_fresh_dispatch,
            "dispatch_timestamp": dispatch_time.isoformat() if dispatch_time else None,
            "progress_cap": 0.95  # Indicate progress is capped for animation
        }
    }
    
    if emergency:
        response_data["emergency"] = {
            "request_id": emergency.request_id,
            "emergency_type": emergency.emergency_type,
            "latitude": emergency.latitude,
            "longitude": emergency.longitude,
            "status": emergency.status
        }
    
    return jsonify(response_data)

@unit_bp.route('/active-unit-routes', methods=['GET'])
def get_active_unit_routes():
    """
    Fetch all active unit routes with polylines_position for dashboard overview
    🔧 FIX: Properly handle fresh dispatch starts with 0% progress
    """
    # Get all units with active routes
    active_routes = RouteCalculation.query.filter_by(is_active=True).all()
    
    routes_data = []
    for route_calc in active_routes:
        unit = Unit.query.get(route_calc.unit_id)
        if not unit:
            continue
            
        # Parse polylines_position
        route_positions = None
        if route_calc.polyline_positions:
            try:
                route_positions = json.loads(route_calc.polyline_positions)
            except json.JSONDecodeError:
                continue
        
        # 🔧 FIXED: Calculate progress with improved logic
        progress = 0.0
        current_unit_location = UnitLocation.query.filter_by(unit_id=route_calc.unit_id, is_active=True)\
            .order_by(UnitLocation.timestamp.desc()).first()
        dispatch_time = route_calc.timestamp
        current_time = datetime.utcnow()
        elapsed_seconds = (current_time - dispatch_time).total_seconds()
        estimated_duration = route_calc.duration or 300
        
        # 🔧 FIXED: Fresh dispatches start with reasonable progress
        time_since_dispatch = elapsed_seconds
        is_fresh_dispatch = time_since_dispatch < 60  # First minute = fresh start
        
        if is_fresh_dispatch:
            # 🚀 FRESH DISPATCH: Start with 5% progress and increase more naturally
            initial_progress = 0.05  # Start at 5%
            progress = initial_progress + (time_since_dispatch / 300) * 0.20  # Up to 25% in first minute
            progress = min(progress, 0.30)  # Cap at 30% in first minute
            print(f"🚨 Fresh dispatch detected for Unit {route_calc.unit_id}: {time_since_dispatch:.1f}s elapsed, progress: {progress:.3f}")
        elif current_unit_location and route_calc.route_geometry:
            # ✅ FIXED: Use GPS-based progress calculation for established routes
            try:
                gps_progress = calculate_route_progress(
                    current_unit_location.latitude,
                    current_unit_location.longitude,
                    route_calc.route_geometry
                )
                # ✅ FIXED: Allow full GPS progress without artificial caps
                progress = min(gps_progress, 1.0)  # Allow 100% completion
                print(f"📍 GPS progress for Unit {route_calc.unit_id}: {progress:.3f}")
            except Exception as e:
                print(f"⚠️ GPS progress calculation failed for Unit {route_calc.unit_id}: {e}")
                # ✅ FIXED: Fallback to time-based calculation without caps
                time_based_progress = elapsed_seconds / estimated_duration
                progress = min(time_based_progress, 1.0)  # Allow 100% completion
        else:
            # ✅ FIXED: Time-based calculation without caps
            time_based_progress = elapsed_seconds / estimated_duration
            progress = min(time_based_progress, 1.0)  # Allow 100% completion
        
        emergency = None
        if route_calc.emergency_id:
            emergency = Emergency.query.get(route_calc.emergency_id)
        
        route_data = {
            "unit_id": route_calc.unit_id,
            "unit": {
                "unit_id": unit.unit_id,
                "unit_vehicle_number": unit.unit_vehicle_number,
                "service_type": unit.service_type,
                "status": unit.status,
                "latitude": unit.latitude,
                "longitude": unit.longitude
            },
            "emergency_id": route_calc.emergency_id,
            "route": {
                "positions": route_positions,
                "progress": progress,
                "total_distance": route_calc.distance,
                "estimated_duration": estimated_duration,
                "waypoint_count": route_calc.waypoint_count,
                "elapsed_seconds": elapsed_seconds,
                # 🔧 ENHANCED: Add metadata for frontend
                "is_fresh_dispatch": is_fresh_dispatch,
                "dispatch_timestamp": dispatch_time.isoformat() if dispatch_time else None,
                "progress_cap": 0.95  # Indicate progress is capped for animation
            }
        }
        
        if emergency:
            route_data["emergency"] = {
                "request_id": emergency.request_id,
                "emergency_type": emergency.emergency_type,
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "status": emergency.status
            }
        
        routes_data.append(route_data)
    
    return jsonify({
        "active_routes": routes_data,
        "total_active": len(routes_data),
        "timestamp": datetime.utcnow().isoformat()
    })


@unit_bp.route('/unit/me/emergency', methods=['GET'])
@unit_required()
def get_my_assigned_emergency(current_user):
    unit_id = _get_user_unit_id(current_user)
    if not unit_id:
        return jsonify({
            "success": False,
            "message": "Unit user is not linked. Set organization to UNIT_ID:<id>."
        }), 400

    unit = Unit.query.get(unit_id)
    if not unit:
        return jsonify({"success": False, "message": f"Unit {unit_id} not found"}), 404

    emergency = Emergency.query.filter_by(assigned_unit=unit_id, status='ASSIGNED').first()
    if not emergency:
        return jsonify({
            "success": True,
            "unit": {
                "unit_id": unit.unit_id,
                "unit_vehicle_number": unit.unit_vehicle_number,
                "service_type": unit.service_type,
                "status": unit.status,
                "latitude": unit.latitude,
                "longitude": unit.longitude
            },
            "assigned_emergency": None
        }), 200

    route_calc = RouteCalculation.query.filter_by(
        unit_id=unit_id,
        emergency_id=emergency.request_id,
        is_active=True
    ).order_by(RouteCalculation.timestamp.desc()).first()

    route_positions = None
    if route_calc and route_calc.polyline_positions:
        try:
            route_positions = json.loads(route_calc.polyline_positions)
        except Exception:
            route_positions = None

    return jsonify({
        "success": True,
        "unit": {
            "unit_id": unit.unit_id,
            "unit_vehicle_number": unit.unit_vehicle_number,
            "service_type": unit.service_type,
            "status": unit.status,
            "latitude": unit.latitude,
            "longitude": unit.longitude
        },
        "assigned_emergency": {
            "request_id": emergency.request_id,
            "emergency_type": emergency.emergency_type,
            "latitude": emergency.latitude,
            "longitude": emergency.longitude,
            "status": emergency.status,
            "created_at": emergency.created_at.isoformat() if emergency.created_at else None
        },
        "route": {
            "positions": route_positions,
            "distance": route_calc.distance if route_calc else None,
            "duration": route_calc.duration if route_calc else None,
            "waypoint_count": route_calc.waypoint_count if route_calc else 0
        } if route_calc else None
    }), 200


@unit_bp.route('/unit/me/complete/<int:emergency_id>', methods=['POST'])
@unit_required()
def complete_my_emergency(current_user, emergency_id):
    unit_id = _get_user_unit_id(current_user)
    if not unit_id:
        return jsonify({
            "success": False,
            "message": "Unit user is not linked. Set organization to UNIT_ID:<id>."
        }), 400

    unit = Unit.query.get(unit_id)
    if not unit:
        return jsonify({"success": False, "message": f"Unit {unit_id} not found"}), 404

    emergency = Emergency.query.get(emergency_id)
    if not emergency:
        return jsonify({"success": False, "message": "Emergency not found"}), 404
    if emergency.assigned_unit != unit_id:
        return jsonify({
            "success": False,
            "message": "This emergency is not assigned to your unit"
        }), 400

    # Allow unit completion for all active in-progress states.
    # Some flows may transition emergency status before unit marks completion.
    completable_statuses = {"ASSIGNED", "ENROUTE", "ARRIVING", "ARRIVED", "DEPARTED"}
    if emergency.status == "COMPLETED":
        return jsonify({
            "success": True,
            "message": f"Emergency {emergency.request_id} is already completed."
        }), 200
    if emergency.status not in completable_statuses:
        return jsonify({
            "success": False,
            "message": f"Emergency cannot be completed from status '{emergency.status}'."
        }), 400

    unit.status = "AVAILABLE"
    unit.last_updated = datetime.utcnow()
    emergency.status = "COMPLETED"
    db.session.commit()

    create_emergency_notification(emergency, 'completed')
    create_unit_notification(unit, 'completed', emergency=emergency)
    routes_cleared = RouteCalculation.deactivate_routes_for_emergency(emergency.request_id)

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

    socketio.emit('emergency_updated', {
        'action': 'completed',
        'emergency': emergency_data,
        'unit': unit_data,
        'completed_by': 'unit',
        'route_reset_info': {
            'emergency_id': emergency.request_id,
            'unit_id': unit.unit_id,
            'routes_cleared': routes_cleared,
            'reset_timestamp': datetime.utcnow().isoformat()
        }
    })
    socketio.emit('unit_status_update', {
        'unit_id': unit.unit_id,
        'status': 'AVAILABLE',
        'emergency_id': emergency.request_id
    })

    return jsonify({
        "success": True,
        "message": f"Emergency {emergency.request_id} completed by unit {unit.unit_id}. Unit is now AVAILABLE."
    }), 200
