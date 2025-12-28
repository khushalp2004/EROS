from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from . import db

Base = declarative_base()

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)  # For user-specific notifications
    type = Column(String(50), nullable=False)  # 'emergency', 'unit', 'system', 'general'
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(20), default='normal')  # 'low', 'normal', 'high', 'urgent'
    category = Column(String(50), nullable=True)  # 'status_update', 'assignment', 'alert', etc.
    
    # Status fields
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    
    # Related entity references
    emergency_id = Column(Integer, ForeignKey('emergencies.request_id'), nullable=True)  # Link to emergency if related
    unit_id = Column(Integer, ForeignKey('units.unit_id'), nullable=True)       # Link to unit if related
    
    # Timing fields
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)
    
    # Optional fields for rich notifications
    action_url = Column(String(500), nullable=True)  # Link to related page
    message_metadata = Column(Text, nullable=True)           # JSON data for additional context
    
    # Relationships
    emergency = relationship("Emergency", foreign_keys=[emergency_id], backref="notifications")
    unit = relationship("Unit", foreign_keys=[unit_id], backref="notifications")
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'priority': self.priority,
            'category': self.category,
            'is_read': self.is_read,
            'is_dismissed': self.is_dismissed,
            'is_archived': self.is_archived,
            'emergency_id': self.emergency_id,
            'unit_id': self.unit_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'dismissed_at': self.dismissed_at.isoformat() if self.dismissed_at else None,
            'action_url': self.action_url,
            'metadata': self.message_metadata
        }
    
    def mark_as_read(self):
        """Mark notification as read"""
        self.is_read = True
        self.read_at = datetime.utcnow()
    
    def mark_as_dismissed(self):
        """Mark notification as dismissed"""
        self.is_dismissed = True
        self.dismissed_at = datetime.utcnow()
    
    def archive(self):
        """Archive notification"""
        self.is_archived = True

class NotificationPreference(db.Model):
    __tablename__ = 'notification_preferences'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)  # For user-specific preferences
    
    # Notification type preferences
    emergency_alerts = Column(Boolean, default=True)
    unit_updates = Column(Boolean, default=True)
    system_notifications = Column(Boolean, default=True)
    general_notifications = Column(Boolean, default=True)
    
    # Delivery method preferences
    in_app_notifications = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=False)
    sound_notifications = Column(Boolean, default=False)
    
    # Priority filtering
    show_urgent_only = Column(Boolean, default=False)
    show_high_priority_only = Column(Boolean, default=False)
    
    # Frequency settings
    batch_notifications = Column(Boolean, default=False)  # Group notifications
    notification_frequency = Column(String(20), default='immediate')  # 'immediate', 'hourly', 'daily'
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'emergency_alerts': self.emergency_alerts,
            'unit_updates': self.unit_updates,
            'system_notifications': self.system_notifications,
            'general_notifications': self.general_notifications,
            'in_app_notifications': self.in_app_notifications,
            'email_notifications': self.email_notifications,
            'sound_notifications': self.sound_notifications,
            'show_urgent_only': self.show_urgent_only,
            'show_high_priority_only': self.show_high_priority_only,
            'batch_notifications': self.batch_notifications,
            'notification_frequency': self.notification_frequency
        }
