import os
import threading
import time
import math
from datetime import datetime, timedelta
from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room
from models import Unit, Emergency

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

def interpolate_location(start_lat, start_lon, end_lat, end_lon, progress):
    """Interpolate between two locations based on progress (0-1)"""
    return (
        start_lat + (end_lat - start_lat) * progress,
        start_lon + (end_lon - start_lon) * progress
    )

def update_unit_location(unit_id, latitude, longitude, status="ENROUTE"):
    """Update unit location and broadcast to all connected clients"""
    timestamp = datetime.utcnow()
    
    # Store current location
    unit_locations[unit_id] = {
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp,
        'status': status
    }
    
    # Add to location history
    if unit_id not in location_history:
        location_history[unit_id] = []
    
    location_history[unit_id].append({
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp,
        'status': status
    })
    
    # Keep only last 100 location updates per unit
    if len(location_history[unit_id]) > 100:
        location_history[unit_id] = location_history[unit_id][-100:]
    
    # Broadcast location update to all connected clients
    socketio.emit('unit_location_update', {
        'unit_id': unit_id,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp.isoformat(),
        'status': status
    })

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
                print(f"Error in unit movement simulation: {e}")
                time.sleep(5)
    
    def simulate_movement_cycle(app):
        """Simulate movement for dispatched emergencies"""
        from models import Unit, Emergency
        
        # Get dispatched emergencies from database
        dispatched_emergencies = Emergency.query.filter_by(status="ASSIGNED").all()
        
        for emergency in dispatched_emergencies:
            unit_id = emergency.assigned_unit
            if not unit_id:
                continue
                
            # Get unit's current location
            unit = Unit.query.get(unit_id)
            if not unit:
                continue
            
            # Check if we already have simulation data for this unit
            current_location = unit_locations.get(unit_id)
            if current_location and current_location.get('progress') is not None:
                # Continue existing simulation
                progress = min(1.0, current_location['progress'] + 0.02)  # Move 2% per cycle (slower, more visible)
                print(f"🔄 Continuing Unit {unit_id} simulation: {progress:.1%}")
            else:
                # Initialize simulation for this unit
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
            
            # Update unit location
            update_unit_location(unit_id, current_lat, current_lon, status)
            
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

def init_websocket(app):
    """Initialize WebSocket with the Flask app"""
    global simulation_thread, simulation_running
    socketio.init_app(app, 
        cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        cors_credentials=False,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
    )
    
    # Start simulation thread only once
    if not simulation_running:
        simulation_running = True
        simulation_thread = simulate_unit_movement(app)
    
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
def handle_get_unit_locations():
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
