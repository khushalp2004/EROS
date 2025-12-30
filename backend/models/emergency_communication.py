"""Emergency Communication Models"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import json

Base = declarative_base()

class EmergencyBroadcast(Base):
    """Emergency broadcast messages sent to all units"""
    __tablename__ = 'emergency_broadcasts'
    
    id = Column(Integer, primary_key=True)
    emergency_code = Column(String(20), nullable=False)  # Code Red, Code Blue, etc.
    priority_level = Column(String(20), nullable=False)  # CRITICAL, URGENT, IMPORTANT, ROUTINE
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    location = Column(String(200))  # Emergency location
    coordinates = Column(JSON)  # lat, lng coordinates
    
    # Escalation settings
    auto_escalate = Column(Boolean, default=False)
    escalation_timeout = Column(Integer, default=300)  # seconds
    
    # Delivery tracking
    delivery_status = Column(JSON, default={})  # {unit_id: {delivered: bool, timestamp: datetime}}
    acknowledgments = Column(JSON, default={})  # {unit_id: {acknowledged: bool, timestamp: datetime, response: str}}
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime)
    expires_at = Column(DateTime)
    
    # Relationships
    sender_id = Column(Integer, ForeignKey('users.id'))
    sender = relationship("User", foreign_keys=[sender_id], back_populates="broadcasts_sent")
    
    # Current status
    status = Column(String(20), default='PENDING')  # PENDING, SENT, ACKNOWLEDGED, COMPLETED, CANCELLED
    
    # Additional metadata
    metadata = Column(JSON, default={})
    
    def __repr__(self):
        return f"<EmergencyBroadcast(code='{self.emergency_code}', priority='{self.priority_level}', status='{self.status}')>"

class AgencyCoordination(Base):
    """Multi-agency coordination records"""
    __tablename__ = 'agency_coordinations'
    
    id = Column(Integer, primary_key=True)
    incident_id = Column(String(50), unique=True, nullable=False)  # Unique incident identifier
    incident_type = Column(String(100), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    coordinates = Column(JSON)
    
    # Coordination status
    lead_agency = Column(String(50))  # Primary coordinating agency
    participating_agencies = Column(JSON, default=[])  # List of agency names
    coordination_level = Column(String(20), default='BASIC')  # BASIC, ADVANCED, COMMAND
    
    # Resource sharing
    shared_resources = Column(JSON, default={})  # {agency_name: [resource_ids]}
    resource_requests = Column(JSON, default=[])  # Outstanding resource requests
    
    # Communication channels
    communication_channels = Column(JSON, default=[])  # Active communication channels
    
    # Status tracking
    status = Column(String(20), default='ACTIVE')  # ACTIVE, STANDBY, COMPLETED, CANCELLED
    priority = Column(String(20), default='MEDIUM')  # LOW, MEDIUM, HIGH, CRITICAL
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime)
    
    # Relationships
    coordinator_id = Column(Integer, ForeignKey('users.id'))
    coordinator = relationship("User", foreign_keys=[coordinator_id])
    
    # Additional metadata
    metadata = Column(JSON, default={})
    
    def __repr__(self):
        return f"<AgencyCoordination(incident_id='{self.incident_id}', lead_agency='{self.lead_agency}', status='{self.status}')>"

class EmergencyEscalation(Base):
    """Emergency escalation tracking and rules"""
    __tablename__ = 'emergency_escalations'
    
    id = Column(Integer, primary_key=True)
    escalation_type = Column(String(50), nullable=False)  # TIME_BASED, THRESHOLD_BASED, MANUAL
    emergency_id = Column(Integer, ForeignKey('emergencies.id'))
    
    # Escalation rules
    trigger_conditions = Column(JSON, nullable=False)  # Conditions that trigger escalation
    escalation_targets = Column(JSON, nullable=False)  # Users, agencies, or roles to notify
    escalation_steps = Column(JSON, nullable=False)  # Step-by-step escalation process
    
    # Status tracking
    current_step = Column(Integer, default=1)
    status = Column(String(20), default='ACTIVE')  # ACTIVE, COMPLETED, CANCELLED
    triggered_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Escalation history
    escalation_log = Column(JSON, default=[])  # Log of all escalation actions
    
    # Relationships
    created_by_id = Column(Integer, ForeignKey('users.id'))
    created_by = relationship("User", foreign_keys=[created_by_id])
    
    def __repr__(self):
        return f"<EmergencyEscalation(type='{self.escalation_type}', emergency_id={self.emergency_id}, status='{self.status}')>"

class EmergencyCommunication(Base):
    """Real-time emergency communication messages"""
    __tablename__ = 'emergency_communications'
    
    id = Column(Integer, primary_key=True)
    message_type = Column(String(20), nullable=False)  # CHAT, STATUS_UPDATE, RESOURCE_REQUEST, SITUATION_REPORT
    content = Column(Text, nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    # Message context
    emergency_id = Column(Integer, ForeignKey('emergencies.id'))
    agency_id = Column(String(50))  # Agency identifier
    communication_channel = Column(String(50))  # CHANNEL_FIRE, CHANNEL_MEDICAL, CHANNEL_POLICE, etc.
    
    # Message status
    is_urgent = Column(Boolean, default=False)
    requires_acknowledgment = Column(Boolean, default=False)
    acknowledgment_count = Column(Integer, default=0)
    
    # File attachments
    attachments = Column(JSON, default=[])  # File paths and metadata
    
    # Timestamps
    sent_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    emergency = relationship("Emergency", back_populates="communications")
    
    def __repr__(self):
        return f"<EmergencyCommunication(type='{self.message_type}', sender_id={self.sender_id}, emergency_id={self.emergency_id})>"

class IncidentTimeline(Base):
    """Incident timeline and decision log"""
    __tablename__ = 'incident_timelines'
    
    id = Column(Integer, primary_key=True)
    emergency_id = Column(Integer, ForeignKey('emergencies.id'), nullable=False)
    incident_id = Column(String(50), nullable=False)  # Link to agency coordination
    
    # Timeline event
    event_type = Column(String(50), nullable=False)  # DECISION, RESOURCE_ASSIGNMENT, STATUS_UPDATE, ESCALATION
    event_description = Column(Text, nullable=False)
    event_data = Column(JSON, default={})  # Structured event data
    
    # Who made the decision/change
    actor_id = Column(Integer, ForeignKey('users.id'))
    actor_role = Column(String(50))  # Role at time of event
    
    # Timing
    timestamp = Column(DateTime, default=datetime.utcnow)
    time_to_complete = Column(Integer)  # seconds from event start
    
    # Impact assessment
    impact_level = Column(String(20))  # LOW, MEDIUM, HIGH, CRITICAL
    outcome = Column(Text)  # Result or consequence
    
    # Relationships
    actor = relationship("User", foreign_keys=[actor_id])
    emergency = relationship("Emergency", back_populates="timeline_events")
    
    def __repr__(self):
        return f"<IncidentTimeline(emergency_id={self.emergency_id}, event_type='{self.event_type}', timestamp='{self.timestamp}')>"

# Add relationships to existing models
# Note: These would need to be added to the existing User and Emergency models

"""
Database Migration Script for Emergency Communication:

