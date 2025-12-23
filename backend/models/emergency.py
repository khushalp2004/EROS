from . import db
from datetime import datetime

class Emergency(db.Model):
    __tablename__ = 'emergencies'
    request_id = db.Column(db.Integer, primary_key=True)
    emergency_type = db.Column(db.String(20), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='PENDING')
    approved_by = db.Column(db.String(50))
    assigned_unit = db.Column(db.Integer, db.ForeignKey('units.unit_id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
