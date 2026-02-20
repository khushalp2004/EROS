import os
import threading
import time
import math
from datetime import datetime, timedelta
from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room
from models import Unit, Emergency
import polyline

# Initialize SocketIO - This will be the shared instance
socketio = SocketIO()

# In-memory unit location tracking
unit_locations = {}  # unit_id -> {latitude, longitude, timestamp, status}
location_history = {}  # unit_id -> list of location updates

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) * math.sin(delta_lat / 2) + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(delta_lon / 2) * math.sin(delta_lon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula (returns meters)"""
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

def interpolate_location(start_lat, start_lon, end_lat, end_lon, progress):
    """Interpolate between two locations based on progress (0-1)"""
    return (
        start_lat + (end_lat - start_lat) * progress,
        start_lon + (end_lon - start_lon) * progress
    )

def update_unit_location(unit_id, latitude, longitude, status="ENROUTE", progress=None, emergency_id=None, route_data=None):
    """Update unit location and broadcast to all connected clients"""
    timestamp = datetime.utcnow()
    
    # Calculate route progress if not provided and unit has active emergency
    if progress is None:
        progress = calculate_route_progress_for_unit(unit_id, latitude, longitude)
    
    # Store current location with route progress
    unit_locations[unit_id] = {
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp,
        'status': status,
        'progress': progress,
        'emergency_id': emergency_id,
        'route_data': route_data
    }
    
    # Add to location history
    if unit_id not in location_history:
        location_history[unit_id] = []
    
    location_history[unit_id].append({
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp,
        'status': status,
        'progress': progress,
        'emergency_id': emergency_id
    })
    
    # Keep only last 100 location updates per unit
    if len(location_history[unit_id]) > 100:
        location_history[unit_id] = location_history[unit_id][-100:]
    
    # Broadcast location update to all connected clients with route progress
    location_update_data = {
        'unit_id': unit_id,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp.isoformat(),
        'status': status,
        'progress': progress,
        'emergency_id': emergency_id,
        'route_data': route_data
    }
    
    socketio.emit('unit_location_update', location_update_data)
    socketio.emit('location_update', location_update_data, room='unit_tracking')

def calculate_route_progress_for_unit(unit_id, lat, lng):
    """Calculate route progress for a unit based on their active emergency assignment"""
    try:
        from models import Unit, Emergency, RouteCalculation
        import json
        
        # Get unit and check if assigned to emergency
        unit = Unit.query.get(unit_id)
        if not unit:
            return 0.0
        
        # Check if unit is assigned to any emergency
        emergency = Emergency.query.filter_by(
            assigned_unit=unit_id,
            status='ASSIGNED'
        ).first()
        
        if not emergency:
            return 0.0
        
        # Get active route calculation
        route_calculation = RouteCalculation.query.filter_by(
            unit_id=unit_id,
            emergency_id=emergency.request_id,
            is_active=True
        ).order_by(RouteCalculation.timestamp.desc()).first()
        
        if not route_calculation or not route_calculation.route_geometry:
            return 0.0

        # Parse route geometry - it's stored as an encoded polyline string
        if isinstance(route_calculation.route_geometry, str):
            if not route_calculation.route_geometry.strip():
                return 0.0
            try:
                # Decode the polyline to get coordinates [lat, lng]
                route_coords = polyline.decode(route_calculation.route_geometry)
            except Exception:
                return 0.0
        else:
            return 0.0

        if not route_coords or len(route_coords) < 2:
            return 0.0
        
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
        print(f"Error calculating route progress for unit {unit_id}: {e}")
        return 0.0

def simulate_unit_movement(app=None):
    """Background thread to simulate unit movement along emergency routes"""
    import threading
    import time
    
    def run_simulation():
        while True:
            try:
                if app:
                    with app.app_context():
                        # Simulate unit movement for dispatched emergencies
                        simulate_movement_cycle(app)
                else:
                    simulate_movement_cycle()
                
                time.sleep(2)  # Update every 2 seconds
                
            except Exception as e:
                print(f"❌ Error in unit movement simulation: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(5)
    
    def simulate_movement_cycle(app):
        """Simulate movement for dispatched emergencies"""
        from models import Unit, Emergency
        
        print(f"🔄 Simulation cycle running at {datetime.now()}")
        
        # Get dispatched emergencies from database
        dispatched_emergencies = Emergency.query.filter_by(status="ASSIGNED").all()
        print(f"📊 Found {len(dispatched_emergencies)} assigned emergencies")
        
        for emergency in dispatched_emergencies:
            unit_id = emergency.assigned_unit
            if not unit_id:
                continue
                
            # Get unit's current location
            unit = Unit.query.get(unit_id)
            if not unit:
                continue
            
            # 🔧 CRITICAL: Check if we already have simulation data for this unit
            current_location = unit_locations.get(unit_id)
            existing_emergency_id = current_location.get('emergency_id') if current_location else None
            
            if current_location and current_location.get('progress') is not None and existing_emergency_id == emergency.request_id:
                # Continue existing simulation for SAME emergency
                progress = min(1.0, current_location['progress'] + 0.02)  # Move 2% per cycle (slower, more visible)
                print(f"🔄 Continuing Unit {unit_id} simulation: {progress:.1%}")
            else:
                # Initialize NEW simulation for this emergency (reset progress to 0)
                progress = 0.0
                unit_locations[unit_id] = {
                    'latitude': unit.latitude,
                    'longitude': unit.longitude,
                    'timestamp': datetime.utcnow(),
                    'status': 'ENROUTE',
                    'progress': progress,
                    'start_lat': unit.latitude,
                    'start_lon': unit.longitude,
                    'end_lat': emergency.latitude,
                    'end_lon': emergency.longitude,
                    'emergency_id': emergency.request_id
                }
                if existing_emergency_id != emergency.request_id:
                    print(f"🔄 RESET simulation for Unit {unit_id} - NEW Emergency {emergency.request_id} (was {existing_emergency_id})")
                else:
                    print(f"🔄 Started NEW simulation for Unit {unit_id} to Emergency {emergency.request_id}")
            
            # Calculate current position (get from stored data)
            start_lat = unit_locations[unit_id].get('start_lat', unit.latitude)
            start_lon = unit_locations[unit_id].get('start_lon', unit.longitude)
            end_lat = unit_locations[unit_id].get('end_lat', emergency.latitude)
            end_lon = unit_locations[unit_id].get('end_lon', emergency.longitude)
            
            current_lat, current_lon = interpolate_location(
                start_lat, start_lon, end_lat, end_lon, progress
            )
            
            # Determine status based on progress
            if progress >= 1.0:
                status = "ARRIVED"
            elif progress > 0.8:
                status = "ARRIVING"
            elif progress > 0.2:
                status = "ENROUTE"
            else:
                status = "DEPARTED"
            
            # Update unit location with progress
            update_unit_location(
                unit_id, current_lat, current_lon, status,
                progress=progress,
                emergency_id=emergency.request_id
            )

            # Store updated progress and position for next iteration
            unit_locations[unit_id]['progress'] = progress
            unit_locations[unit_id]['latitude'] = current_lat
            unit_locations[unit_id]['longitude'] = current_lon
            unit_locations[unit_id]['status'] = status
            unit_locations[unit_id]['start_lat'] = unit_locations[unit_id].get('start_lat', unit.latitude)
            unit_locations[unit_id]['start_lon'] = unit_locations[unit_id].get('start_lon', unit.longitude)
            unit_locations[unit_id]['end_lat'] = unit_locations[unit_id].get('end_lat', emergency.latitude)
            unit_locations[unit_id]['end_lon'] = unit_locations[unit_id].get('end_lon', emergency.longitude)
            unit_locations[unit_id]['emergency_id'] = emergency.request_id
            
            print(f"🚑 Unit {unit_id}: {status} ({progress:.1%}) - Emergency {emergency.request_id}")
    
    # Start simulation in a separate thread
    simulation_thread = threading.Thread(target=run_simulation, daemon=True)
    simulation_thread.start()
    return simulation_thread

# Initialize simulation thread
simulation_thread = None
simulation_running = False

def _parse_frontend_origins():
    configured = (os.getenv("FRONTEND_ORIGINS") or "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
    ]

def init_websocket(app):
    """Initialize WebSocket with the Flask app"""
    global simulation_thread, simulation_running
    socketio.init_app(app,
        cors_allowed_origins=_parse_frontend_origins(),
        cors_credentials=False,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRFToken"]
    )

    # Start simulation thread only once
    if not simulation_running:
        print("🚀 Starting backend unit movement simulation...")
        simulation_running = True
        with app.app_context():
            simulation_thread = simulate_unit_movement(app)
        print("✅ Backend simulation started successfully!")
    
    return socketio

def start_unit_simulation(app):
    """Start unit simulation with proper app context"""
    global simulation_thread, simulation_running
    with app.app_context():
        # Start simulation thread if not already running
        if not simulation_running:
            simulation_running = True
            simulation_thread = simulate_unit_movement(app)
    return simulation_thread

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")
    
    # Send current unit locations to newly connected client
    for unit_id, location in unit_locations.items():
        emit('unit_location_update', {
            'unit_id': unit_id,
            'latitude': location['latitude'],
            'longitude': location['longitude'],
            'timestamp': location['timestamp'].isoformat(),
            'status': location['status']
        })
    
    emit('connection_status', {'status': 'connected', 'message': 'Successfully connected to unit tracking system'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")

@socketio.on('join_tracking_room')
def handle_join_tracking_room():
    """Handle client joining the unit tracking room"""
    join_room('unit_tracking')
    print(f"Client {request.sid} joined unit tracking room")
    emit('room_joined', {'room': 'unit_tracking'})

@socketio.on('leave_tracking_room')
def handle_leave_tracking_room():
    """Handle client leaving the unit tracking room"""
    leave_room('unit_tracking')
    print(f"Client {request.sid} left unit tracking room")
    emit('room_left', {'room': 'unit_tracking'})

@socketio.on('get_unit_locations')
def handle_get_unit_locations(data=None):
    """Handle request for current unit locations"""
    locations = {}
    for unit_id, location in unit_locations.items():
        locations[unit_id] = {
            'latitude': location['latitude'],
            'longitude': location['longitude'],
            'timestamp': location['timestamp'].isoformat(),
            'status': location['status']
        }
    
    emit('unit_locations_response', {'locations': locations})

@socketio.on('get_emergency_updates')
def handle_get_emergency_updates():
    """Handle request for current emergency updates"""
    try:
        from models import Emergency
        
        # Get current emergencies
        emergencies = Emergency.query.all()
        emergency_data = []
        
        for emergency in emergencies:
            emergency_data.append({
                'request_id': emergency.request_id,
                'status': emergency.status,
                'emergency_type': emergency.emergency_type,
                'latitude': emergency.latitude,
                'longitude': emergency.longitude,
                'assigned_unit': emergency.assigned_unit,
                'created_at': emergency.created_at.isoformat() if emergency.created_at else None,
                'updated_at': emergency.updated_at.isoformat() if emergency.updated_at else None
            })
        
        emit('emergency_updates_response', {'emergencies': emergency_data})
        
    except Exception as e:
        print(f"Error fetching emergency updates: {e}")
        emit('emergency_updates_response', {'emergencies': [], 'error': str(e)})

@socketio.on('update_unit_location')
def handle_update_unit_location(data):
    """Handle manual unit location update"""
    unit_id = data.get('unit_id')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    status = data.get('status', 'ENROUTE')
    
    if unit_id and latitude is not None and longitude is not None:
        update_unit_location(unit_id, latitude, longitude, status)
        emit('location_updated', {'unit_id': unit_id, 'status': 'success'})
    else:
        emit('location_updated', {'unit_id': unit_id, 'status': 'error', 'message': 'Invalid data'})

@socketio.on('get_unit_history')
def handle_get_unit_history(data):
    """Handle request for unit location history"""
    unit_id = data.get('unit_id')
    if unit_id and unit_id in location_history:
        emit('unit_history_response', {
            'unit_id': unit_id,
            'history': location_history[unit_id]
        })
    else:
        emit('unit_history_response', {
            'unit_id': unit_id,
            'history': []
        })

# Emergency event handlers
@socketio.on('emergency_created')
def handle_emergency_created(data):
    """Handle new emergency creation"""
    emit('emergency_update', {
        'action': 'created',
        'emergency': data
    }, room='unit_tracking')

@socketio.on('emergency_updated')
def handle_emergency_updated(data):
    """Handle emergency status update"""
    emit('emergency_update', {
        'action': 'updated',
        'emergency': data
    }, room='unit_tracking')

@socketio.on('emergency_completed')
def handle_emergency_completed(data):
    """Handle emergency completion"""
    emit('emergency_update', {
        'action': 'completed',
        'emergency': data
    }, room='unit_tracking')
