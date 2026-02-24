from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.unit import Unit
from models.emergency import Emergency
from models.location import RouteCalculation
from models.user import User
from models.emergency_reporter_contact import EmergencyReporterContact
from models import db, PublicTrackingLink, TrafficSegment
from datetime import datetime
from config import OSRM_BASE_URL
from routes.notification_routes import create_emergency_notification, create_unit_notification
from events import socketio
from services.sms_service import SMSService
import requests
import math
import json
import polyline
import functools
import os
from itsdangerous import URLSafeTimedSerializer
from config import SECRET_KEY

# Max allowed route distance (50 km) for approval/dispatch
MAX_DISTANCE_METERS = 50_000
TRACKING_TOKEN_SALT = "public-emergency-tracking-v1"


def _build_tracking_token(request_id):
    serializer = URLSafeTimedSerializer(SECRET_KEY, salt=TRACKING_TOKEN_SALT)
    return serializer.dumps({"request_id": int(request_id)})


def _normalized_frontend_base_url():
    base = (os.getenv('FRONTEND_BASE_URL') or '').strip() or 'http://127.0.0.1:3000'
    if base.startswith('https://localhost') or base.startswith('https://127.0.0.1'):
        base = base.replace('https://', 'http://', 1)
    if 'localhost' in base:
        base = base.replace('localhost', '127.0.0.1')
    return base.rstrip('/')


def _ensure_public_tracking_links_table():
    try:
        PublicTrackingLink.__table__.create(bind=db.engine, checkfirst=True)
    except Exception:
        # Table creation should not block dispatch flow.
        pass


def _resolve_unit_driver(unit_id):
    candidates = User.query.filter_by(role='unit').all()
    for user in candidates:
        org = (user.organization or "").strip()
        if not org:
            continue
        normalized = org
        if normalized.upper().startswith("UNIT_ID:"):
            normalized = normalized.split(":", 1)[1].strip()
        if normalized.isdigit() and int(normalized) == int(unit_id):
            full_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip() or user.email
            return {"name": full_name, "phone": user.phone}
    return None

