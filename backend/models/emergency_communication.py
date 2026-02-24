from datetime import datetime
from . import db


class EmergencyBroadcast(db.Model):
    __tablename__ = "emergency_broadcasts"

    id = db.Column(db.Integer, primary_key=True)
    emergency_code = db.Column(db.String(20), nullable=False)
    priority_level = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(200))
    coordinates = db.Column(db.JSON)

    auto_escalate = db.Column(db.Boolean, default=False)
    escalation_timeout = db.Column(db.Integer, default=300)

    delivery_status = db.Column(db.JSON, default=dict)
    acknowledgments = db.Column(db.JSON, default=dict)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sent_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)

    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    sender = db.relationship("User", foreign_keys=[sender_id])

    status = db.Column(db.String(20), default="PENDING")
    message_metadata = db.Column("metadata", db.JSON, default=dict)


class AgencyCoordination(db.Model):
    __tablename__ = "agency_coordinations"

    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(db.String(50), unique=True, nullable=False)
    incident_type = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    location = db.Column(db.String(200))
    coordinates = db.Column(db.JSON)

    lead_agency = db.Column(db.String(50))
    participating_agencies = db.Column(db.JSON, default=list)
    coordination_level = db.Column(db.String(20), default="BASIC")

    shared_resources = db.Column(db.JSON, default=dict)
    resource_requests = db.Column(db.JSON, default=list)
    communication_channels = db.Column(db.JSON, default=list)

    status = db.Column(db.String(20), default="ACTIVE")
    priority = db.Column(db.String(20), default="MEDIUM")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)

    coordinator_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    coordinator = db.relationship("User", foreign_keys=[coordinator_id])

    message_metadata = db.Column("metadata", db.JSON, default=dict)


class EmergencyEscalation(db.Model):
    __tablename__ = "emergency_escalations"

    id = db.Column(db.Integer, primary_key=True)
    escalation_type = db.Column(db.String(50), nullable=False)
    emergency_id = db.Column(db.Integer, db.ForeignKey("emergencies.request_id"))

    trigger_conditions = db.Column(db.JSON, nullable=False)
    escalation_targets = db.Column(db.JSON, nullable=False)
    escalation_steps = db.Column(db.JSON, nullable=False)

    current_step = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default="ACTIVE")
    triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    escalation_log = db.Column(db.JSON, default=list)

    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_by = db.relationship("User", foreign_keys=[created_by_id])


class EmergencyCommunication(db.Model):
    __tablename__ = "emergency_communications"

    id = db.Column(db.Integer, primary_key=True)
    message_type = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    emergency_id = db.Column(db.Integer, db.ForeignKey("emergencies.request_id"))
    agency_id = db.Column(db.String(50))
    communication_channel = db.Column(db.String(50))

    is_urgent = db.Column(db.Boolean, default=False)
    requires_acknowledgment = db.Column(db.Boolean, default=False)
    acknowledgment_count = db.Column(db.Integer, default=0)

    attachments = db.Column(db.JSON, default=list)

    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    delivered_at = db.Column(db.DateTime)

    sender = db.relationship("User", foreign_keys=[sender_id])
    emergency = db.relationship("Emergency", foreign_keys=[emergency_id])


class IncidentTimeline(db.Model):
    __tablename__ = "incident_timelines"

    id = db.Column(db.Integer, primary_key=True)
    emergency_id = db.Column(db.Integer, db.ForeignKey("emergencies.request_id"), nullable=False)
    incident_id = db.Column(db.String(50), nullable=False)

    event_type = db.Column(db.String(50), nullable=False)
    event_description = db.Column(db.Text, nullable=False)
    event_data = db.Column(db.JSON, default=dict)

    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    actor_role = db.Column(db.String(50))

    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    time_to_complete = db.Column(db.Integer)

    impact_level = db.Column(db.String(20))
    outcome = db.Column(db.Text)

    actor = db.relationship("User", foreign_keys=[actor_id])
    emergency = db.relationship("Emergency", foreign_keys=[emergency_id])
