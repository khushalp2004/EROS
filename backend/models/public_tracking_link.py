from datetime import datetime

from . import db


class PublicTrackingLink(db.Model):
    __tablename__ = "public_tracking_links"

    id = db.Column(db.Integer, primary_key=True)
    emergency_id = db.Column(db.Integer, db.ForeignKey("emergencies.request_id"), nullable=False, index=True)
    tracking_token = db.Column(db.String(512), unique=True, nullable=False, index=True)
    tracking_url = db.Column(db.String(1024), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    revoked_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def revoke(self):
        self.is_active = False
        self.revoked_at = datetime.utcnow()

    def to_dict(self):
        return {
            "id": self.id,
            "emergency_id": self.emergency_id,
            "tracking_token": self.tracking_token,
            "tracking_url": self.tracking_url,
            "is_active": self.is_active,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
