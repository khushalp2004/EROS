from . import db
from datetime import datetime

class Unit(db.Model):
    __tablename__ = 'units'
    unit_id = db.Column(db.Integer, primary_key=True)
    service_type = db.Column(db.String(20), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    status = db.Column(db.String(20), default='AVAILABLE')
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