def authority_required():
    """
    Decorator to check if current user has authority or admin role
    """
    def decorator(f):
        @jwt_required()
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            current_user = User.query.get(current_user_id)
            
            if not current_user:
                return jsonify({
                    'success': False,
                    'message': 'User not found',
                    'error': 'USER_NOT_FOUND'
                }), 401
            
            # Check if user has authority or admin role
            if current_user.role not in ['authority', 'admin']:
                return jsonify({
                    'success': False,
                    'message': 'Authority access required',
                    'error': 'AUTHORITY_REQUIRED'
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def haversine_m(lat1, lon1, lat2, lon2):
    """
    Great-circle distance between two lat/lon pairs in meters.
    """
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# -------------------------
# Helper: Phase 1 - Fetch full OSRM route with 245 waypoints
# -------------------------
def fetch_full_osrm_route(src_lat, src_lon, dst_lat, dst_lon, timeout=5):
    """
    Fetches complete OSRM route with full geometry and waypoints.
    Returns (distance, duration, route_geometry, waypoints, polyline_positions)
    """
    url = f"{OSRM_BASE_URL}/route/v1/driving/{src_lon},{src_lat};{dst_lon},{dst_lat}"
    params = {
        "overview": "full",           # Get complete route geometry
        "geometries": "polyline",     # Return polyline encoded geometry
        "steps": "false",             # No turn-by-turn steps
        "annotations": "false"        # No additional annotations
    }
    
    try:
        resp = requests.get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        
        routes = data.get("routes") or []
        if not routes:
            raise ValueError("No route from OSRM")
            
        route = routes[0]
        geometry = route.get("geometry", "")
        distance = route.get("distance")
        duration = route.get("duration")
        
        # Decode polyline to get waypoints
        if geometry:
            waypoints = polyline.decode(geometry)
            # Limit to 245 waypoints maximum
            if len(waypoints) > 245:
                # Sample waypoints to get exactly 245 points
                step = len(waypoints) / 245
                waypoints = [waypoints[int(i * step)] for i in range(245)]
            
            # Convert to [lat, lng] format for JSON storage
            waypoints_json = json.dumps([[lat, lng] for lat, lng in waypoints])
            
            # Prepare polyline positions for frontend
            polyline_positions = json.dumps(waypoints)
            
            return distance, duration, geometry, waypoints_json, polyline_positions, len(waypoints)
        else:
            raise ValueError("No geometry in OSRM response")
            
    except Exception as e:
        print(f"Error fetching full OSRM route: {e}")
        return None, None, None, None, None, 0

authority_bp = Blueprint("authority_bp", __name__)

# -------------------------
# Helper: Fallback Euclidean distance (only used if OSRM is unavailable)
# -------------------------
def distance(lat1, lon1, lat2, lon2):
    # Backward-compat shim: now uses haversine meters
    return haversine_m(lat1, lon1, lat2, lon2)

# -------------------------
# Helper: OSRM route distance/duration (driving)
# -------------------------
def osrm_route_distance_duration(src_lat, src_lon, dst_lat, dst_lon, timeout=3):
    """
    Calls OSRM (or your routing host) to get the driving route.
    Returns (distance_meters, duration_seconds).
    Raises on failure so caller can decide fallback/skip.
    """
    url = f"{OSRM_BASE_URL}/route/v1/driving/{src_lon},{src_lat};{dst_lon},{dst_lat}"
    params = {"overview": "false", "alternatives": "false"}
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    routes = data.get("routes") or []
    if not routes:
        raise ValueError("No route from OSRM")
    route = routes[0]
    return route.get("distance"), route.get("duration")


def fetch_osrm_alternative_routes(src_lat, src_lon, dst_lat, dst_lon, timeout=5):
    """
    Fetch route alternatives from OSRM.
    Returns a list with route geometry, duration and distance.
    """
    url = f"{OSRM_BASE_URL}/route/v1/driving/{src_lon},{src_lat};{dst_lon},{dst_lat}"
    params = {
        "overview": "full",
        "geometries": "polyline",
        "steps": "false",
        "alternatives": "true"
    }
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    routes = data.get("routes") or []
    if not routes:
        raise ValueError("No alternative routes from OSRM")

    return [
        {
            "geometry": r.get("geometry"),
            "distance": r.get("distance"),
            "duration": r.get("duration")
        }
        for r in routes
        if r.get("geometry") and r.get("distance") is not None and r.get("duration") is not None
    ]


def fetch_osrm_route_with_via(src_lat, src_lon, via_lat, via_lon, dst_lat, dst_lon, timeout=5):
    """
    Fetches route forcing a via waypoint to discover additional alternatives.
    """
    url = f"{OSRM_BASE_URL}/route/v1/driving/{src_lon},{src_lat};{via_lon},{via_lat};{dst_lon},{dst_lat}"
    params = {
        "overview": "full",
        "geometries": "polyline",
        "steps": "false",
        "alternatives": "false"
    }
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    routes = data.get("routes") or []
    if not routes:
        return None
    route = routes[0]
    if not route.get("geometry") or route.get("distance") is None or route.get("duration") is None:
        return None
    return {
        "geometry": route.get("geometry"),
        "distance": route.get("distance"),
        "duration": route.get("duration")
    }


def fetch_openrouteservice_alternatives(src_lat, src_lon, dst_lat, dst_lon, timeout=4):
    """
    Optional secondary provider. Requires OPENROUTESERVICE_API_KEY in env.
    Returns OSRM-compatible route candidates with encoded polyline geometry.
    """
    api_key = (os.getenv("OPENROUTESERVICE_API_KEY") or "").strip()
    if not api_key:
        return []

    # /json consistently returns "routes" with encoded geometry.
    url = "https://api.openrouteservice.org/v2/directions/driving-car/json"
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "coordinates": [[src_lon, src_lat], [dst_lon, dst_lat]],
        "alternative_routes": {"target_count": 3, "share_factor": 0.8},
        "instructions": False,
        "geometry": True,
        "units": "m"
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json() or {}
        routes = []

        # Shape A: /json endpoint => {"routes":[{"geometry":"encoded", "summary":{...}}]}
        json_routes = data.get("routes") or []
        for r in json_routes:
            summary = (r or {}).get("summary") or {}
            geometry = (r or {}).get("geometry")
            if not geometry:
                continue
            routes.append({
                "geometry": geometry,
                "distance": summary.get("distance"),
                "duration": summary.get("duration")
            })

        # Shape B: geojson-like => {"features":[{"geometry":{"coordinates":[...]}, "properties":{"summary":...}}]}
        features = data.get("features") or []
        for feature in features:
            coords = (((feature or {}).get("geometry") or {}).get("coordinates")) or []
            props = ((feature or {}).get("properties") or {})
            summary = props.get("summary") or {}
            if len(coords) < 2:
                continue
            latlng = [(pt[1], pt[0]) for pt in coords if isinstance(pt, list) and len(pt) == 2]
            if len(latlng) < 2:
                continue
            routes.append({
                "geometry": polyline.encode(latlng),
                "distance": summary.get("distance"),
                "duration": summary.get("duration")
            })

        valid = [r for r in routes if r["geometry"] and r["distance"] is not None and r["duration"] is not None]
        if valid:
            print(f"✅ ORS provided {len(valid)} route candidate(s)")
        return valid
    except Exception as e:
        print(f"⚠️ OpenRouteService fallback failed: {e}")
        return []


def build_additional_via_candidates(src_lat, src_lon, dst_lat, dst_lon):
    """
    Build deterministic via points around the middle corridor to probe additional routes.
    """
    mid_lat = (src_lat + dst_lat) / 2.0
    mid_lon = (src_lon + dst_lon) / 2.0
    d_lat = dst_lat - src_lat
    d_lon = dst_lon - src_lon
    span = math.sqrt(d_lat * d_lat + d_lon * d_lon)
    if span == 0:
        return []

    # Perpendicular unit vector
    p_lat = -d_lon / span
    p_lon = d_lat / span

    # Multiple corridor slices with increasing offsets to discover more alternatives.
    # cap keeps offsets reasonable in urban areas.
    base = min(max(span * 0.16, 0.0035), 0.028)
    scales = [base, base * 1.7, base * 2.4]
    ts = [0.35, 0.5, 0.65]

    via_points = []
    for t in ts:
        core_lat = src_lat + d_lat * t
        core_lon = src_lon + d_lon * t
        for s in scales:
            via_points.append((core_lat + p_lat * s, core_lon + p_lon * s))
            via_points.append((core_lat - p_lat * s, core_lon - p_lon * s))

    return via_points


def fetch_route_candidates_expanded(src_lat, src_lon, dst_lat, dst_lon, timeout=5):
    """
    Get base OSRM alternatives and enrich with via-constrained routes to increase
    chance of finding distinct low-traffic paths.
    """
    candidates = []
    seen_geometries = set()

    try:
        base_routes = fetch_osrm_alternative_routes(src_lat, src_lon, dst_lat, dst_lon, timeout=timeout)
        for route in base_routes:
            geom = route.get("geometry")
            if geom and geom not in seen_geometries:
                candidates.append(route)
                seen_geometries.add(geom)
        print(f"🧭 OSRM base candidates: {len(base_routes)}")
    except Exception:
        pass

    for via_lat, via_lon in build_additional_via_candidates(src_lat, src_lon, dst_lat, dst_lon):
        try:
            route = fetch_osrm_route_with_via(
                src_lat, src_lon, via_lat, via_lon, dst_lat, dst_lon, timeout=timeout
            )
            if not route:
                continue
            geom = route.get("geometry")
            if geom and geom not in seen_geometries:
                candidates.append(route)
                seen_geometries.add(geom)
            if len(candidates) >= 24:
                break
        except Exception:
            continue

    # Optional secondary API enrichment (OSRM remains mandatory primary).
    try:
        ors_routes = fetch_openrouteservice_alternatives(
            src_lat, src_lon, dst_lat, dst_lon, timeout=max(4, timeout)
        )
        for route in ors_routes:
            geom = route.get("geometry")
            if geom and geom not in seen_geometries:
                candidates.append(route)
                seen_geometries.add(geom)
        if ors_routes:
            print(f"🧭 ORS candidates merged: {len(ors_routes)}")
    except Exception:
        pass

    print(f"🛣️ Total unique route candidates: {len(candidates)}")
    return candidates


def _point_to_segment_distance_m(point, seg_start, seg_end):
    """
    Approximate point-to-segment distance in meters.
    Input coordinates are [lat, lng].
    """
    # Equirectangular projection around point latitude for robust local distance math.
    lat0 = math.radians(point[0])
    meter_per_deg_lat = 111320.0
    meter_per_deg_lng = 111320.0 * math.cos(lat0)

    px = point[1] * meter_per_deg_lng
    py = point[0] * meter_per_deg_lat
    x1 = seg_start[1] * meter_per_deg_lng
    y1 = seg_start[0] * meter_per_deg_lat
    x2 = seg_end[1] * meter_per_deg_lng
    y2 = seg_end[0] * meter_per_deg_lat

    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)

    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)


