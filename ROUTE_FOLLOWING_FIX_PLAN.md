# Route Following Fix Implementation Plan

## Problem Identified
Routes are fetched correctly from OSRM (showing realistic paths) but unit markers still move in straight lines because they use raw GPS coordinates instead of snapped positions.

## Solution Overview
Integrate existing GPS snapping utilities into the main tracking flow to snap raw GPS coordinates to route paths.

## Implementation Steps

### 1. UnitsTracking.js Enhancements
- [ ] Add GPS snapping imports (QuickGPSFix, RouteGeometryManager)
- [ ] Initialize GPS snapper components
- [ ] Add helper function to find route data for units
- [ ] Modify WebSocket unit location update handler to apply GPS snapping
- [ ] Ensure snapped coordinates are used for marker positioning

### 2. WebSocket Integration
- [ ] Enhance unit location update handler with GPS snapping
- [ ] Add logging for GPS snapping decisions
- [ ] Ensure real-time updates use snapped positions

### 3. Route Following System
- [ ] Connect GPS snapping with route animation system
- [ ] Ensure marker positions follow route paths
- [ ] Test route progress tracking

### 4. Testing & Validation
- [ ] Verify routes show realistic paths (not straight lines)
- [ ] Confirm markers follow road networks
- [ ] Test GPS snapping accuracy

## Expected Results
- Unit markers will follow actual roads instead of moving in straight lines
- Real-time tracking will show realistic movement along routes
- GPS snapping will improve location accuracy by snapping to road networks

## Files to Modify
1. `frontend/src/pages/UnitsTracking.js` - Main integration point
2. `frontend/src/hooks/useWebSocketWithGPSSnapping.js` - Enhanced WebSocket hook
3. Potentially other tracking components

## Key Components Used
- `QuickGPSFix` - GPS snapping utility
- `RouteGeometryManager` - Route geometry processing
- OSRM route data from routeCache
- Existing WebSocket tracking system
