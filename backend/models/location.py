from . import db
from datetime import datetime

class UnitLocation(db.Model):
    __tablename__ = 'unit_locations'
    id = db.Column(db.Integer, primary_key=True)
    unit_id = db.Column(db.Integer, db.ForeignKey('units.unit_id'), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    accuracy = db.Column(db.Float)  # GPS accuracy in meters
    speed = db.Column(db.Float)     # Speed in km/h
    heading = db.Column(db.Float)   # Heading in degrees (0-360)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    is_default = db.Column(db.Boolean, default=False)  # Default/base location
    is_active = db.Column(db.Boolean, default=True)    # Current active location
    
    # Relationships
    unit = db.relationship('Unit', backref=db.backref('locations', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'unit_id': self.unit_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'accuracy': self.accuracy,
            'speed': self.speed,
            'heading': self.heading,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'is_default': self.is_default,
            'is_active': self.is_active
        }

class LocationHistory(db.Model):
    __tablename__ = 'location_history'
    id = db.Column(db.Integer, primary_key=True)
    unit_id = db.Column(db.Integer, db.ForeignKey('units.unit_id'), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    accuracy = db.Column(db.Float)
    speed = db.Column(db.Float)
    heading = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    session_id = db.Column(db.String(50))  # Group related location updates
    
    # Relationships
    unit = db.relationship('Unit', backref=db.backref('location_history', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'unit_id': self.unit_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'accuracy': self.accuracy,
            'speed': self.speed,
            'heading': self.heading,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'session_id': self.session_id
        }

class RouteCalculation(db.Model):
    __tablename__ = 'route_calculations'
    id = db.Column(db.Integer, primary_key=True)
    unit_id = db.Column(db.Integer, db.ForeignKey('units.unit_id'), nullable=False)
    emergency_id = db.Column(db.Integer, db.ForeignKey('emergencies.request_id'))
    
    # OSRM route data
    osrm_response = db.Column(db.Text)  # JSON response from OSRM
    route_geometry = db.Column(db.Text)  # Encoded polyline or GeoJSON
    distance = db.Column(db.Float)  # Route distance in meters
    duration = db.Column(db.Float)  # Route duration in seconds
    profile = db.Column(db.String(20), default='driving')  # OSRM profile
    
    # Cached waypoints for Phase 1 - Emergency Route Caching
    cached_waypoints = db.Column(db.Text)  # JSON array of [lat, lng] pairs (up to 245 points)
    polyline_positions = db.Column(db.Text)  # Pre-processed positions for frontend polyline
    waypoint_count = db.Column(db.Integer, default=0)  # Number of cached waypoints
    
    # Start and end points
    start_latitude = db.Column(db.Float, nullable=False)
    start_longitude = db.Column(db.Float, nullable=False)
    end_latitude = db.Column(db.Float, nullable=False)
    end_longitude = db.Column(db.Float, nullable=False)
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    unit = db.relationship('Unit', backref=db.backref('routes', lazy=True))
    emergency = db.relationship('Emergency', backref=db.backref('routes', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'unit_id': self.unit_id,
            'emergency_id': self.emergency_id,
            'distance': self.distance,
            'duration': self.duration,
            'profile': self.profile,
            # Phase 1 - Emergency Route Caching fields
            'cached_waypoints': self.cached_waypoints,
            'polyline_positions': self.polyline_positions,
            'waypoint_count': self.waypoint_count,
            'start_location': {
                'latitude': self.start_latitude,
                'longitude': self.start_longitude
            },
            'end_location': {
                'latitude': self.end_latitude,
                'longitude': self.end_longitude
            },
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'is_active': self.is_active
        }