```sql
-- Emergency Broadcasts Table
CREATE TABLE emergency_broadcasts (
    id SERIAL PRIMARY KEY,
    emergency_code VARCHAR(20) NOT NULL,
    priority_level VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    location VARCHAR(200),
    coordinates JSONB,
    auto_escalate BOOLEAN DEFAULT FALSE,
    escalation_timeout INTEGER DEFAULT 300,
    delivery_status JSONB DEFAULT '{}',
    acknowledgments JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    expires_at TIMESTAMP,
    sender_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'PENDING',
    metadata JSONB DEFAULT '{}'
);

-- Agency Coordination Table
CREATE TABLE agency_coordinations (
    id SERIAL PRIMARY KEY,
    incident_id VARCHAR(50) UNIQUE NOT NULL,
    incident_type VARCHAR(100) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    coordinates JSONB,
    lead_agency VARCHAR(50),
    participating_agencies JSONB DEFAULT '[]',
    coordination_level VARCHAR(20) DEFAULT 'BASIC',
    shared_resources JSONB DEFAULT '{}',
    resource_requests JSONB DEFAULT '[]',
    communication_channels JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    coordinator_id INTEGER REFERENCES users(id),
    metadata JSONB DEFAULT '{}'
);

-- Emergency Escalations Table
CREATE TABLE emergency_escalations (
    id SERIAL PRIMARY KEY,
    escalation_type VARCHAR(50) NOT NULL,
    emergency_id INTEGER REFERENCES emergencies(id),
    trigger_conditions JSONB NOT NULL,
    escalation_targets JSONB NOT NULL,
    escalation_steps JSONB NOT NULL,
    current_step INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    escalation_log JSONB DEFAULT '[]',
    created_by_id INTEGER REFERENCES users(id)
);

-- Emergency Communications Table
CREATE TABLE emergency_communications (
    id SERIAL PRIMARY KEY,
    message_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    emergency_id INTEGER REFERENCES emergencies(id),
    agency_id VARCHAR(50),
    communication_channel VARCHAR(50),
    is_urgent BOOLEAN DEFAULT FALSE,
    requires_acknowledgment BOOLEAN DEFAULT FALSE,
    acknowledgment_count INTEGER DEFAULT 0,
    attachments JSONB DEFAULT '[]',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Incident Timeline Table
CREATE TABLE incident_timelines (
    id SERIAL PRIMARY KEY,
    emergency_id INTEGER NOT NULL REFERENCES emergencies(id),
    incident_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_description TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    actor_id INTEGER REFERENCES users(id),
    actor_role VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_to_complete INTEGER,
    impact_level VARCHAR(20),
    outcome TEXT
);

-- Add indexes for performance
CREATE INDEX idx_emergency_broadcasts_status ON emergency_broadcasts(status);
CREATE INDEX idx_emergency_broadcasts_priority ON emergency_broadcasts(priority_level);
CREATE INDEX idx_agency_coordinations_incident ON agency_coordinations(incident_id);
CREATE INDEX idx_agency_coordinations_status ON agency_coordinations(status);
CREATE INDEX idx_emergency_escalations_emergency ON emergency_escalations(emergency_id);
CREATE INDEX idx_emergency_escalations_status ON emergency_escalations(status);
CREATE INDEX idx_emergency_communications_emergency ON emergency_communications(emergency_id);
CREATE INDEX idx_emergency_communications_channel ON emergency_communications(communication_channel);
CREATE INDEX idx_incident_timeline_emergency ON incident_timelines(emergency_id);
CREATE INDEX idx_incident_timeline_timestamp ON incident_timelines(timestamp);
```
"""
