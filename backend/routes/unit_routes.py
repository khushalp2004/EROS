from flask import Blueprint, jsonify, request
from models import Unit
from models.location import RouteCalculation
from models.emergency import Emergency
from datetime import datetime
import json

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
    
    # Calculate current progress based on time elapsed
    dispatch_time = route_calc.timestamp
    current_time = datetime.utcnow()
    elapsed_seconds = (current_time - dispatch_time).total_seconds()
    estimated_duration = route_calc.duration or 300  # Default 5 minutes if no duration
    progress = min(elapsed_seconds / estimated_duration, 1.0)
    
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
            "service_type": unit.service_type
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
        
        # Calculate progress
        dispatch_time = route_calc.timestamp
        current_time = datetime.utcnow()
        elapsed_seconds = (current_time - dispatch_time).total_seconds()
        estimated_duration = route_calc.duration or 300
        progress = min(elapsed_seconds / estimated_duration, 1.0)
        
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
                "elapsed_seconds": elapsed_seconds
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
        "total_active": len(routes_data)
    })