def _point_to_polyline_distance_m(point, polyline_points):
    if not polyline_points or len(polyline_points) < 2:
        return float("inf")
    best = float("inf")
    for idx in range(len(polyline_points) - 1):
        dist = _point_to_segment_distance_m(point, polyline_points[idx], polyline_points[idx + 1])
        if dist < best:
            best = dist
    return best


def _segment_to_segment_distance_m(a1, a2, b1, b2):
    """
    Approximate minimum distance between two line segments by endpoint-to-segment checks.
    Input points are [lat, lng].
    """
    return min(
        _point_to_segment_distance_m(a1, b1, b2),
        _point_to_segment_distance_m(a2, b1, b2),
        _point_to_segment_distance_m(b1, a1, a2),
        _point_to_segment_distance_m(b2, a1, a2),
    )


def _route_segment_to_polyline_distance_m(route_start, route_end, polyline_points):
    if not polyline_points or len(polyline_points) < 2:
        return float("inf")
    best = float("inf")
    for idx in range(len(polyline_points) - 1):
        traffic_start = polyline_points[idx]
        traffic_end = polyline_points[idx + 1]
        dist = _segment_to_segment_distance_m(route_start, route_end, traffic_start, traffic_end)
        if dist < best:
            best = dist
    return best


def _sample_points_on_route(route_points, step_m=25.0):
    """
    Densify route polyline so blocked checks don't miss curved or partial overlaps.
    Returns sampled [lat, lng] points along each segment.
    """
    if not route_points or len(route_points) < 2:
        return []

    sampled = []
    for idx in range(len(route_points) - 1):
        start = route_points[idx]
        end = route_points[idx + 1]
        seg_len = haversine_m(start[0], start[1], end[0], end[1])
        if seg_len <= 0:
            continue
        steps = max(1, int(seg_len / step_m))
        for i in range(steps + 1):
            t = i / steps
            lat = start[0] + (end[0] - start[0]) * t
            lng = start[1] + (end[1] - start[1]) * t
            sampled.append([lat, lng])
    return sampled


def _get_blocked_overlap_by_segment(
    route_points,
    blocked_segments,
    blocked_threshold_m=70.0
):
    """
    Returns per-blocked-segment overlapped route length in meters.
    A route segment contributes its full length when it is close enough to a blocked segment.
    """
    if not route_points or len(route_points) < 2 or not blocked_segments:
        return {}

    overlap_by_segment_id = {}
    for idx in range(len(route_points) - 1):
        start = route_points[idx]
        end = route_points[idx + 1]
        route_seg_len_m = haversine_m(start[0], start[1], end[0], end[1])

        for blocked in blocked_segments:
            blocked_id = blocked.get("id")
            if blocked_id is None:
                continue
            dist_m = _route_segment_to_polyline_distance_m(start, end, blocked["points"])
            if dist_m <= blocked_threshold_m:
                overlap_by_segment_id[blocked_id] = overlap_by_segment_id.get(blocked_id, 0.0) + route_seg_len_m

    return overlap_by_segment_id


def _is_route_hard_blocked(
    route_points,
    blocked_segments,
    blocked_threshold_m=90.0,
    sampled_point_threshold_m=100.0
):
    if not route_points or len(route_points) < 2 or not blocked_segments:
        return False

    # Strict discard: if any route segment comes close to a blocked segment, reject it.
    for idx in range(len(route_points) - 1):
        start = route_points[idx]
        end = route_points[idx + 1]
        for blocked in blocked_segments:
            dist_m = _route_segment_to_polyline_distance_m(start, end, blocked["points"])
            if dist_m <= blocked_threshold_m:
                return True

    # Additional dense-point check to catch missed overlaps.
    sampled_points = _sample_points_on_route(route_points, step_m=25.0)
    for pt in sampled_points:
        for blocked in blocked_segments:
            dist_m = _point_to_polyline_distance_m(pt, blocked["points"])
            if dist_m <= sampled_point_threshold_m:
                return True
    return False


def _get_route_blocking_segment_ids(
    route_points,
    blocked_segments,
    blocked_threshold_m=90.0,
    sampled_point_threshold_m=100.0
):
    if not route_points or len(route_points) < 2 or not blocked_segments:
        return []

    blocking_ids = set()
    for idx in range(len(route_points) - 1):
        start = route_points[idx]
        end = route_points[idx + 1]
        for blocked in blocked_segments:
            seg_id = blocked.get("id")
            if seg_id is None:
                continue
            dist_m = _route_segment_to_polyline_distance_m(start, end, blocked["points"])
            if dist_m <= blocked_threshold_m:
                blocking_ids.add(seg_id)

    # Dense-point check by segment id.
    sampled_points = _sample_points_on_route(route_points, step_m=25.0)
    for pt in sampled_points:
        for blocked in blocked_segments:
            seg_id = blocked.get("id")
            if seg_id is None:
                continue
            dist_m = _point_to_polyline_distance_m(pt, blocked["points"])
            if dist_m <= sampled_point_threshold_m:
                blocking_ids.add(seg_id)

    return sorted(list(blocking_ids))


