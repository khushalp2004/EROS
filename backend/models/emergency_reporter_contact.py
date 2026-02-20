from datetime import datetime
from . import db


class EmergencyReporterContact(db.Model):
    __tablename__ = 'emergency_reporter_contacts'

    id = db.Column(db.Integer, primary_key=True)
    emergency_id = db.Column(db.Integer, db.ForeignKey('emergencies.request_id'), nullable=False, unique=True, index=True)
    reporter_phone = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

