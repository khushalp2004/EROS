from flask import Blueprint, jsonify, request
from models import Emergency, Unit, db
from datetime import datetime
from routes.notification_routes import create_emergency_notification, create_system_notification
from events import socketio

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

    # Create notification for new emergency
    create_emergency_notification(new_emergency, 'created')
    create_system_notification(f"New {emergency_type} emergency reported at location ({latitude}, {longitude})", 'info')

    # Emit real-time event for new emergency
    emergency_data = {
        'request_id': new_emergency.request_id,
        'emergency_type': new_emergency.emergency_type,
        'latitude': new_emergency.latitude,
        'longitude': new_emergency.longitude,
        'status': new_emergency.status,
        'approved_by': new_emergency.approved_by,
        'assigned_unit': new_emergency.assigned_unit,
        'created_at': new_emergency.created_at.isoformat() if new_emergency.created_at else None
    }
    
    # Broadcast to all connected clients
    socketio.emit('emergency_created', emergency_data)
    socketio.emit('emergency_update', {
        'action': 'created',
        'emergency': emergency_data
    }, room='unit_tracking')
    
    print(f"🔴 Real-time: New emergency #{new_emergency.request_id} broadcasted to all clients")

    return jsonify({'message': 'Emergency added', 'request_id': new_emergency.request_id})

# Assign unit and complete emergency routes can go here
