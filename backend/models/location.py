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

    @classmethod
    def deactivate_routes_for_emergency(cls, emergency_id):
        """
        Deactivate all route calculations for a completed emergency
        This preserves history while cleaning up active state
        """
        try:
            routes_to_deactivate = cls.query.filter_by(emergency_id=emergency_id, is_active=True).all()
            count = 0
            for route in routes_to_deactivate:
                route.is_active = False
                count += 1
            
            db.session.commit()
            print(f"🔄 Deactivated {count} route calculations for Emergency #{emergency_id}")
            return count
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error deactivating routes for Emergency #{emergency_id}: {e}")
            return 0

    @classmethod
    def deactivate_routes_for_unit(cls, unit_id):
        """
        Deactivate all route calculations for a specific unit
        Useful when a unit is reset or reassigned
        """
        try:
            routes_to_deactivate = cls.query.filter_by(unit_id=unit_id, is_active=True).all()
            count = 0
            for route in routes_to_deactivate:
                route.is_active = False
                count += 1
            
            db.session.commit()
            print(f"🔄 Deactivated {count} route calculations for Unit {unit_id}")
            return count
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error deactivating routes for Unit {unit_id}: {e}")
            return 0

    @classmethod
    def cleanup_old_routes(cls, days_old=7):
        """
        Cleanup old inactive route calculations (optional cleanup job)
        """
        try:
            cutoff_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            cutoff_date = cutoff_date.replace(day=cutoff_date.day - days_old)
            
            old_routes = cls.query.filter(
                cls.is_active == False,
                cls.timestamp < cutoff_date
            ).all()
            
            count = len(old_routes)
            for route in old_routes:
                db.session.delete(route)
            
            db.session.commit()
            print(f"🧹 Cleaned up {count} old route calculations older than {days_old} days")
            return count
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error cleaning up old routes: {e}")
            return 0