def _load_active_traffic_segments():
    rows = TrafficSegment.query.filter_by(is_active=True).all()
    parsed = []
    for row in rows:
        try:
            geom = json.loads(row.geometry or "{}")
            if geom.get("type") != "LineString":
                continue
            coords = geom.get("coordinates") or []
            if len(coords) < 2:
                continue
            # Convert GeoJSON [lng, lat] -> [lat, lng]
            latlng = [[c[1], c[0]] for c in coords if isinstance(c, list) and len(c) == 2]
            if len(latlng) < 2:
                continue
            parsed.append({
                "id": row.id,
                "jam_level": (
                    "HIGH" if (row.jam_level or "MEDIUM").strip().upper() == "BLOCKED"
                    else (row.jam_level or "MEDIUM").strip().upper()
                ),
                "points": latlng
            })
        except Exception:
            continue
    return parsed


def evaluate_route_traffic_penalty(
    route_points,
    traffic_segments,
    proximity_threshold_m=75.0,
    blocked_threshold_m=120.0
):
    """
    Estimate route penalty in seconds by checking route segment midpoints against
    manually drawn traffic segments.
    """
    if not route_points or len(route_points) < 2 or not traffic_segments:
        return {
            "blocked": False,
            "penalty_seconds": 0.0,
            "jam_hit_counts": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "BLOCKED": 0}
        }

    # Extra delay per meter near each jam type.
    # Example: HIGH => 0.35 sec/m (~350 sec / km additional delay).
    jam_sec_per_meter = {
        "LOW": 0.06,
        "MEDIUM": 0.16,
        "HIGH": 0.35,
        "BLOCKED": 0.0
    }

    penalty_seconds = 0.0
    blocked = False
    jam_hit_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "BLOCKED": 0}
    jam_overlap_m = {"LOW": 0.0, "MEDIUM": 0.0, "HIGH": 0.0, "BLOCKED": 0.0}

    for idx in range(len(route_points) - 1):
        start = route_points[idx]
        end = route_points[idx + 1]
        segment_length_m = haversine_m(start[0], start[1], end[0], end[1])

        closest_level_for_segment = None
        closest_level_distance_m = float("inf")
        for traffic in traffic_segments:
            dist_m = _route_segment_to_polyline_distance_m(start, end, traffic["points"])
            level = traffic["jam_level"]

            # Blocked is strict: if route segment comes near blocked segment, reject route.
            if level == "BLOCKED" and dist_m <= blocked_threshold_m:
                jam_hit_counts["BLOCKED"] += 1
                jam_overlap_m["BLOCKED"] += segment_length_m
                blocked = True
                closest_level_for_segment = "BLOCKED"
                break

            if dist_m <= proximity_threshold_m:
                # Choose traffic level by nearest segment, not by highest severity nearby.
                if dist_m < closest_level_distance_m:
                    closest_level_distance_m = dist_m
                    closest_level_for_segment = level

        if blocked:
            break

        if closest_level_for_segment in jam_sec_per_meter:
            if closest_level_for_segment in jam_hit_counts:
                jam_hit_counts[closest_level_for_segment] += 1
            if closest_level_for_segment in jam_overlap_m:
                jam_overlap_m[closest_level_for_segment] += segment_length_m
            penalty_seconds += segment_length_m * jam_sec_per_meter[closest_level_for_segment]

    return {
        "blocked": blocked,
        "penalty_seconds": penalty_seconds,
        "jam_hit_counts": jam_hit_counts,
        "jam_overlap_m": jam_overlap_m
    }


def route_jam_severity_rank(jam_hit_counts, jam_overlap_m=None):
    """
    Lower rank is better.
    Requirement: if route is not present in simulation DB,
    treat it as LOW traffic by default.
    Effective ordering:
    1 = LOW (or no simulation hit), 2 = MEDIUM, 3 = HIGH
    """
    if not jam_hit_counts:
        return 1

    overlaps = jam_overlap_m or {}
    low_overlap = float(overlaps.get("LOW", 0.0) or 0.0)
    med_overlap = float(overlaps.get("MEDIUM", 0.0) or 0.0)
    high_overlap = float(overlaps.get("HIGH", 0.0) or 0.0)

    # Only classify as HIGH/MEDIUM when overlap is significant.
    # This avoids false "high" due to tiny proximity touches.
    if high_overlap >= 120.0:
        return 3
    if med_overlap >= 120.0:
        return 2

    total_overlap = low_overlap + med_overlap + high_overlap
    if total_overlap <= 0:
        return 1

    # Fallback dominance by overlap (not hit counts)
    if high_overlap > max(med_overlap, low_overlap):
        return 3
    if med_overlap > max(high_overlap, low_overlap):
        return 2
    return 1


def route_congestion_score(jam_overlap_m=None):
    """
    Convert overlap meters into a normalized congestion score.
    Lower is better.
    """
    overlaps = jam_overlap_m or {}
    low_overlap = float(overlaps.get("LOW", 0.0) or 0.0)
    med_overlap = float(overlaps.get("MEDIUM", 0.0) or 0.0)
    high_overlap = float(overlaps.get("HIGH", 0.0) or 0.0)

    total = low_overlap + med_overlap + high_overlap
    if total <= 0:
        # By default no simulation hit is treated as LOW.
        return 0.2

    return (
        (0.2 * low_overlap) +
        (0.6 * med_overlap) +
        (1.0 * high_overlap)
    ) / total

# -------------------------
# Add Unit (for 50% work)
# -------------------------
@authority_bp.route("/authority/add-unit", methods=["POST"])
@authority_required()
def add_unit():
    data = request.json
    if not all(k in data for k in ("service_type", "latitude", "longitude")):
        return jsonify({"error": "Missing fields"}), 400

    unit = Unit(
        service_type=data["service_type"],
        status="AVAILABLE",
        latitude=data["latitude"],
        longitude=data["longitude"]
    )

    db.session.add(unit)
    db.session.commit()

    return jsonify({"message": "Unit added", "unit_id": unit.unit_id})

