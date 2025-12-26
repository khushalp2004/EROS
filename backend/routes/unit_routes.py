from flask import Blueprint, jsonify, request
from models import Unit, UnitLocation
from models.location import RouteCalculation
from models.emergency import Emergency
from datetime import datetime
import json
import math

def calculate_route_progress(lat, lng, route_geometry):
    """Calculate progress along route from current position"""
    try:

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

unit_bp = Blueprint('unit_bp', __name__)

@unit_bp.route('/units', methods=['GET'])
def get_units():
    units = Unit.query.all()
    output = []
    for u in units:
        output.append({
            'unit_id': u.unit_id,
            'service_type': u.service_type,
            'latitude': u.latitude,
            'longitude': u.longitude,
            'status': u.status,
            'last_updated': u.last_updated
        })
    
    return jsonify(output)

@unit_bp.route('/unit-routes/<int:unit_id>', methods=['GET'])
def get_unit_routes(unit_id):
    """
    Fetch active route data for a specific unit including polylines_position for animation
    """
    unit = Unit.query.get(unit_id)
    if not unit:
        return jsonify({"error": "Unit not found"}), 404
    
    # Get active route calculation for this unit
    route_calc = RouteCalculation.query.filter_by(
        unit_id=unit_id,
        is_active=True
    ).first()
    
    if not route_calc:
        return jsonify({"unit_id": unit_id, "route": None})
    
    # Get associated emergency
    emergency = None
    if route_calc.emergency_id:
        emergency = Emergency.query.get(route_calc.emergency_id)
    
    # Parse polylines_position from database
    route_positions = None
    if route_calc.polyline_positions:
        try:
            route_positions = json.loads(route_calc.polyline_positions)
        except json.JSONDecodeError:
            print(f"Error parsing polylines_position for unit {unit_id}")
            route_positions = None
    
    # 🔧 CRITICAL: Calculate progress with fresh start handling
    dispatch_time = route_calc.timestamp
    current_time = datetime.utcnow()
    elapsed_seconds = (current_time - dispatch_time).total_seconds()
    estimated_duration = route_calc.duration or 300  # Default 5 minutes if no duration
    
    # 🔧 FIX: Start with 0% progress for fresh dispatches (within first 2 minutes)
    time_since_dispatch = elapsed_seconds
    is_fresh_dispatch = time_since_dispatch < 120  # First 2 minutes = fresh start
    
    if is_fresh_dispatch:
        # 🚀 FRESH DISPATCH: Start at 0% and gradually increase
        progress = max(0.0, min(0.1, time_since_dispatch / 300))  # Max 10% in first 2 minutes
        print(f"🚨 Fresh unit route dispatch: Unit {unit_id}, {time_since_dispatch:.1f}s elapsed, progress: {progress:.3f}")
    else:
        # Progressive increase for established routes
        progress = min(elapsed_seconds / estimated_duration, 0.95)  # Cap at 95% for animation
    
    # Determine current position along route
    current_position = None
    current_segment = 0
    if route_positions and len(route_positions) > 1:
        # Calculate current position based on progress
        total_points = len(route_positions)
        progress_index = progress * (total_points - 1)
        
        if progress_index < total_points - 1:
            current_segment = int(progress_index)
            next_segment = min(current_segment + 1, total_points - 1)
            
            # Linear interpolation between current and next point
            segment_progress = progress_index - current_segment
            current_lat = route_positions[current_segment][0] + (
                route_positions[next_segment][0] - route_positions[current_segment][0]
            ) * segment_progress
            current_lng = route_positions[current_segment][1] + (
                route_positions[next_segment][1] - route_positions[current_segment][1]
            ) * segment_progress
            
            current_position = [current_lat, current_lng]
    
    response_data = {
        "unit_id": unit_id,
        "emergency_id": route_calc.emergency_id,
        "route": {
            "positions": route_positions,  # Full route coordinates for polylines
            "current_position": current_position,  # Current interpolated position
            "progress": progress,  # 0.0 to 1.0
            "total_distance": route_calc.distance,
            "estimated_duration": estimated_duration,
            "start_time": dispatch_time.isoformat() if dispatch_time else None,
            "elapsed_seconds": elapsed_seconds,
            "current_segment": current_segment,
            "waypoint_count": route_calc.waypoint_count,
            "emergency_location": {
                "latitude": route_calc.end_latitude,
                "longitude": route_calc.end_longitude
            } if route_calc.end_latitude and route_calc.end_longitude else None,
            "service_type": unit.service_type,
            # 🔧 ENHANCED: Add metadata for frontend
            "is_fresh_dispatch": is_fresh_dispatch,
            "dispatch_timestamp": dispatch_time.isoformat() if dispatch_time else None,
            "progress_cap": 0.95  # Indicate progress is capped for animation
        }
    }
    
    if emergency:
        response_data["emergency"] = {
            "request_id": emergency.request_id,
            "emergency_type": emergency.emergency_type,
            "latitude": emergency.latitude,
            "longitude": emergency.longitude,
            "status": emergency.status
        }
    
    return jsonify(response_data)

