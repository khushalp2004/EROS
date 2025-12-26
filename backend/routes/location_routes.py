from flask import Blueprint, request, jsonify
from flask_socketio import emit, join_room, leave_room
from models import db, Unit, UnitLocation, LocationHistory, RouteCalculation, Emergency
from datetime import datetime, timedelta
import json
import requests

location_bp = Blueprint('location', __name__)

# OSRM Configuration
OSRM_BASE_URL = "https://router.project-osrm.org"

def calculate_route_progress(lat, lng, route_geometry):
    """Calculate progress along route from current position"""
    try:
        import json
        
        # Parse route geometry
        if isinstance(route_geometry, str):
            geometry = json.loads(route_geometry)
        else:
            geometry = route_geometry
        
        coordinates = geometry.get('coordinates', [])
        if not coordinates or len(coordinates) < 2:
            return 0.0
        
        # Convert [lng, lat] to [lat, lng] for consistency
        route_coords = [[coord[1], coord[0]] for coord in coordinates]
        
        # Find closest point on route and calculate progress
        min_distance = float('inf')
        total_distance = 0.0
        distance_to_point = 0.0
        
        for i in range(len(route_coords) - 1):
            start = route_coords[i]
            end = route_coords[i + 1]
            
            # Calculate segment distance
            segment_distance = haversine_distance(start[0], start[1], end[0], end[1])
            total_distance += segment_distance
            
            # Calculate distance from current position to this segment
            point_distance = point_to_segment_distance([lat, lng], start, end)
            
            if point_distance['distance'] < min_distance:
                min_distance = point_distance['distance']
                distance_to_point = total_distance - segment_distance + point_distance['distanceAlongSegment']
        
        # Calculate progress (0.0 to 1.0)
        progress = min(1.0, max(0.0, distance_to_point / total_distance)) if total_distance > 0 else 0.0
        
        return progress
        
    except Exception as e:
        print(f"Error calculating route progress: {e}")
        return 0.0

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    import math
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) * math.sin(delta_lat / 2) + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(delta_lon / 2) * math.sin(delta_lon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c * 1000  # Convert to meters

def point_to_segment_distance(point, segment_start, segment_end):
    """Calculate distance from point to line segment"""
    import math
    
    px, py = point
    x1, y1 = segment_start
    x2, y2 = segment_end
    
    # Vector from start to end
    dx = x2 - x1
    dy = y2 - y1
    
    # Vector from start to point
    fx = px - x1
    fy = py - y1
    
    # Calculate projection parameter
    dot = fx * dx + fy * dy
    length_squared = dx * dx + dy * dy
    
    t = 0
    if length_squared > 0:
        t = dot / length_squared
    
    # Clamp to segment
    t = max(0, min(1, t))
    
    # Calculate closest point on segment
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    
    # Calculate distance
    distance = haversine_distance(px, py, closest_x, closest_y)
    
    # Calculate distance along segment
    segment_length = haversine_distance(x1, y1, x2, y2)
    distance_along_segment = t * segment_length
    
    return {
        'distance': distance,
        'closestPoint': [closest_x, closest_y],
        'distanceAlongSegment': distance_along_segment,
        'projectionParameter': t
    }

@location_bp.route('/api/location/update', methods=['POST'])
def update_unit_location():
    """Update unit location with real-time tracking data and route progress calculation"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['unit_id', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        unit_id = data['unit_id']
        latitude = data['latitude']
        longitude = data['longitude']
        accuracy = data.get('accuracy')
        speed = data.get('speed')
        heading = data.get('heading')
        is_default = data.get('is_default', False)
        
        # Check if unit exists
        unit = Unit.query.get(unit_id)
        if not unit:
            return jsonify({'error': f'Unit {unit_id} not found'}), 404
        
        # Calculate route progress if unit has active emergency
        route_progress = 0.0
        route_data = None
        emergency_id = None
        
        if unit.assigned_unit:
            # Check for active emergency assignment
            emergency = Emergency.query.filter_by(
                assigned_unit=unit_id, 
                status='ASSIGNED'
            ).first()
            
            if emergency:
                emergency_id = emergency.request_id
                
                # Get active route calculation for this unit and emergency
                route_calculation = RouteCalculation.query.filter_by(
                    unit_id=unit_id,
                    emergency_id=emergency_id,
                    is_active=True
                ).order_by(RouteCalculation.timestamp.desc()).first()
                
                if route_calculation and route_calculation.route_geometry:
                    route_progress = calculate_route_progress(
                        latitude, 
                        longitude, 
                        route_calculation.route_geometry
                    )
                    route_data = {
                        'route_id': route_calculation.id,
                        'geometry': route_calculation.route_geometry,
                        'distance': route_calculation.distance,
                        'duration': route_calculation.duration
                    }
        
        # Create new location entry
        location = UnitLocation(
            unit_id=unit_id,
            latitude=latitude,
            longitude=longitude,
            accuracy=accuracy,
            speed=speed,
            heading=heading,
            is_default=is_default
        )
        
        # If this is the default location, update all other default locations for this unit
        if is_default:
            UnitLocation.query.filter_by(unit_id=unit_id, is_default=True).update({'is_default': False})
        
        # Deactivate previous active locations
        UnitLocation.query.filter_by(unit_id=unit_id, is_active=True).update({'is_active': False})
        location.is_active = True
        
        # Add to history
        history = LocationHistory(
            unit_id=unit_id,
            latitude=latitude,
            longitude=longitude,
            accuracy=accuracy,
            speed=speed,
            heading=heading,
            session_id=data.get('session_id')
        )
        
        # Update unit's current position
        unit.latitude = latitude
        unit.longitude = longitude
        unit.last_updated = datetime.utcnow()
        
        # Save to database
        db.session.add(location)
        db.session.add(history)
        db.session.commit()
        
        # Emit real-time update via WebSocket with route progress
        location_update_data = {
            'unit_id': unit_id,
            'latitude': latitude,
            'longitude': longitude,
            'accuracy': accuracy,
            'speed': speed,
            'heading': heading,
            'timestamp': location.timestamp.isoformat(),
            'progress': route_progress,  # Route progress (0.0 to 1.0)
            'emergency_id': emergency_id,  # Associated emergency ID
            'route_data': route_data,  # Route geometry data
            'osrm_route_id': route_calculation.id if route_calculation else None,  # OSRM route ID
            'route_geometry': route_calculation.route_geometry if route_calculation else None,  # Full OSRM geometry
            'route_distance': route_calculation.distance if route_calculation else None,  # Route distance
            'route_duration': route_calculation.duration if route_calculation else None,  # Route duration
            'is_on_route': route_progress > 0 if route_calculation else False  # Whether unit is following route
        }
        
        emit('location_update', location_update_data, namespace='/map', broadcast=True)
        emit('unit_location_update', location_update_data, namespace='/map', broadcast=True)
        
        return jsonify({
            'message': 'Location updated successfully',
            'location': location.to_dict(),
            'unit': {
                'unit_id': unit.unit_id,
                'latitude': unit.latitude,
                'longitude': unit.longitude,
                'status': unit.status
            },
            'route_progress': route_progress,
            'emergency_id': emergency_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@location_bp.route('/api/location/unit/<int:unit_id>/history', methods=['GET'])
def get_unit_location_history(unit_id):
    """Get location history for a unit"""
    try:
        # Get query parameters
        limit = request.args.get('limit', 100, type=int)
        hours_back = request.args.get('hours', 24, type=int)
        
        # Calculate timestamp for filtering
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_back)
        
        # Get location history
        history = LocationHistory.query.filter_by(unit_id=unit_id)\
            .filter(LocationHistory.timestamp >= cutoff_time)\
            .order_by(LocationHistory.timestamp.desc())\
            .limit(limit)\
            .all()
        
        return jsonify({
            'unit_id': unit_id,
            'history': [h.to_dict() for h in history],
            'count': len(history)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/api/location/unit/<int:unit_id>/current', methods=['GET'])
def get_current_unit_location(unit_id):
    """Get current active location for a unit"""
    try:
        location = UnitLocation.query.filter_by(unit_id=unit_id, is_active=True)\
            .order_by(UnitLocation.timestamp.desc()).first()
        
        if not location:
            return jsonify({'error': 'No active location found for unit'}), 404
        
        return jsonify({
            'unit_id': unit_id,
            'current_location': location.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/location/units/all', methods=['GET'])
def get_all_units_locations():
    """Get current locations for all units"""
    try:
        # Get all active unit locations
        locations = UnitLocation.query.filter_by(is_active=True).all()
        
        units_data = []
        for location in locations:
            unit_data = {
                'unit_id': location.unit_id,
                'location': location.to_dict(),
                'service_type': location.unit.service_type,
                'status': location.unit.status
            }
            units_data.append(unit_data)
        
        return jsonify({
            'units': units_data,
            'count': len(units_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@location_bp.route('/api/route/calculate', methods=['POST'])
def calculate_route():
    """Calculate route using OSRM API"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['unit_id', 'end_latitude', 'end_longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        unit_id = data['unit_id']
        end_latitude = data['end_latitude']
        end_longitude = data['end_longitude']
        profile = data.get('profile', 'driving')
        emergency_id = data.get('emergency_id')
        
        # Get unit's current location
        current_location = UnitLocation.query.filter_by(unit_id=unit_id, is_active=True)\
            .order_by(UnitLocation.timestamp.desc()).first()
        
        if not current_location:
            return jsonify({'error': 'No current location found for unit'}), 404
        
        start_latitude = current_location.latitude
        start_longitude = current_location.longitude
        
        # Calculate route using OSRM
        osrm_url = f"{OSRM_BASE_URL}/route/v1/{profile}/{start_longitude},{start_latitude};{end_longitude},{end_latitude}"
        osrm_params = {
            'overview': 'full',
            'geometries': 'geojson',
            'steps': True,
            'annotations': True
        }
        
        response = requests.get(osrm_url, params=osrm_params, timeout=30)
        osrm_response = response.json()
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to calculate route'}), 500
        
        # Extract route data
        if not osrm_response.get('routes'):
            return jsonify({'error': 'No route found'}), 404
        
        route_data = osrm_response['routes'][0]
        
        # Save route calculation to database
        route_calculation = RouteCalculation(
            unit_id=unit_id,
            emergency_id=emergency_id,
            osrm_response=json.dumps(osrm_response),
            route_geometry=json.dumps(route_data['geometry']),
            distance=route_data['distance'],
            duration=route_data['duration'],
            profile=profile,
            start_latitude=start_latitude,
            start_longitude=start_longitude,
            end_latitude=end_latitude,
            end_longitude=end_longitude
        )
        
        db.session.add(route_calculation)
        db.session.commit()
        
        return jsonify({
            'route_id': route_calculation.id,
            'unit_id': unit_id,
            'emergency_id': emergency_id,
            'distance': route_data['distance'],
            'duration': route_data['duration'],
            'profile': profile,
            'geometry': route_data['geometry'],
            'legs': route_data['legs'],
            'start_location': {
                'latitude': start_latitude,
                'longitude': start_longitude
            },
            'end_location': {
                'latitude': end_latitude,
                'longitude': end_longitude
            },
            'route_calculation': route_calculation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@location_bp.route('/api/route/unit/<int:unit_id>/active', methods=['GET'])
def get_active_routes(unit_id):
    """Get active routes for a unit"""
    try:
        routes = RouteCalculation.query.filter_by(unit_id=unit_id, is_active=True)\
            .order_by(RouteCalculation.timestamp.desc()).all()
        
        return jsonify({
            'unit_id': unit_id,
            'routes': [r.to_dict() for r in routes],
            'count': len(routes)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# WebSocket event handlers
def register_socketio_handlers(socketio):
    @socketio.on('join_tracking', namespace='/map')
    def handle_join_tracking(data):
        unit_id = data.get('unit_id')
        if unit_id:
            join_room(f'unit_{unit_id}')
            emit('joined_tracking', {'unit_id': unit_id})
    
    @socketio.on('leave_tracking', namespace='/map')
    def handle_leave_tracking(data):
        unit_id = data.get('unit_id')
        if unit_id:
            leave_room(f'unit_{unit_id}')
            emit('left_tracking', {'unit_id': unit_id})
    
    @socketio.on('subscribe_location_updates', namespace='/map')
    def handle_subscribe_updates(data):
        unit_ids = data.get('unit_ids', [])
        for unit_id in unit_ids:
            join_room(f'unit_{unit_id}')
        emit('subscribed', {'unit_ids': unit_ids})

