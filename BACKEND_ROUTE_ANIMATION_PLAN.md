# Backend-Driven Route Animation Plan

## Objective
Modify the frontend unit tracking animation to use backend-calculated route data instead of OSRM frontend calculations.

## Current Backend Capabilities
The backend already provides:
- `polyline_positions`: Full route coordinates from database
- `current_position`: Backend-calculated current position
- `progress`: Time-based progress calculation (0.0 to 1.0)
- `estimated_duration` and `total_distance`
- Route data via `/active-unit-routes` endpoint

## Implementation Plan

### 1. Simplify UnitsTracking.js
- Remove OSRM route fetching and geometry calculations
- Remove RouteMovementController and RouteGeometryManager dependencies
- Use backend `/active-unit-routes` endpoint directly
- Use backend-provided polylines_position for map rendering
- Use backend-provided progress for animation timing

### 2. Simplify RealtimeMapView.js
- Remove RouteMovementController integration
- Remove complex route-following logic
- Use backend-provided positions and progress directly
- Simplify AnimatedPolyline to use backend data

### 3. Create BackendRouteManager.js
- New utility to handle backend route data
- Manage progress updates from backend
- Handle real-time progress synchronization

### 4. Remove Frontend Route Calculations
- Remove RouteGeometryManager OSRM processing
- Remove GPS snapping logic
- Remove RouteAnimationManager complex logic
- Simplify animation to use backend timing

### 5. Update Animation Flow
```
Backend Database → RouteCalculation → /active-unit-routes API → Frontend Rendering
     ↓                    ↓                    ↓                   ↓
polyline_positions → progress calc → React state → Direct rendering
```

## Benefits
- **Consistent Route Data**: Backend ensures all units use same route calculations
- **Performance**: No frontend OSRM calculations needed
- **Accuracy**: Backend handles all route geometry and progress
- **Simplicity**: Frontend just renders what backend provides
- **Real-time Sync**: Backend progress calculation is authoritative

## Files to Modify
1. `UnitsTracking.js` - Remove OSRM logic, use backend API
2. `RealtimeMapView.js` - Simplify polyline rendering
3. `RouteMovementController.js` - Remove or significantly simplify
4. `useRouteFollowing.js` - Remove complex route following
5. Create `BackendRouteManager.js` - Handle backend data

## Files to Remove/Deprecate
- Complex GPS snapping logic
- OSRM route calculations
- Route geometry processing
