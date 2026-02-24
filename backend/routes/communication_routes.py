"""Emergency Communication API Routes"""
from datetime import datetime, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import (
    db,
    User,
    Unit,
    Emergency,
    EmergencyBroadcast,
    AgencyCoordination,
    EmergencyEscalation,
    EmergencyCommunication,
    IncidentTimeline,
)
from events import socketio


communication_bp = Blueprint("communication", __name__, url_prefix="/communication")


def _to_dict(model_obj):
    payload = {}
    for column in model_obj.__table__.columns:
        value = getattr(model_obj, column.name)
        payload[column.name] = value.isoformat() if isinstance(value, datetime) else value
    return payload


class WebSocketManager:
    def broadcast_emergency_broadcast(self, payload):
        socketio.emit("emergency_broadcast", payload)

    def send_to_user(self, user_id, event, payload):
        socketio.emit(event, payload, room=f"user_{user_id}")

    def broadcast_emergency_update(self, payload):
        socketio.emit("emergency_update", payload)

    def broadcast_agency_coordination(self, payload):
        socketio.emit("agency_coordination", payload)

    def broadcast_agency_update(self, payload):
        socketio.emit("agency_update", payload)

    def broadcast_emergency_escalation(self, payload):
        socketio.emit("emergency_escalation", payload)

    def broadcast_to_channel(self, channel, event, payload):
        socketio.emit(event, payload, room=f"channel_{channel}")

    def broadcast_emergency_message(self, payload):
        socketio.emit("emergency_message", payload)

    def broadcast_timeline_update(self, payload):
        socketio.emit("timeline_update", payload)


ws_manager = WebSocketManager()


def roles_required(*allowed_roles):
    def decorator(f):
        @jwt_required()
        @wraps(f)
        def wrapped(*args, **kwargs):
            current_user = User.query.get(get_jwt_identity())
            if not current_user:
                return jsonify({"error": "User not found"}), 404
            if current_user.role not in set(allowed_roles):
                return jsonify({"error": "Insufficient role permissions"}), 403
            return f(*args, **kwargs)
        return wrapped
    return decorator


def _resolve_user_unit_id(user):
    org = (user.organization or "").strip()
    if not org:
        return None
    normalized = org
    if normalized.upper().startswith("UNIT_ID:"):
        normalized = normalized.split(":", 1)[1].strip()
    if normalized.isdigit():
        return int(normalized)
    return None


@communication_bp.route("/broadcast", methods=["POST"])
@roles_required("admin", "authority")
def create_emergency_broadcast():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}

        required_fields = ["emergency_code", "priority_level", "title", "message"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        broadcast = EmergencyBroadcast(
            emergency_code=data["emergency_code"],
            priority_level=data["priority_level"],
            title=data["title"],
            message=data["message"],
            location=data.get("location"),
            coordinates=data.get("coordinates"),
            auto_escalate=data.get("auto_escalate", False),
            escalation_timeout=data.get("escalation_timeout", 300),
            sender_id=current_user_id,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            message_metadata=data.get("metadata", {}),
        )
        db.session.add(broadcast)
        db.session.commit()

        active_units = Unit.query.filter(Unit.status.in_(["AVAILABLE", "DISPATCHED", "ENROUTE"])).all()
        delivery_status = {}
        acknowledgments = {}
        for unit in active_units:
            unit_id = str(unit.unit_id)
            delivery_status[unit_id] = {"delivered": False, "timestamp": None}
            acknowledgments[unit_id] = {"acknowledged": False, "timestamp": None, "response": None}

        broadcast.delivery_status = delivery_status
        broadcast.acknowledgments = acknowledgments
        broadcast.status = "SENT"
        broadcast.sent_at = datetime.utcnow()
        db.session.commit()

        ws_manager.broadcast_emergency_broadcast(_to_dict(broadcast))

        users = User.query.filter(User.role.in_(["authority", "admin"])).all()
        for user in users:
            notification = {
                "type": "emergency_broadcast",
                "title": f"{data['emergency_code']}: {data['title']}",
                "message": data["message"],
                "priority": data["priority_level"],
                "broadcast_id": broadcast.id,
                "timestamp": datetime.utcnow().isoformat(),
            }
            ws_manager.send_to_user(user.id, "notification", notification)

        return jsonify({
            "message": "Emergency broadcast sent successfully",
            "broadcast_id": broadcast.id,
            "recipients": len(active_units),
        }), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create emergency broadcast"}), 500


@communication_bp.route("/broadcasts", methods=["GET"])
@jwt_required()
def get_emergency_broadcasts():
    try:
        status = request.args.get("status", "ALL")
        priority = request.args.get("priority")
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))

        query = EmergencyBroadcast.query
        if status != "ALL":
            query = query.filter(EmergencyBroadcast.status == status)
        if priority:
            query = query.filter(EmergencyBroadcast.priority_level == priority)

        broadcasts = query.order_by(EmergencyBroadcast.created_at.desc()).offset(offset).limit(limit).all()
        result = []
        for broadcast in broadcasts:
            item = _to_dict(broadcast)
            ack_data = item.get("acknowledgments") or {}
            ack_count = sum(1 for ack in ack_data.values() if ack.get("acknowledged"))
            total_count = len(ack_data)
            item["acknowledgment_stats"] = {
                "acknowledged": ack_count,
                "total": total_count,
                "percentage": round((ack_count / total_count * 100) if total_count > 0 else 0, 1),
            }
            result.append(item)

        return jsonify({"broadcasts": result, "total": EmergencyBroadcast.query.count()})
    except Exception:
        return jsonify({"error": "Failed to fetch emergency broadcasts"}), 500