# -------------------------
# Dispatch emergency (nearest available unit)
# -------------------------
@authority_bp.route("/authority/dispatch/<int:emergency_id>", methods=["POST"])
@authority_required()
def dispatch_emergency(emergency_id):
    _ensure_public_tracking_links_table()
    emergency = Emergency.query.get(emergency_id)

    if not emergency:
        return jsonify({"error": "Emergency not found"}), 404

    if emergency.status != "PENDING" and emergency.status != "APPROVED":
        return jsonify({"error": f"Emergency already {emergency.status}"}), 400

    # Get available units of same service type
    # Note: emergency.emergency_type should now be in uppercase format
    units = Unit.query.filter_by(
        service_type=emergency.emergency_type,
        status="AVAILABLE"
    ).all()
    
    print(f"🚨 Dispatch attempt for Emergency #{emergency.request_id} (Type: {emergency.emergency_type}) - Found {len(units)} available units")

    if not units:
        return jsonify({"error": "No available units"}), 404

    # Load active manual traffic simulation lines.
    traffic_segments = _load_active_traffic_segments()
    # BLOCKED level removed: treat any legacy BLOCKED entries as HIGH during load.
    blocked_segments = []

    # Step 1: Always pick the nearest available unit (within 50km cap).
    # Step 2: Optimize route alternatives for that selected nearest unit.
    unit_candidates = []
    nearest_raw_distance = None

    for u in units:
        try:
            # Keep nearest-unit selection fast and stable.
            # Use single distance/duration lookup per unit here.
            dist, dur = osrm_route_distance_duration(
                u.latitude,
                u.longitude,
                emergency.latitude,
                emergency.longitude,
            )
            if dist is None:
                continue

            if nearest_raw_distance is None or dist < nearest_raw_distance:
                nearest_raw_distance = dist

            if dist <= MAX_DISTANCE_METERS:
                unit_candidates.append({
                    "unit": u,
                    "distance": dist,
                    "duration": dur
                })
        except Exception:
            # OSRM failed for this candidate, use haversine fallback.
            euclid = distance(
                emergency.latitude,
                emergency.longitude,
                u.latitude,
                u.longitude,
            )

            if nearest_raw_distance is None or euclid < nearest_raw_distance:
                nearest_raw_distance = euclid

            if euclid <= MAX_DISTANCE_METERS:
                unit_candidates.append({
                    "unit": u,
                    "distance": euclid,
                    "duration": None
                })

    if not unit_candidates:
        return jsonify({
            "error": "No available units within 50 km",
            "nearest_distance_m": nearest_raw_distance
        }), 400

    # Nearest unit is always selected.
    selected_unit_candidate = min(unit_candidates, key=lambda c: c["distance"])
    nearest_unit = selected_unit_candidate["unit"]

    # For selected nearest unit, choose best route by traffic-aware score.
    best = {
        "unit": nearest_unit,
        "distance": selected_unit_candidate["distance"],
        "duration": selected_unit_candidate["duration"],
        "geometry": None,
        "polyline_points": None,
        "traffic_penalty_seconds": 0.0,
        "traffic_score": selected_unit_candidate["duration"] or (selected_unit_candidate["distance"] / 10.0),
        "jam_hit_counts": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "BLOCKED": 0}
    }

    try:
        alt_routes = fetch_route_candidates_expanded(
            nearest_unit.latitude,
            nearest_unit.longitude,
            emergency.latitude,
            emergency.longitude,
        )

        non_blocked_candidates = []
        fallback_shortest = None
        blocking_segment_ids_all = set()
        checked_route_count = 0
        blocked_route_count = 0

        for route in alt_routes:
            checked_route_count += 1
            dist = route.get("distance")
            dur = route.get("duration")
            geometry = route.get("geometry")
            if dist is None or dur is None or not geometry:
                continue
            if dist > MAX_DISTANCE_METERS:
                continue

            if fallback_shortest is None or dur < fallback_shortest["duration"]:
                fallback_shortest = {"distance": dist, "duration": dur, "geometry": geometry}

            decoded_points = polyline.decode(geometry)

            # Hard block exclusion: never allow blocked-simulation overlap.
            route_blocking_ids = _get_route_blocking_segment_ids(
                decoded_points,
                blocked_segments,
                blocked_threshold_m=90.0,
                sampled_point_threshold_m=100.0
            )
            if route_blocking_ids:
                blocking_segment_ids_all.update(route_blocking_ids)
                blocked_route_count += 1
                continue

            traffic_eval = evaluate_route_traffic_penalty(decoded_points, traffic_segments)
            if traffic_eval["blocked"]:
                continue

            # Cap simulated penalty so route quality improves without unrealistic jumps.
            effective_penalty = min(traffic_eval["penalty_seconds"], dur * 0.35)
            traffic_score = dur + effective_penalty
            jam_rank = route_jam_severity_rank(
                traffic_eval["jam_hit_counts"],
                traffic_eval.get("jam_overlap_m")
            )

            candidate_route = {
                "distance": dist,
                "duration": dur,
                "geometry": geometry,
                "polyline_points": decoded_points,
                "traffic_penalty_seconds": effective_penalty,
                "traffic_score": traffic_score,
                "jam_rank": jam_rank,
                "jam_hit_counts": traffic_eval["jam_hit_counts"],
                "jam_overlap_m": traffic_eval.get("jam_overlap_m", {})
            }

            non_blocked_candidates.append(candidate_route)

        if non_blocked_candidates:
            # Step 1: Route class priority after blocked routes are discarded.
            # 1 = LOW/default (not in DB), 2 = MEDIUM, 3 = HIGH
            min_rank = min(c.get("jam_rank", 3) for c in non_blocked_candidates)
            ranked_candidates = [c for c in non_blocked_candidates if c.get("jam_rank", 3) == min_rank]

            durations = [c["duration"] for c in non_blocked_candidates]
            congestion_scores = [route_congestion_score(c.get("jam_overlap_m")) for c in non_blocked_candidates]
            ranked_durations = [c["duration"] for c in ranked_candidates]
            ranked_congestion_scores = [route_congestion_score(c.get("jam_overlap_m")) for c in ranked_candidates]

            min_dur, max_dur = min(durations), max(durations)
            min_cong, max_cong = min(congestion_scores), max(congestion_scores)
            min_rank_dur, max_rank_dur = min(ranked_durations), max(ranked_durations)
            min_rank_cong, max_rank_cong = min(ranked_congestion_scores), max(ranked_congestion_scores)

            traffic_weight = 0.55
            duration_weight = 0.45

            def norm(value, lo, hi):
                if hi <= lo:
                    return 0.0
                return (value - lo) / (hi - lo)

            for idx, candidate in enumerate(ranked_candidates):
                dur_norm = norm(candidate["duration"], min_rank_dur, max_rank_dur)
                cong = ranked_congestion_scores[idx]
                cong_norm = norm(cong, min_rank_cong, max_rank_cong)
                candidate["combined_cost"] = (traffic_weight * cong_norm) + (duration_weight * dur_norm)
                candidate["congestion_score"] = cong

            # Final selection from ranked candidates by combined cost.
            ordered_candidates = sorted(
                ranked_candidates,
                key=lambda c: (c["combined_cost"], c["traffic_score"])
            )
            selected = None
            for candidate in ordered_candidates:
                candidate_blocking_ids = _get_route_blocking_segment_ids(
                    candidate.get("polyline_points") or [],
                    blocked_segments,
                    blocked_threshold_m=90.0,
                    sampled_point_threshold_m=100.0
                )
                if candidate_blocking_ids:
                    blocking_segment_ids_all.update(candidate_blocking_ids)
                    blocked_route_count += 1
                    continue
                selected = candidate
                break
            if selected is None:
                # All class-ranked candidates still intersect blocked paths.
                # Fall through to blocked handling below.
                non_blocked_candidates = []

            # Preference tweak:
            # If the shortest candidate is LOW/default traffic and near-optimal by combined cost,
            # select it to keep responses naturally fast in low-jam conditions.
            if selected is not None:
                shortest_candidate = min(non_blocked_candidates, key=lambda c: c["duration"])
                if shortest_candidate.get("jam_rank", 3) <= 1:
                    selected_cost = selected.get("combined_cost", 1.0)
                    shortest_cost = shortest_candidate.get("combined_cost", 1.0)
                    # within 8% cost gap, prefer shortest low-traffic route
                    if shortest_cost <= (selected_cost + 0.08):
                        selected = shortest_candidate

                best.update(selected)
        elif fallback_shortest is not None:
            # Rescue pass:
            # Re-check all alternatives with tighter blocked thresholds to identify
            # routes that are effectively unmarked (treated as LOW by default).
            rescue_candidates = []
            for route in alt_routes:
                dist = route.get("distance")
                dur = route.get("duration")
                geometry = route.get("geometry")
                if dist is None or dur is None or not geometry:
                    continue
                if dist > MAX_DISTANCE_METERS:
                    continue
                decoded_points = polyline.decode(geometry)
                rescue_block_ids = _get_route_blocking_segment_ids(
                    decoded_points,
                    blocked_segments,
                    blocked_threshold_m=90.0,
                    sampled_point_threshold_m=100.0
                )
                if rescue_block_ids:
                    continue
                traffic_eval = evaluate_route_traffic_penalty(decoded_points, traffic_segments)
                jam_rank = route_jam_severity_rank(
                    traffic_eval.get("jam_hit_counts", {}),
                    traffic_eval.get("jam_overlap_m")
                )
                rescue_candidates.append({
                    "distance": dist,
                    "duration": dur,
                    "geometry": geometry,
                    "polyline_points": decoded_points,
                    "traffic_penalty_seconds": min(traffic_eval.get("penalty_seconds", 0.0), dur * 0.35),
                    "traffic_score": dur + min(traffic_eval.get("penalty_seconds", 0.0), dur * 0.35),
                    "jam_rank": jam_rank,
                    "jam_hit_counts": traffic_eval.get("jam_hit_counts", {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "BLOCKED": 0}),
                    "jam_overlap_m": traffic_eval.get("jam_overlap_m", {})
                })

            if rescue_candidates:
                rescue_selected = min(rescue_candidates, key=lambda c: (c["jam_rank"], c["traffic_score"]))
                best.update(rescue_selected)
            else:
                # Final safe fallback:
                # Do not select a blocked polyline route. Dispatch still proceeds without route geometry.
                best.update({
                    "distance": selected_unit_candidate["distance"],
                    "duration": selected_unit_candidate["duration"],
                    "geometry": None,
                    "polyline_points": None,
                    "traffic_penalty_seconds": 0.0,
                    "traffic_score": selected_unit_candidate["duration"] or (selected_unit_candidate["distance"] / 10.0),
                    "jam_hit_counts": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "BLOCKED": 0},
                    "jam_overlap_m": {"LOW": 0.0, "MEDIUM": 0.0, "HIGH": 0.0, "BLOCKED": 0.0}
                })
    except Exception as e:
        print(f"⚠️ Could not compute route alternatives for selected nearest unit {nearest_unit.unit_id}: {e}")

    # Use the already selected traffic-aware route geometry.
    route_geometry = best.get("geometry")
    full_distance = best.get("distance")
    full_duration = best.get("duration")
    waypoints_json = None
    polyline_positions = None
    waypoint_count = 0

    if route_geometry:
        try:
            waypoints = polyline.decode(route_geometry)
            if len(waypoints) > 245:
                step = len(waypoints) / 245
                waypoints = [waypoints[int(i * step)] for i in range(245)]
            waypoints_json = json.dumps([[lat, lng] for lat, lng in waypoints])
            polyline_positions = json.dumps(waypoints)
            waypoint_count = len(waypoints)
        except Exception as e:
            print(f"⚠️ Failed to decode selected route geometry for Emergency #{emergency.request_id}: {e}")

    # 🔧 CRITICAL: Ensure fresh route progress for new emergency dispatch
    # Clear any existing route calculations for this unit (from previous emergencies)
    RouteCalculation.deactivate_routes_for_unit(nearest_unit.unit_id)
    
    # Update statuses
    nearest_unit.status = "DISPATCHED"
    nearest_unit.last_updated = datetime.utcnow()

    emergency.status = "ASSIGNED"
    emergency.assigned_unit = nearest_unit.unit_id
    emergency.approved_by = "Central Authority"

    # Store route calculation with cached waypoints (Phase 1)
    route_calc = RouteCalculation(
        unit_id=nearest_unit.unit_id,
        emergency_id=emergency.request_id,
        osrm_response=json.dumps({
            "full_route_distance": full_distance,
            "full_route_duration": full_duration,
            "original_distance": best["distance"],
            "original_duration": best["duration"],
            "traffic_penalty_seconds": best.get("traffic_penalty_seconds", 0.0),
            "traffic_score": best.get("traffic_score"),
            "jam_hit_counts": best.get("jam_hit_counts", {})
        }),
        route_geometry=route_geometry,
        distance=full_distance,
        duration=full_duration,
        profile='driving',
        cached_waypoints=waypoints_json,
        polyline_positions=polyline_positions,
        waypoint_count=waypoint_count,
        start_latitude=nearest_unit.latitude,
        start_longitude=nearest_unit.longitude,
        end_latitude=emergency.latitude,
        end_longitude=emergency.longitude,
        is_active=True
    )
    
    db.session.add(route_calc)
    db.session.commit()

    # Reporter SMS: generate/store tracking link only if reporter phone exists.
    sms_sent = False
    sms_message = "No reporter phone for this emergency"
    tracking_token = None
    tracking_url = None
    reporter_contact = EmergencyReporterContact.query.filter_by(emergency_id=emergency.request_id).first()
    if reporter_contact and reporter_contact.reporter_phone:
        tracking_token = _build_tracking_token(emergency.request_id)
        tracking_url = f"{_normalized_frontend_base_url()}/track/{tracking_token}"
        tracking_link = PublicTrackingLink.query.filter_by(tracking_token=tracking_token).first()
        if tracking_link:
            tracking_link.emergency_id = emergency.request_id
            tracking_link.tracking_url = tracking_url
            tracking_link.is_active = True
            tracking_link.revoked_at = None
        else:
            db.session.add(PublicTrackingLink(
                emergency_id=emergency.request_id,
                tracking_token=tracking_token,
                tracking_url=tracking_url,
                is_active=True
            ))
        db.session.commit()

        driver = _resolve_unit_driver(nearest_unit.unit_id)
        sms_service = SMSService()
        sms_sent, sms_message = sms_service.send_assigned_tracking_message(
            to_phone=reporter_contact.reporter_phone,
            request_id=emergency.request_id,
            tracking_url=tracking_url,
            unit_plate=nearest_unit.unit_vehicle_number,
            driver_name=driver.get("name") if driver else None,
            driver_phone=driver.get("phone") if driver else None
        )

    # Send notifications
    create_emergency_notification(emergency, 'assigned')
    create_unit_notification(nearest_unit, 'dispatched', emergency=emergency)

    # Emit real-time events for emergency dispatch
    emergency_data = {
        'request_id': emergency.request_id,
        'emergency_type': emergency.emergency_type,
        'latitude': emergency.latitude,
        'longitude': emergency.longitude,
        'status': emergency.status,
        'approved_by': emergency.approved_by,
        'assigned_unit': emergency.assigned_unit,
        'created_at': emergency.created_at.isoformat() if emergency.created_at else None,
        # Phase 1: Include cached route positions for polyline
        'route_positions': json.loads(polyline_positions) if polyline_positions else None,
        'waypoint_count': waypoint_count,
        'route_calculation_id': route_calc.id
    }
    
    unit_data = {
        'unit_id': nearest_unit.unit_id,
        'service_type': nearest_unit.service_type,
        'status': nearest_unit.status,
        'latitude': nearest_unit.latitude,
        'longitude': nearest_unit.longitude,
        'emergency_id': emergency.request_id
    }
    
    # Broadcast emergency update to all clients
    socketio.emit('emergency_updated', {
        'action': 'assigned',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_info': {
            'positions': emergency_data['route_positions'],
            'waypoint_count': waypoint_count,
            'distance': full_distance,
            'duration': full_duration
        },
        'route_progress_reset': {
            'unit_id': nearest_unit.unit_id,
            'emergency_id': emergency.request_id,
            'reset_reason': 'new_emergency_dispatch',
            'fresh_start': True,
            'timestamp': datetime.utcnow().isoformat()
        }
    })
    
    # Broadcast to unit tracking room
    socketio.emit('emergency_update', {
        'action': 'assigned',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_info': {
            'positions': emergency_data['route_positions'],
            'waypoint_count': waypoint_count,
            'distance': full_distance,
            'duration': full_duration
        },
        'route_progress_reset': {
            'unit_id': nearest_unit.unit_id,
            'emergency_id': emergency.request_id,
            'reset_reason': 'new_emergency_dispatch',
            'fresh_start': True,
            'timestamp': datetime.utcnow().isoformat()
        }
    }, room='unit_tracking')
    
    # Update unit status
    socketio.emit('unit_status_update', {
        'unit_id': nearest_unit.unit_id,
        'status': 'DISPATCHED',
        'emergency_id': emergency.request_id,
        'assigned_emergency': emergency_data,
        'route_info': {
            'positions': emergency_data['route_positions'],
            'waypoint_count': waypoint_count
        },
        'route_progress_reset': {
            'unit_id': nearest_unit.unit_id,
            'emergency_id': emergency.request_id,
            'reset_reason': 'new_emergency_dispatch',
            'fresh_start': True,
            'timestamp': datetime.utcnow().isoformat()
        }
    })
    
    print(f"🔄 Fresh dispatch: Emergency #{emergency.request_id} dispatched to Unit {nearest_unit.unit_id} with {waypoint_count} cached waypoints - route progress reset to 0%")

    return jsonify({
        "message": "Emergency dispatched successfully",
        "emergency_id": emergency.request_id,
        "assigned_unit_id": nearest_unit.unit_id,
        "distance_m": full_distance,
        "eta_s": full_duration,
        "waypoint_count": waypoint_count,
        "route_positions": emergency_data['route_positions'],
        "route_calculation_id": route_calc.id,
        "routing_source": "osrm_full_geometry" if waypoint_count > 0 else "euclidean_fallback",
        "public_tracking_token": tracking_token,
        "public_tracking_url": tracking_url,
        "reporter_sms_sent": sms_sent,
        "reporter_sms_message": sms_message
    })

