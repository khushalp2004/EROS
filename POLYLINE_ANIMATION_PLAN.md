# Polylines Position Route Animation Implementation Plan

## Objective
Replace current start/end point route simulation with database-driven polylines_position for realistic route animation of units.

## Current System Analysis
- ✅ Database already has `polylines_position` field in `RouteCalculation` model
- ✅ Backend stores OSRM route coordinates when dispatching emergencies
- ❌ Frontend currently calls OSRM API directly instead of using cached data
- ❌ Routes are drawn as straight lines instead of using actual road paths

## Implementation Plan

### 1. Backend Enhancements
#### 1.1 New Endpoint for Polylines Data
- Create `/authority/unit-routes/<unit_id>` endpoint
- Fetch polylines_position from RouteCalculation table
- Return structured route data for animation

#### 1.2 Enhanced Unit Route Data
```javascript
{
  unit_id: 1,
  emergency_id: 123,
  route_positions: [[lat1, lng1], [lat2, lng2], ...], // from polylines_position
  progress: 0.45, // current progress along route (0-1)
  total_distance: 12500, // meters
  estimated_duration: 450, // seconds
  start_time: "2024-01-15T10:30:00Z",
  current_segment: 2
}
```

### 2. Frontend Modifications
#### 2.1 UnitsTracking.js Changes
- Remove OSRM API calls (fetchRoute function)
- Add new API call to fetch polylines_position data
- Update routePolylines to use database coordinates
- Implement progress-based animation along stored route

#### 2.2 Route Animation Logic
- Use stored polylines_position coordinates
- Calculate progress based on time elapsed since dispatch
- Animate unit marker along the actual road path
- Update polyline to show traveled portion vs remaining

### 3. Real-time Updates
#### 3.1 WebSocket Integration
- Send polylines_position data via WebSocket on emergency dispatch
- Update progress in real-time as units move
- Sync animation across all connected clients

#### 3.2 Progress Calculation
```javascript
// Calculate progress based on time elapsed
const dispatchTime = new Date(emergency_dispatched_at);
const currentTime = new Date();
const elapsedSeconds = (currentTime - dispatchTime) / 1000;
const progress = Math.min(elapsedSeconds / estimated_duration, 1.0);
```

### 4. Database Schema (Already Exists)
- `RouteCalculation.polyline_positions` - stores the route coordinates
- `RouteCalculation.waypoint_count` - number of waypoints
- `RouteCalculation.distance` - total route distance
- `RouteCalculation.duration` - estimated duration

### 5. Implementation Steps
1. **Create new backend endpoint** for fetching unit route data
2. **Update UnitsTracking.js** to use polylines_position instead of OSRM calls
3. **Implement progress calculation** based on dispatch time
4. **Add real-time progress updates** via WebSocket
5. **Test route animation** with actual database data

### 6. Benefits
- ✅ Realistic routes following actual roads
- ✅ No external API dependencies for route data
- ✅ Faster loading (cached coordinates)
- ✅ Consistent animations across clients
- ✅ Better performance (no real-time OSRM calls)

### 7. Fallback Strategy
- If polylines_position is missing, fall back to straight line
- Use start/end points only when database route is unavailable
- Maintain backward compatibility with existing system

## Success Metrics
- Routes display actual road paths instead of straight lines
- Units animate smoothly along stored coordinates
- Real-time progress updates work correctly
- No external API calls needed for route geometry
- Animation speed matches estimated duration