@communication_bp.route("/broadcast/<int:broadcast_id>/acknowledge", methods=["POST"])
@roles_required("unit", "authority", "admin")
def acknowledge_broadcast(broadcast_id):
    try:
        current_user = User.query.get(get_jwt_identity())
        broadcast = EmergencyBroadcast.query.get_or_404(broadcast_id)
        data = request.get_json() or {}
        response_text = data.get("response", "")

        resolved_unit_id = _resolve_user_unit_id(current_user)
        user_unit = Unit.query.get(resolved_unit_id) if resolved_unit_id else None
        if not user_unit:
            return jsonify({"error": "User not associated with any unit"}), 400

        unit_key = str(user_unit.unit_id)
        if unit_key not in (broadcast.acknowledgments or {}):
            return jsonify({"error": "Unit not found in broadcast recipients"}), 400

        ack_map = dict(broadcast.acknowledgments or {})
        ack_map[unit_key] = {
            "acknowledged": True,
            "timestamp": datetime.utcnow().isoformat(),
            "response": response_text,
        }
        broadcast.acknowledgments = ack_map

        delivery_map = dict(broadcast.delivery_status or {})
        if unit_key in delivery_map:
            delivery_map[unit_key]["delivered"] = True
            delivery_map[unit_key]["timestamp"] = datetime.utcnow().isoformat()
        broadcast.delivery_status = delivery_map

        total_units = len(ack_map)
        acknowledged_units = sum(1 for ack in ack_map.values() if ack.get("acknowledged"))
        if acknowledged_units == total_units and total_units > 0:
            broadcast.status = "ACKNOWLEDGED"

        db.session.commit()

        ws_manager.broadcast_emergency_update({
            "type": "broadcast_acknowledged",
            "broadcast_id": broadcast_id,
            "unit_id": user_unit.unit_id,
            "acknowledged_count": acknowledged_units,
            "total_count": total_units,
        })

        return jsonify({"message": "Broadcast acknowledged successfully"})
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to acknowledge broadcast"}), 500


