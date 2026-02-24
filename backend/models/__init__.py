from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .unit import Unit
from .emergency import Emergency
from .notification import Notification, NotificationPreference
from .location import UnitLocation, LocationHistory, RouteCalculation
from .user import User
from .emergency_reporter_contact import EmergencyReporterContact
from .traffic_segment import TrafficSegment
from .emergency_communication import (
    EmergencyBroadcast,
    AgencyCoordination,
    EmergencyEscalation,
    EmergencyCommunication,
    IncidentTimeline,
)
from .revoked_token import RevokedToken
from .public_tracking_link import PublicTrackingLink
