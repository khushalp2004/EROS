from flask import Blueprint, jsonify, request
from models.unit import Unit
from models.emergency import Emergency
from models import db
import math
from datetime import datetime

authority_bp = Blueprint("authority_bp", __name__)

# -------------------------
# Helper: Euclidean distance (simple simulation)
# -------------------------
def distance(lat1, lon1, lat2, lon2):
    return math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2)

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

    # Find nearest unit
    nearest_unit = min(
        units,
        key=lambda u: distance(
            emergency.latitude,
            emergency.longitude,
            u.latitude,
            u.longitude
        )
    )

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
        "assigned_unit_id": nearest_unit.unit_id
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
