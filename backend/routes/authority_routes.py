from flask import Blueprint, jsonify, request
from models.unit import Unit
from models.emergency import Emergency
from models import db
from datetime import datetime
from config import OSRM_BASE_URL
import math

# Max allowed route distance (50 km) for approval/dispatch
MAX_DISTANCE_METERS = 50_000


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
def dispatch_emergency(emergency_id):
    emergency = Emergency.query.get(emergency_id)

    if not emergency:
        return jsonify({"error": "Emergency not found"}), 404

    if emergency.status != "PENDING" and emergency.status != "APPROVED":
        return jsonify({"error": f"Emergency already {emergency.status}"}), 400

    # Get available units of same service type
    units = Unit.query.filter_by(
        service_type=emergency.emergency_type,
        status="AVAILABLE"
    ).all()

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

    # Update statuses
    nearest_unit.status = "DISPATCHED"
    nearest_unit.last_updated = datetime.utcnow()

    emergency.status = "ASSIGNED"
    emergency.assigned_unit = nearest_unit.unit_id
    emergency.approved_by = "Central Authority"

    db.session.commit()

    return jsonify({
        "message": "Emergency dispatched successfully",
        "emergency_id": emergency.request_id,
        "assigned_unit_id": nearest_unit.unit_id,
        "distance_m": best["distance"],
        "eta_s": best["duration"],
        "routing_source": "osrm" if best["duration"] is not None else "euclidean_fallback"
    })

# -------------------------
# Complete emergency (release unit)
# -------------------------
@authority_bp.route("/authority/complete/<int:emergency_id>", methods=["POST"])
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

    return jsonify({
        "message": f"Emergency {emergency.request_id} completed and unit {unit.unit_id} is now available"
    })

# -------------------------
# Get all units (dashboard view)
# -------------------------
@authority_bp.route("/authority/units", methods=["GET"])
def get_units():
    units = Unit.query.all()
    data = []
    for u in units:
        data.append({
            "unit_id": u.unit_id,
            "service_type": u.service_type,
            "status": u.status,
            "latitude": u.latitude,
            "longitude": u.longitude,
            "last_updated": u.last_updated
        })
    return jsonify(data)

# -------------------------
# Get all emergencies (dashboard view)
# -------------------------
@authority_bp.route("/authority/emergencies", methods=["GET"])
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