@unit_bp.route('/active-unit-routes', methods=['GET'])
def get_active_unit_routes():
    """
    Fetch all active unit routes with polylines_position for dashboard overview
    🔧 FIX: Properly handle fresh dispatch starts with 0% progress
    """
    # Get all units with active routes
    active_routes = RouteCalculation.query.filter_by(is_active=True).all()
    
    routes_data = []
    for route_calc in active_routes:
        unit = Unit.query.get(route_calc.unit_id)
        if not unit:
            continue
            
        # Parse polylines_position
        route_positions = None
        if route_calc.polyline_positions:
            try:
                route_positions = json.loads(route_calc.polyline_positions)
            except json.JSONDecodeError:
                continue
        
        # 🔧 CRITICAL: Calculate progress with fresh start handling
        progress = 0.0
        current_unit_location = UnitLocation.query.filter_by(unit_id=route_calc.unit_id, is_active=True)\
            .order_by(UnitLocation.timestamp.desc()).first()
        dispatch_time = route_calc.timestamp
        current_time = datetime.utcnow()
        elapsed_seconds = (current_time - dispatch_time).total_seconds()
        estimated_duration = route_calc.duration or 300
        
        # 🔧 FIX: Start with 0% progress for fresh dispatches (within first 2 minutes)
        # This prevents immediate 100% progress calculation issues
        time_since_dispatch = elapsed_seconds
        is_fresh_dispatch = time_since_dispatch < 120  # First 2 minutes = fresh start
        
        if is_fresh_dispatch:
            # 🚀 FRESH DISPATCH: Start at 0% and gradually increase
            progress = max(0.0, min(0.1, time_since_dispatch / 300))  # Max 10% in first 2 minutes
            print(f"🚨 Fresh dispatch detected for Unit {route_calc.unit_id}: {time_since_dispatch:.1f}s elapsed, progress: {progress:.3f}")
        elif current_unit_location and route_calc.route_geometry:
            # Use GPS-based progress calculation for established routes
            try:
                gps_progress = calculate_route_progress(
                    current_unit_location.latitude,
                    current_unit_location.longitude,
                    route_calc.route_geometry
                )
                # Ensure GPS progress doesn't jump to 100% immediately
                progress = min(gps_progress, 0.95)  # Cap at 95% to allow animation
                print(f"📍 GPS progress for Unit {route_calc.unit_id}: {progress:.3f}")
            except Exception as e:
                print(f"⚠️ GPS progress calculation failed for Unit {route_calc.unit_id}: {e}")
                # Fallback to conservative time-based progress
                progress = min(elapsed_seconds / estimated_duration, 0.95)
        else:
            # Fallback to time-based calculation if no GPS data available
            progress = min(elapsed_seconds / estimated_duration, 0.95)  # Cap at 95%
        
        emergency = None
        if route_calc.emergency_id:
            emergency = Emergency.query.get(route_calc.emergency_id)
        
        route_data = {
            "unit_id": route_calc.unit_id,
            "unit": {
                "unit_id": unit.unit_id,
                "service_type": unit.service_type,
                "status": unit.status,
                "latitude": unit.latitude,
                "longitude": unit.longitude
            },
            "emergency_id": route_calc.emergency_id,
            "route": {
                "positions": route_positions,
                "progress": progress,
                "total_distance": route_calc.distance,
                "estimated_duration": estimated_duration,
                "waypoint_count": route_calc.waypoint_count,
                "elapsed_seconds": elapsed_seconds,
                # 🔧 ENHANCED: Add metadata for frontend
                "is_fresh_dispatch": is_fresh_dispatch,
                "dispatch_timestamp": dispatch_time.isoformat() if dispatch_time else None,
                "progress_cap": 0.95  # Indicate progress is capped for animation
            }
        }
        
        if emergency:
            route_data["emergency"] = {
                "request_id": emergency.request_id,
                "emergency_type": emergency.emergency_type,
                "latitude": emergency.latitude,
                "longitude": emergency.longitude,
                "status": emergency.status
            }
        
        routes_data.append(route_data)
    
    return jsonify({
        "active_routes": routes_data,
        "total_active": len(routes_data),
        "timestamp": datetime.utcnow().isoformat()
    })