# -------------------------
# Complete emergency (release unit)
# -------------------------
@authority_bp.route("/authority/complete/<int:emergency_id>", methods=["POST"])
@authority_required()
def complete_emergency(emergency_id):
    emergency = Emergency.query.get(emergency_id)
    if not emergency:
        return jsonify({"error": "Emergency not found"}), 404
    if emergency.status != "ASSIGNED":
        return jsonify({"error": "Emergency not assigned yet"}), 400

    # Release unit
    unit = Unit.query.get(emergency.assigned_unit)
    if unit:
        unit.status = "AVAILABLE"
        unit.last_updated = datetime.utcnow()

    emergency.status = "COMPLETED"
    db.session.commit()

    # Send notifications
    create_emergency_notification(emergency, 'completed')
    create_unit_notification(unit, 'completed', emergency=emergency)

    # Clean up route calculations for this emergency using the new model method
    routes_cleared = RouteCalculation.deactivate_routes_for_emergency(emergency.request_id)
    
    # Emit real-time events for emergency completion
    emergency_data = {
        'request_id': emergency.request_id,
        'emergency_type': emergency.emergency_type,
        'latitude': emergency.latitude,
        'longitude': emergency.longitude,
        'status': emergency.status,
        'approved_by': emergency.approved_by,
        'assigned_unit': emergency.assigned_unit,
        'created_at': emergency.created_at.isoformat() if emergency.created_at else None,
        'completed_at': datetime.utcnow().isoformat()
    }
    
    unit_data = {
        'unit_id': unit.unit_id,
        'service_type': unit.service_type,
        'status': unit.status,
        'latitude': unit.latitude,
        'longitude': unit.longitude
    }
    
    # Broadcast emergency completion to all clients
    socketio.emit('emergency_updated', {
        'action': 'completed',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_reset_info': {
            'emergency_id': emergency.request_id,
            'unit_id': unit.unit_id,
            'routes_cleared': routes_cleared,
            'reset_timestamp': datetime.utcnow().isoformat()
        }
    })
    
    # Broadcast to unit tracking room
    socketio.emit('emergency_update', {
        'action': 'completed',
        'emergency': emergency_data,
        'unit': unit_data,
        'route_reset_info': {
            'emergency_id': emergency.request_id,
            'unit_id': unit.unit_id,
            'routes_cleared': routes_cleared,
            'reset_timestamp': datetime.utcnow().isoformat()
        }
    }, room='unit_tracking')
    
    # Update unit status back to available
    socketio.emit('unit_status_update', {
        'unit_id': unit.unit_id,
        'status': 'AVAILABLE',
        'emergency_id': emergency.request_id,
        'completed_emergency': emergency_data,
        'route_reset_info': {
            'emergency_id': emergency.request_id,
            'unit_id': unit.unit_id,
            'routes_cleared': routes_cleared,
            'reset_timestamp': datetime.utcnow().isoformat()
        }
    })
    
    # Send specific route progress reset event
    socketio.emit('route_progress_reset', {
        'unit_id': unit.unit_id,
        'emergency_id': emergency.request_id,
        'reset_reason': 'emergency_completed',
        'routes_cleared': routes_cleared,
        'timestamp': datetime.utcnow().isoformat(),
        'ready_for_new_assignment': True
    }, room='unit_tracking')
    
    print(f"🔄 Route progress reset: Emergency #{emergency.request_id} completed, Unit {unit.unit_id} cleared {routes_cleared} route calculations")

    return jsonify({
        "message": f"Emergency {emergency.request_id} completed and unit {unit.unit_id} is now available"
    })

