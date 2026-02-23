from datetime import datetime
from . import db


class TrafficSegment(db.Model):
    __tablename__ = "traffic_segments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=True)
    jam_level = db.Column(db.String(20), nullable=False, default="MEDIUM")
    geometry = db.Column(db.Text, nullable=False)  # GeoJSON LineString as JSON string
    notes = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "jam_level": self.jam_level,
            "geometry": self.geometry,
            "notes": self.notes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
