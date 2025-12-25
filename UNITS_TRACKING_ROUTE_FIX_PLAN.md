# Units Tracking Route Fix Plan

## Problem Analysis
The Dashboard correctly shows colored routes on actual roads (like Blinkit) using OSRM API, but UnitsTracking shows static straight lines instead of realistic on-road routes.

## Solution Plan

### 1. Add Route Cache State
- Add `routeCache` state to store realistic route coordinates
- Add `animationKey` state for route animation control

### 2. Implement Real Route Fetching
- Add OSRM API integration for real road routes
- Convert coordinates from [lon, lat] to [lat, lon] format
- Handle fallback to straight lines when OSRM fails

### 3. Enhance Route Polylines
- Update route polylines to use realistic routes from routeCache
- Add animation progress tracking
- Add proper color coding based on service type

### 4. Add Animation Controls
- Add `animateRoutes` prop to RealtimeMapView
- Add animation progress calculation
- Add visual indicators for animated routes

### 5. Update Route Display Logic
- Filter routes based on tracking mode (all/selected/simulated)
- Show real-time route updates
- Add route statistics and ETA calculations

### 6. Testing & Validation
- Test route fetching with various coordinates
- Verify animation works in all tracking modes
- Confirm color coding matches Dashboard implementation

## Files to Modify
1. `/Users/khushalpatil/Desktop/EROS/frontend/src/pages/UnitsTracking.js` - Main implementation

## Expected Result
UnitsTracking will show realistic road routes with proper animation, just like Dashboard and apps like Blinkit.