# -------------------------
# Get all units (dashboard view)
# -------------------------
@authority_bp.route("/authority/units", methods=["GET"])
@authority_required()
def get_units():
    page_arg = request.args.get("page")
    per_page_arg = request.args.get("per_page")

    # Backward compatibility: return full array when pagination is not requested.
    if page_arg is None and per_page_arg is None:
        units = Unit.query.all()
        data = []
        for u in units:
            data.append({
                "unit_id": u.unit_id,
                "unit_vehicle_number": u.unit_vehicle_number,
                "service_type": u.service_type,
                "status": u.status,
                "latitude": u.latitude,
                "longitude": u.longitude,
                "last_updated": u.last_updated
            })
        return jsonify(data)

    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)
    page = max(1, page)
    per_page = max(1, min(per_page, 100))

    query = Unit.query.order_by(Unit.unit_id.asc())
    total = query.count()
    total_pages = max(1, math.ceil(total / per_page)) if total else 1
    page = min(page, total_pages)
    offset = (page - 1) * per_page

    units = query.offset(offset).limit(per_page).all()
    data = []
    for u in units:
        data.append({
            "unit_id": u.unit_id,
            "unit_vehicle_number": u.unit_vehicle_number,
            "service_type": u.service_type,
            "status": u.status,
            "latitude": u.latitude,
            "longitude": u.longitude,
            "last_updated": u.last_updated
        })

    return jsonify({
        "data": data,
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    })

# -------------------------
# Get all emergencies (dashboard view)
# -------------------------
@authority_bp.route("/authority/emergencies", methods=["GET"])
@authority_required()
def get_emergencies():
    emergencies = Emergency.query.all()
    data = []
    for e in emergencies:
        data.append({
            "request_id": e.request_id,
            "emergency_type": e.emergency_type,
            "latitude": e.latitude,
            "longitude": e.longitude,
            "status": e.status,
            "approved_by": e.approved_by,
            "assigned_unit": e.assigned_unit,
            "created_at": e.created_at
        })
    
    return jsonify(data)
