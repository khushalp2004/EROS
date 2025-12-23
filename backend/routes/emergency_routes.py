from flask import Blueprint, jsonify, request
from models import Emergency, Unit, db
from datetime import datetime

emergency_bp = Blueprint('emergency_bp', __name__)

@emergency_bp.route('/emergencies', methods=['GET'])
def get_emergencies():
    emergencies = Emergency.query.all()
    output = []
    for e in emergencies:
        output.append({
            'request_id': e.request_id,
            'emergency_type': e.emergency_type,
            'latitude': e.latitude,
            'longitude': e.longitude,
            'status': e.status,
            'approved_by': e.approved_by,
            'assigned_unit': e.assigned_unit,
            'created_at': e.created_at
        })
    return jsonify(output)

@emergency_bp.route('/emergencies', methods=['POST'])
def add_emergency():
    data = request.get_json()
    emergency_type = data.get('emergency_type')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    if not emergency_type or latitude is None or longitude is None:
        return jsonify({'error': 'Missing fields'}), 400
    
    new_emergency = Emergency(
        emergency_type=emergency_type,
        latitude=latitude,
        longitude=longitude
    )
    db.session.add(new_emergency)
    db.session.commit()
    return jsonify({'message': 'Emergency added', 'request_id': new_emergency.request_id})

# Assign unit and complete emergency routes can go here