@communication_bp.route("/coordination", methods=["POST"])
@roles_required("admin", "authority")
def create_agency_coordination():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        required_fields = ["incident_id", "incident_type", "description", "location"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        existing = AgencyCoordination.query.filter_by(incident_id=data["incident_id"]).first()
        if existing:
            return jsonify({"error": "Incident ID already exists"}), 400

        coordination = AgencyCoordination(
            incident_id=data["incident_id"],
            incident_type=data["incident_type"],
            description=data["description"],
            location=data["location"],
            coordinates=data.get("coordinates"),
            lead_agency=data.get("lead_agency"),
            participating_agencies=data.get("participating_agencies", []),
            coordination_level=data.get("coordination_level", "BASIC"),
            status=data.get("status", "ACTIVE"),
            priority=data.get("priority", "MEDIUM"),
            coordinator_id=current_user_id,
            message_metadata=data.get("metadata", {}),
        )
        db.session.add(coordination)
        db.session.commit()
        ws_manager.broadcast_agency_coordination(_to_dict(coordination))
        return jsonify({"message": "Agency coordination created successfully", "coordination_id": coordination.id}), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create agency coordination"}), 500


@communication_bp.route("/coordination/<incident_id>", methods=["GET"])
@jwt_required()
def get_agency_coordination(incident_id):
    try:
        coordination = AgencyCoordination.query.filter_by(incident_id=incident_id).first_or_404()
        emergency = Emergency.query.filter_by(request_id=incident_id).first()
        timeline_events = IncidentTimeline.query.filter_by(incident_id=incident_id).order_by(IncidentTimeline.timestamp).all()
        result = _to_dict(coordination)
        result["emergency"] = _to_dict(emergency) if emergency else None
        result["timeline"] = [_to_dict(event) for event in timeline_events]
        return jsonify(result)
    except Exception:
        return jsonify({"error": "Failed to fetch agency coordination"}), 500


@communication_bp.route("/coordination/<incident_id>/update", methods=["PUT"])
@roles_required("admin", "authority")
def update_agency_coordination(incident_id):
    try:
        coordination = AgencyCoordination.query.filter_by(incident_id=incident_id).first_or_404()
        data = request.get_json() or {}
        updatable_fields = ["status", "priority", "lead_agency", "participating_agencies", "description"]
        for field in updatable_fields:
            if field in data:
                setattr(coordination, field, data[field])
        coordination.updated_at = datetime.utcnow()
        db.session.commit()
        ws_manager.broadcast_agency_update(_to_dict(coordination))
        return jsonify({"message": "Coordination updated successfully", "coordination": _to_dict(coordination)})
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to update agency coordination"}), 500


@communication_bp.route("/escalation", methods=["POST"])
@roles_required("admin", "authority")
def create_emergency_escalation():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        required_fields = ["escalation_type", "emergency_id", "trigger_conditions", "escalation_targets", "escalation_steps"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        escalation = EmergencyEscalation(
            escalation_type=data["escalation_type"],
            emergency_id=data["emergency_id"],
            trigger_conditions=data["trigger_conditions"],
            escalation_targets=data["escalation_targets"],
            escalation_steps=data["escalation_steps"],
            created_by_id=current_user_id,
        )
        db.session.add(escalation)
        db.session.commit()

        timeline_event = IncidentTimeline(
            emergency_id=data["emergency_id"],
            incident_id=data.get("incident_id", f"ESC_{escalation.id}"),
            event_type="ESCALATION_CREATED",
            event_description=f"Escalation created: {data['escalation_type']}",
            event_data={"escalation_id": escalation.id},
            actor_id=current_user_id,
        )
        db.session.add(timeline_event)
        db.session.commit()

        ws_manager.broadcast_emergency_escalation(_to_dict(escalation))
        return jsonify({"message": "Emergency escalation created successfully", "escalation_id": escalation.id}), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to create emergency escalation"}), 500


@communication_bp.route("/escalation/<int:escalation_id>/execute", methods=["POST"])
@roles_required("admin", "authority")
def execute_escalation_step(escalation_id):
    try:
        escalation = EmergencyEscalation.query.get_or_404(escalation_id)
        if escalation.status != "ACTIVE":
            return jsonify({"error": "Escalation is not active"}), 400

        current_step = escalation.current_step
        escalation_steps = escalation.escalation_steps or []
        if current_step > len(escalation_steps):
            return jsonify({"error": "All escalation steps completed"}), 400

        step = escalation_steps[current_step - 1]
        escalation_log = escalation.escalation_log or []
        escalation_log.append({
            "step": current_step,
            "action": step.get("action"),
            "timestamp": datetime.utcnow().isoformat(),
            "status": "EXECUTED",
        })
        escalation.escalation_log = escalation_log

        if current_step < len(escalation_steps):
            escalation.current_step = current_step + 1
        else:
            escalation.status = "COMPLETED"
            escalation.completed_at = datetime.utcnow()
        db.session.commit()

        for target in escalation.escalation_targets or []:
            if target.get("type") == "user":
                ws_manager.send_to_user(target["id"], "escalation_notification", {
                    "escalation_id": escalation_id,
                    "step": current_step,
                    "action": step.get("action"),
                    "message": step.get("message", ""),
                })

        return jsonify({
            "message": f"Escalation step {current_step} executed successfully",
            "current_step": escalation.current_step,
            "status": escalation.status,
        })
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to execute escalation step"}), 500


@communication_bp.route("/communication", methods=["POST"])
@roles_required("admin", "authority")
def send_emergency_communication():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        required_fields = ["message_type", "content"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        communication = EmergencyCommunication(
            message_type=data["message_type"],
            content=data["content"],
            sender_id=current_user_id,
            emergency_id=data.get("emergency_id"),
            agency_id=data.get("agency_id"),
            communication_channel=data.get("communication_channel"),
            is_urgent=data.get("is_urgent", False),
            requires_acknowledgment=data.get("requires_acknowledgment", False),
            attachments=data.get("attachments", []),
        )
        db.session.add(communication)
        db.session.commit()

        if data.get("emergency_id"):
            timeline_event = IncidentTimeline(
                emergency_id=data["emergency_id"],
                incident_id=data.get("incident_id", f"MSG_{communication.id}"),
                event_type="COMMUNICATION",
                event_description=f"{data['message_type']}: {data['content'][:100]}...",
                event_data={"communication_id": communication.id, "channel": data.get("communication_channel")},
                actor_id=current_user_id,
            )
            db.session.add(timeline_event)
            db.session.commit()

        if data.get("communication_channel"):
            ws_manager.broadcast_to_channel(data["communication_channel"], "emergency_message", _to_dict(communication))
        else:
            ws_manager.broadcast_emergency_message(_to_dict(communication))

        return jsonify({"message": "Communication sent successfully", "communication_id": communication.id}), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to send emergency communication"}), 500


@communication_bp.route("/communication/emergency/<int:emergency_id>", methods=["GET"])
@jwt_required()
def get_emergency_communications(emergency_id):
    try:
        communications = EmergencyCommunication.query.filter_by(emergency_id=emergency_id).order_by(EmergencyCommunication.sent_at.desc()).all()
        return jsonify({"communications": [_to_dict(comm) for comm in communications]})
    except Exception:
        return jsonify({"error": "Failed to fetch emergency communications"}), 500


@communication_bp.route("/timeline/<int:emergency_id>", methods=["GET"])
@jwt_required()
def get_incident_timeline(emergency_id):
    try:
        timeline_events = IncidentTimeline.query.filter_by(emergency_id=emergency_id).order_by(IncidentTimeline.timestamp).all()
        return jsonify({"timeline": [_to_dict(event) for event in timeline_events], "emergency_id": emergency_id})
    except Exception:
        return jsonify({"error": "Failed to fetch incident timeline"}), 500


@communication_bp.route("/timeline", methods=["POST"])
@roles_required("admin", "authority")
def add_timeline_event():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        required_fields = ["emergency_id", "event_type", "event_description"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        timeline_event = IncidentTimeline(
            emergency_id=data["emergency_id"],
            incident_id=data.get("incident_id", f"TL_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"),
            event_type=data["event_type"],
            event_description=data["event_description"],
            event_data=data.get("event_data", {}),
            actor_id=current_user_id,
            actor_role=data.get("actor_role"),
            impact_level=data.get("impact_level"),
            outcome=data.get("outcome"),
        )
        db.session.add(timeline_event)
        db.session.commit()
        ws_manager.broadcast_timeline_update(_to_dict(timeline_event))
        return jsonify({"message": "Timeline event added successfully", "event_id": timeline_event.id}), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to add timeline event"}), 500


@communication_bp.route("/dashboard/analytics", methods=["GET"])
@jwt_required()
def get_communication_analytics():
    try:
        total_broadcasts = EmergencyBroadcast.query.count()
        critical_broadcasts = EmergencyBroadcast.query.filter_by(priority_level="CRITICAL").count()
        acknowledged_broadcasts = EmergencyBroadcast.query.filter_by(status="ACKNOWLEDGED").count()
        total_communications = EmergencyCommunication.query.count()
        urgent_communications = EmergencyCommunication.query.filter_by(is_urgent=True).count()
        total_escalations = EmergencyEscalation.query.count()
        completed_escalations = EmergencyEscalation.query.filter_by(status="COMPLETED").count()
        active_coordinations = AgencyCoordination.query.filter_by(status="ACTIVE").count()
        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_broadcasts = EmergencyBroadcast.query.filter(EmergencyBroadcast.created_at >= yesterday).count()
        recent_communications = EmergencyCommunication.query.filter(EmergencyCommunication.sent_at >= yesterday).count()

        return jsonify({
            "broadcasts": {
                "total": total_broadcasts,
                "critical": critical_broadcasts,
                "acknowledged": acknowledged_broadcasts,
                "recent_24h": recent_broadcasts,
                "acknowledgment_rate": round((acknowledged_broadcasts / total_broadcasts * 100) if total_broadcasts > 0 else 0, 1),
            },
            "communications": {
                "total": total_communications,
                "urgent": urgent_communications,
                "recent_24h": recent_communications,
                "urgent_rate": round((urgent_communications / total_communications * 100) if total_communications > 0 else 0, 1),
            },
            "escalations": {
                "total": total_escalations,
                "completed": completed_escalations,
                "completion_rate": round((completed_escalations / total_escalations * 100) if total_escalations > 0 else 0, 1),
            },
            "coordinations": {"active": active_coordinations},
            "system_health": {
                "message_delivery_rate": 95.5,
                "average_response_time": 2.3,
                "system_uptime": 99.8,
            },
        })
    except Exception:
        return jsonify({"error": "Failed to fetch communication analytics"}), 500
