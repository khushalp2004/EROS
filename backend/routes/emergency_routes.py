import os
import json
from flask import Blueprint, jsonify, request
from models import Emergency, Unit, db
from models.location import RouteCalculation
from models.user import User
from models.emergency_reporter_contact import EmergencyReporterContact
from datetime import datetime
from routes.notification_routes import create_emergency_notification, create_system_notification
from events import socketio, unit_locations
from extensions import limiter
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from config import SECRET_KEY
from utils.validators import validate_phone_number
from services.sms_service import SMSService
import math

emergency_bp = Blueprint('emergency_bp', __name__)

TRACKING_TOKEN_SALT = "public-emergency-tracking-v1"
TRACKING_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60  # 7 days


def _tracking_serializer():
    return URLSafeTimedSerializer(SECRET_KEY, salt=TRACKING_TOKEN_SALT)


def _build_tracking_token(request_id):
    return _tracking_serializer().dumps({"request_id": int(request_id)})


def _decode_tracking_token(token):
    return _tracking_serializer().loads(token, max_age=TRACKING_TOKEN_MAX_AGE_SECONDS)


def _normalized_frontend_base_url():
    base = (os.getenv('FRONTEND_BASE_URL') or '').strip() or 'http://127.0.0.1:3000'
    # Avoid ERR_SSL_PROTOCOL_ERROR in local dev when browser tries https://localhost
    if base.startswith('https://localhost') or base.startswith('https://127.0.0.1'):
        base = base.replace('https://', 'http://', 1)
    if 'localhost' in base:
        base = base.replace('localhost', '127.0.0.1')
    return base.rstrip('/')


def _resolve_unit_driver(unit_id):
    if not unit_id:
        return None

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
            return {
                "name": full_name,
                "phone": user.phone,
                "email": user.email
            }
    return None

@emergency_bp.route('/emergencies', methods=['GET'])
def get_emergencies():
    page_arg = request.args.get("page")
    per_page_arg = request.args.get("per_page")

    # Backward compatibility: return full array when pagination is not requested.
    if page_arg is None and per_page_arg is None:
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

    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)
    page = max(1, page)
    per_page = max(1, min(per_page, 100))

    query = Emergency.query.order_by(Emergency.request_id.desc())
    total = query.count()
    total_pages = max(1, math.ceil(total / per_page)) if total else 1
    page = min(page, total_pages)
    offset = (page - 1) * per_page

    emergencies = query.offset(offset).limit(per_page).all()
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

    return jsonify({
        "data": output,
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    })

@emergency_bp.route('/emergencies', methods=['POST'])
@limiter.limit("20 per minute")
def add_emergency():
    data = request.get_json()
    emergency_type = data.get('emergency_type')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    reporter_phone = (data.get('reporter_phone') or '').strip()
    
    if not emergency_type or latitude is None or longitude is None:
        return jsonify({'error': 'Missing fields'}), 400
    if reporter_phone and not validate_phone_number(reporter_phone):
        return jsonify({'error': 'Invalid reporter phone number format'}), 400
    
    # Normalize emergency type to uppercase format
    type_mapping = {
        'Ambulance': 'AMBULANCE',
        'Fire': 'FIRE_TRUCK', 
        'Police': 'POLICE',
        'ambulance': 'AMBULANCE',
        'fire': 'FIRE_TRUCK',
        'police': 'POLICE'
    }
    
    normalized_type = type_mapping.get(emergency_type, emergency_type.upper())
    
    new_emergency = Emergency(
        emergency_type=normalized_type,
        latitude=latitude,
        longitude=longitude
    )
    db.session.add(new_emergency)
    db.session.commit()

    # Create notification for new emergency - only for authority users
    create_emergency_notification(new_emergency, 'created')
    phone_suffix = f" | Reporter phone: {reporter_phone}" if reporter_phone else ""
    create_system_notification(
        f"New {emergency_type} emergency reported at location ({latitude}, {longitude}){phone_suffix}",
        'info',
        target_roles=['authority']
    )

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

    public_tracking_token = _build_tracking_token(new_emergency.request_id)
    frontend_base_url = _normalized_frontend_base_url()
    public_tracking_url = f"{frontend_base_url}/track/{public_tracking_token}"
    sms_sent = False
    sms_message = "Reporter phone not provided"
    if reporter_phone:
        contact = EmergencyReporterContact.query.filter_by(emergency_id=new_emergency.request_id).first()
        if contact:
            contact.reporter_phone = reporter_phone
        else:
            contact = EmergencyReporterContact(
                emergency_id=new_emergency.request_id,
                reporter_phone=reporter_phone
            )
            db.session.add(contact)
        db.session.commit()

        sms_service = SMSService()
        sms_sent, sms_message = sms_service.send_assignment_pending_message(
            to_phone=reporter_phone,
            request_id=new_emergency.request_id
        )

    return jsonify({
        'message': 'Emergency added',
        'request_id': new_emergency.request_id,
        'reporter_phone': reporter_phone,
        'public_tracking_token': public_tracking_token,
        'public_tracking_url': public_tracking_url,
        'sms_sent': sms_sent,
        'sms_message': sms_message
    })


@emergency_bp.route('/public/emergencies/track/<string:tracking_token>', methods=['GET'])
@limiter.limit("60 per minute")
def get_public_emergency_tracking(tracking_token):
    try:
        payload = _decode_tracking_token(tracking_token)
        request_id = int(payload.get("request_id"))
    except SignatureExpired:
        return jsonify({"error": "Tracking link expired"}), 410
    except (BadSignature, ValueError, TypeError):
        return jsonify({"error": "Invalid tracking link"}), 400

    emergency = Emergency.query.get(request_id)
    if not emergency:
        return jsonify({"error": "Emergency not found"}), 404

    unit = Unit.query.get(emergency.assigned_unit) if emergency.assigned_unit else None
    unit_location = unit_locations.get(emergency.assigned_unit) if emergency.assigned_unit else None
    driver = _resolve_unit_driver(emergency.assigned_unit) if emergency.assigned_unit else None

    route_calc = None
    if emergency.assigned_unit:
        route_calc = RouteCalculation.query.filter_by(
            unit_id=emergency.assigned_unit,
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
        "emergency": {
            "request_id": emergency.request_id,
            "emergency_type": emergency.emergency_type,
            "latitude": emergency.latitude,
            "longitude": emergency.longitude,
            "status": emergency.status,
            "created_at": emergency.created_at.isoformat() if emergency.created_at else None
        },
        "unit": {
            "unit_id": unit.unit_id,
            "unit_vehicle_number": unit.unit_vehicle_number,
            "service_type": unit.service_type,
            "status": unit.status
        } if unit else None,
        "driver": driver,
        "unit_live_location": {
            "latitude": unit_location.get("latitude"),
            "longitude": unit_location.get("longitude"),
            "status": unit_location.get("status"),
            "progress": unit_location.get("progress"),
            "timestamp": unit_location.get("timestamp").isoformat() if unit_location and unit_location.get("timestamp") else None
        } if unit_location else None,
        "route": {
            "positions": route_positions,
            "distance": route_calc.distance if route_calc else None,
            "duration": route_calc.duration if route_calc else None
        } if route_calc else None
    }), 200

# Assign unit and complete emergency routes can go here
