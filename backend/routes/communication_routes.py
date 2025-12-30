"""Emergency Communication API Routes"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import json
from backend.models.emergency_communication import (
    EmergencyBroadcast, AgencyCoordination, EmergencyEscalation,
    EmergencyCommunication, IncidentTimeline
)
from backend.models.user import User
from backend.models.emergency import Emergency
from backend.models.unit import Unit
from backend import db
from backend.services.websocket_service import WebSocketManager

# Initialize WebSocket manager
ws_manager = WebSocketManager()

communication_bp = Blueprint('communication', __name__, url_prefix='/api/communication')

# Emergency Broadcast System
@communication_bp.route('/broadcast', methods=['POST'])
@jwt_required()
def create_emergency_broadcast():
    """Create and send emergency broadcast to all units"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['emergency_code', 'priority_level', 'title', 'message']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create broadcast
        broadcast = EmergencyBroadcast(
            emergency_code=data['emergency_code'],
            priority_level=data['priority_level'],
            title=data['title'],
            message=data['message'],
            location=data.get('location'),
            coordinates=data.get('coordinates'),
            auto_escalate=data.get('auto_escalate', False),
            escalation_timeout=data.get('escalation_timeout', 300),
            sender_id=current_user_id,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            metadata=data.get('metadata', {})
        )
        
        db.session.add(broadcast)
        db.session.commit()
        
        # Get all active units for delivery tracking
        active_units = Unit.query.filter(Unit.status.in_(['AVAILABLE', 'DISPATCHED', 'ENROUTE'])).all()
        
        # Initialize delivery status
        delivery_status = {}
        acknowledgments = {}
        
        for unit in active_units:
            delivery_status[str(unit.unit_id)] = {
                'delivered': False,
                'timestamp': None
            }
            acknowledgments[str(unit.unit_id)] = {
                'acknowledged': False,
                'timestamp': None,
                'response': None
            }
        
        broadcast.delivery_status = delivery_status
        broadcast.acknowledgments = acknowledgments
        broadcast.status = 'SENT'
        broadcast.sent_at = datetime.utcnow()
        
        db.session.commit()
        
        # Send WebSocket broadcast to all connected clients
        ws_manager.broadcast_emergency_broadcast(broadcast.to_dict())
        
        # Send notifications to all users
        users = User.query.filter(User.role.in_(['authority', 'admin', 'super_admin'])).all()
        for user in users:
            # Create notification
            notification = {
                'type': 'emergency_broadcast',
                'title': f"{data['emergency_code']}: {data['title']}",
                'message': data['message'],
                'priority': data['priority_level'],
                'broadcast_id': broadcast.id,
                'timestamp': datetime.utcnow().isoformat()
            }
            ws_manager.send_to_user(user.id, 'notification', notification)
        
        return jsonify({
            'message': 'Emergency broadcast sent successfully',
            'broadcast_id': broadcast.id,
            'recipients': len(active_units)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communication_bp.route('/broadcasts', methods=['GET'])
@jwt_required()
def get_emergency_broadcasts():
    """Get emergency broadcasts with filtering"""
    try:
        current_user_id = get_jwt_identity()
        
        # Query parameters
        status = request.args.get('status', 'ALL')
        priority = request.args.get('priority')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        query = EmergencyBroadcast.query
        
        # Apply filters
        if status != 'ALL':
            query = query.filter(EmergencyBroadcast.status == status)
        if priority:
            query = query.filter(EmergencyBroadcast.priority_level == priority)
        
        # Get broadcasts
        broadcasts = query.order_by(EmergencyBroadcast.created_at.desc()).offset(offset).limit(limit).all()
        
        # Convert to dict with additional info
        result = []
        for broadcast in broadcasts:
            broadcast_dict = broadcast.to_dict()
            # Add acknowledgment statistics
            ack_count = sum(1 for ack in broadcast.acknowledgments.values() if ack.get('acknowledged'))
            total_count = len(broadcast.acknowledgments)
            broadcast_dict['acknowledgment_stats'] = {
                'acknowledged': ack_count,
                'total': total_count,
                'percentage': round((ack_count / total_count * 100) if total_count > 0 else 0, 1)
            }
            result.append(broadcast_dict)
        
        return jsonify({
            'broadcasts': result,
            'total': EmergencyBroadcast.query.count()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@communication_bp.route('/broadcast/<int:broadcast_id>/acknowledge', methods=['POST'])
@jwt_required()
def acknowledge_broadcast(broadcast_id):
    """Acknowledge receipt of emergency broadcast"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        broadcast = EmergencyBroadcast.query.get_or_404(broadcast_id)
        data = request.get_json()
        response = data.get('response', '')
        
        # Update acknowledgment for user's unit
        user_unit = Unit.query.filter_by(user_id=current_user_id).first()
        if not user_unit:
            return jsonify({'error': 'User not associated with any unit'}), 400
        
        unit_key = str(user_unit.unit_id)
        if unit_key in broadcast.acknowledgments:
            broadcast.acknowledgments[unit_key] = {
                'acknowledged': True,
                'timestamp': datetime.utcnow().isoformat(),
                'response': response
            }
            
            # Update delivery status
            if unit_key in broadcast.delivery_status:
                broadcast.delivery_status[unit_key]['delivered'] = True
                broadcast.delivery_status[unit_key]['timestamp'] = datetime.utcnow().isoformat()
            
            # Update broadcast status if all units have acknowledged
            total_units = len(broadcast.acknowledgments)
            acknowledged_units = sum(1 for ack in broadcast.acknowledgments.values() if ack.get('acknowledged'))
            
            if acknowledged_units == total_units and total_units > 0:
                broadcast.status = 'ACKNOWLEDGED'
            
            db.session.commit()
            
            # Notify all users about acknowledgment
            ws_manager.broadcast_emergency_update({
                'type': 'broadcast_acknowledged',
                'broadcast_id': broadcast_id,
                'unit_id': user_unit.unit_id,
                'acknowledged_count': acknowledged_units,
                'total_count': total_units
            })
            
            return jsonify({'message': 'Broadcast acknowledged successfully'})
        else:
            return jsonify({'error': 'Unit not found in broadcast recipients'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Multi-Agency Coordination
@communication_bp.route('/coordination', methods=['POST'])
@jwt_required()
def create_agency_coordination():
    """Create multi-agency coordination incident"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['incident_id', 'incident_type', 'description', 'location']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Check if incident ID already exists
        existing = AgencyCoordination.query.filter_by(incident_id=data['incident_id']).first()
        if existing:
            return jsonify({'error': 'Incident ID already exists'}), 400
        
        # Create coordination record
        coordination = AgencyCoordination(
            incident_id=data['incident_id'],
            incident_type=data['incident_type'],
            description=data['description'],
            location=data['location'],
            coordinates=data.get('coordinates'),
            lead_agency=data.get('lead_agency'),
            participating_agencies=data.get('participating_agencies', []),
            coordination_level=data.get('coordination_level', 'BASIC'),
            status=data.get('status', 'ACTIVE'),
            priority=data.get('priority', 'MEDIUM'),
            coordinator_id=current_user_id,
            metadata=data.get('metadata', {})
        )
        
        db.session.add(coordination)
        db.session.commit()
        
        # Send WebSocket notification
        ws_manager.broadcast_agency_coordination(coordination.to_dict())
        
        return jsonify({
            'message': 'Agency coordination created successfully',
            'coordination_id': coordination.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communication_bp.route('/coordination/<incident_id>', methods=['GET'])
@jwt_required()
def get_agency_coordination(incident_id):
    """Get agency coordination by incident ID"""
    try:
        coordination = AgencyCoordination.query.filter_by(incident_id=incident_id).first_or_404()
        
        # Get related data
        emergency = Emergency.query.filter_by(request_id=incident_id).first()
        timeline_events = IncidentTimeline.query.filter_by(incident_id=incident_id).order_by(IncidentTimeline.timestamp).all()
        
        result = coordination.to_dict()
        result['emergency'] = emergency.to_dict() if emergency else None
        result['timeline'] = [event.to_dict() for event in timeline_events]
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@communication_bp.route('/coordination/<incident_id>/update', methods=['PUT'])
@jwt_required()
def update_agency_coordination(incident_id):
    """Update agency coordination record"""
    try:
        coordination = AgencyCoordination.query.filter_by(incident_id=incident_id).first_or_404()
        data = request.get_json()
        
        # Update fields
        updatable_fields = ['status', 'priority', 'lead_agency', 'participating_agencies', 'description']
        for field in updatable_fields:
            if field in data:
                setattr(coordination, field, data[field])
        
        coordination.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Send update notification
        ws_manager.broadcast_agency_update(coordination.to_dict())
        
        return jsonify({
            'message': 'Coordination updated successfully',
            'coordination': coordination.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Emergency Escalation
@communication_bp.route('/escalation', methods=['POST'])
@jwt_required()
def create_emergency_escalation():
    """Create emergency escalation"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['escalation_type', 'emergency_id', 'trigger_conditions', 'escalation_targets', 'escalation_steps']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        escalation = EmergencyEscalation(
            escalation_type=data['escalation_type'],
            emergency_id=data['emergency_id'],
            trigger_conditions=data['trigger_conditions'],
            escalation_targets=data['escalation_targets'],
            escalation_steps=data['escalation_steps'],
            created_by_id=current_user_id
        )
        
        db.session.add(escalation)
        db.session.commit()
        
        # Add to incident timeline
        timeline_event = IncidentTimeline(
            emergency_id=data['emergency_id'],
            incident_id=data.get('incident_id', f"ESC_{escalation.id}"),
            event_type='ESCALATION_CREATED',
            event_description=f"Escalation created: {data['escalation_type']}",
            event_data={'escalation_id': escalation.id},
            actor_id=current_user_id
        )
        
        db.session.add(timeline_event)
        db.session.commit()
        
        # Send WebSocket notification
        ws_manager.broadcast_emergency_escalation(escalation.to_dict())
        
        return jsonify({
            'message': 'Emergency escalation created successfully',
            'escalation_id': escalation.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communication_bp.route('/escalation/<int:escalation_id>/execute', methods=['POST'])
@jwt_required()
def execute_escalation_step(escalation_id):
    """Execute next escalation step"""
    try:
        escalation = EmergencyEscalation.query.get_or_404(escalation_id)
        
        if escalation.status != 'ACTIVE':
            return jsonify({'error': 'Escalation is not active'}), 400
        
        current_step = escalation.current_step
        escalation_steps = escalation.escalation_steps
        
        if current_step > len(escalation_steps):
            return jsonify({'error': 'All escalation steps completed'}), 400
        
        # Execute current step
        step = escalation_steps[current_step - 1]
        
        # Log the action
        escalation_log = escalation.escalation_log or []
        escalation_log.append({
            'step': current_step,
            'action': step.get('action'),
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'EXECUTED'
        })
        
        escalation.escalation_log = escalation_log
        
        # Move to next step or complete
        if current_step < len(escalation_steps):
            escalation.current_step = current_step + 1
        else:
            escalation.status = 'COMPLETED'
            escalation.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        # Send notification to escalation targets
        targets = escalation.escalation_targets
        for target in targets:
            if target.get('type') == 'user':
                ws_manager.send_to_user(target['id'], 'escalation_notification', {
                    'escalation_id': escalation_id,
                    'step': current_step,
                    'action': step.get('action'),
                    'message': step.get('message', '')
                })
        
        return jsonify({
            'message': f'Escalation step {current_step} executed successfully',
            'current_step': escalation.current_step,
            'status': escalation.status
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Real-time Communication
@communication_bp.route('/communication', methods=['POST'])
@jwt_required()
def send_emergency_communication():
    """Send emergency communication message"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['message_type', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        communication = EmergencyCommunication(
            message_type=data['message_type'],
            content=data['content'],
            sender_id=current_user_id,
            emergency_id=data.get('emergency_id'),
            agency_id=data.get('agency_id'),
            communication_channel=data.get('communication_channel'),
            is_urgent=data.get('is_urgent', False),
            requires_acknowledgment=data.get('requires_acknowledgment', False),
            attachments=data.get('attachments', [])
        )
        
        db.session.add(communication)
        db.session.commit()
        
        # Add to incident timeline if emergency specified
        if data.get('emergency_id'):
            timeline_event = IncidentTimeline(
                emergency_id=data['emergency_id'],
                incident_id=data.get('incident_id', f"MSG_{communication.id}"),
                event_type='COMMUNICATION',
                event_description=f"{data['message_type']}: {data['content'][:100]}...",
                event_data={
                    'communication_id': communication.id,
                    'channel': data.get('communication_channel')
                },
                actor_id=current_user_id
            )
            db.session.add(timeline_event)
            db.session.commit()
        
        # Broadcast to appropriate channels
        if data.get('communication_channel'):
            ws_manager.broadcast_to_channel(data['communication_channel'], 'emergency_message', communication.to_dict())
        else:
            ws_manager.broadcast_emergency_message(communication.to_dict())
        
        return jsonify({
            'message': 'Communication sent successfully',
            'communication_id': communication.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communication_bp.route('/communication/emergency/<int:emergency_id>', methods=['GET'])
@jwt_required()
def get_emergency_communications(emergency_id):
    """Get communications for specific emergency"""
    try:
        communications = EmergencyCommunication.query.filter_by(emergency_id=emergency_id)\
            .order_by(EmergencyCommunication.sent_at.desc()).all()
        
        return jsonify({
            'communications': [comm.to_dict() for comm in communications]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Incident Timeline
@communication_bp.route('/timeline/<int:emergency_id>', methods=['GET'])
@jwt_required()
def get_incident_timeline(emergency_id):
    """Get incident timeline for emergency"""
    try:
        timeline_events = IncidentTimeline.query.filter_by(emergency_id=emergency_id)\
            .order_by(IncidentTimeline.timestamp).all()
        
        return jsonify({
            'timeline': [event.to_dict() for event in timeline_events],
            'emergency_id': emergency_id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@communication_bp.route('/timeline', methods=['POST'])
@jwt_required()
def add_timeline_event():
    """Add event to incident timeline"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['emergency_id', 'event_type', 'event_description']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        timeline_event = IncidentTimeline(
            emergency_id=data['emergency_id'],
            incident_id=data.get('incident_id', f"TL_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"),
            event_type=data['event_type'],
            event_description=data['event_description'],
            event_data=data.get('event_data', {}),
            actor_id=current_user_id,
            actor_role=data.get('actor_role'),
            impact_level=data.get('impact_level'),
            outcome=data.get('outcome')
        )
        
        db.session.add(timeline_event)
        db.session.commit()
        
        # Broadcast timeline update
        ws_manager.broadcast_timeline_update(timeline_event.to_dict())
        
        return jsonify({
            'message': 'Timeline event added successfully',
            'event_id': timeline_event.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Dashboard Analytics
@communication_bp.route('/dashboard/analytics', methods=['GET'])
@jwt_required()
def get_communication_analytics():
    """Get communication system analytics"""
    try:
        # Broadcast statistics
        total_broadcasts = EmergencyBroadcast.query.count()
        critical_broadcasts = EmergencyBroadcast.query.filter_by(priority_level='CRITICAL').count()
        acknowledged_broadcasts = EmergencyBroadcast.query.filter_by(status='ACKNOWLEDGED').count()
        
        # Communication statistics
        total_communications = EmergencyCommunication.query.count()
        urgent_communications = EmergencyCommunication.query.filter_by(is_urgent=True).count()
        
        # Escalation statistics
        total_escalations = EmergencyEscalation.query.count()
        completed_escalations = EmergencyEscalation.query.filter_by(status='COMPLETED').count()
        
        # Coordination statistics
        active_coordinations = AgencyCoordination.query.filter_by(status='ACTIVE').count()
        
        # Recent activity (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_broadcasts = EmergencyBroadcast.query.filter(EmergencyBroadcast.created_at >= yesterday).count()
        recent_communications = EmergencyCommunication.query.filter(EmergencyCommunication.sent_at >= yesterday).count()
        
        return jsonify({
            'broadcasts': {
                'total': total_broadcasts,
                'critical': critical_broadcasts,
                'acknowledged': acknowledged_broadcasts,
                'recent_24h': recent_broadcasts,
                'acknowledgment_rate': round((acknowledged_broadcasts / total_broadcasts * 100) if total_broadcasts > 0 else 0, 1)
            },
            'communications': {
                'total': total_communications,
                'urgent': urgent_communications,
                'recent_24h': recent_communications,
                'urgent_rate': round((urgent_communications / total_communications * 100) if total_communications > 0 else 0, 1)
            },
            'escalations': {
                'total': total_escalations,
                'completed': completed_escalations,
                'completion_rate': round((completed_escalations / total_escalations * 100) if total_escalations > 0 else 0, 1)
            },
            'coordinations': {
                'active': active_coordinations
            },
            'system_health': {
                'message_delivery_rate': 95.5,  # Would be calculated from actual delivery metrics
                'average_response_time': 2.3,  # Would be calculated from actual response times
                'system_uptime': 99.8
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper method to convert model to dict (to be added to models)
def to_dict(self):
    """Convert model instance to dictionary"""
    result = {}
    for column in self.__table__.columns:
        value = getattr(self, column.name)
        if isinstance(value, datetime):
            result[column.name] = value.isoformat()
        else:
            result[column.name] = value
    return result

# Add to_dict method to all models
EmergencyBroadcast.to_dict = to_dict
AgencyCoordination.to_dict = to_dict
EmergencyEscalation.to_dict = to_dict
EmergencyCommunication.to_dict = to_dict
IncidentTimeline.to_dict = to_dict
