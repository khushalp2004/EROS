# Dashboard Map Enhancement Plan

## Objective
Transform the dashboard mapview from static to dynamic with colored region routes, tracking animations, and service emojis on routes.

## Current State Analysis
- Dashboard.js uses RealtimeMapView component
- Routes are calculated but may not be displaying properly
- Service emojis exist on unit markers but not on routes
- Route colors are defined but may not be applying correctly
- Animation system exists but may not be triggered properly

## Enhancement Plan

### 1. Enhanced Route Visualization
- **Colored Route Lines**: Implement proper colored polylines for each service type
  - Ambulance: Red (#dc3545)
  - Police: Blue (#0d6efd) 
  - Fire: Orange (#fd7e14)
  - Other: Gray (#6c757d)

### 2. Route Animation System
- **Progressive Route Drawing**: Routes animate from source to destination
- **Moving Vehicle Animation**: Service emojis move along routes
- **Route Progress Indicator**: Show completion percentage
- **Pulse Effects**: Highlight active routes

### 3. Service Emoji Integration
- **Route Service Indicators**: Show service emojis directly on routes
- **Moving Service Markers**: Animated emojis following route paths
- **Route Start/End Markers**: Clear indicators with service type emojis

### 4. Visual Improvements
- **Enhanced Route Styling**: Thicker lines, better visibility
- **Route Legends**: Clear color coding for different services
- **Real-time Status**: Live connection and tracking indicators
- **Better Marker Positioning**: Improved z-indexing for route elements

## Implementation Steps

### Step 1: Enhanced Route Calculation
- Fix route polyline generation in Dashboard.js
- Ensure proper coordinate conversion (OSRM returns [lon, lat])
- Add route caching for performance

### Step 2: Route Animation System
- Implement progressive route drawing
- Add moving service emoji markers
- Create route progress indicators
- Add pulse effects for active routes

### Step 3: Visual Enhancements
- Improve route line styling and colors
- Add service emojis to route markers
- Enhance map legend
- Add real-time status indicators

### Step 4: Performance Optimization
- Optimize animation performance
- Reduce unnecessary re-renders
- Implement efficient route caching
- Add proper cleanup for animations

## Technical Requirements
- Preserve existing WebSocket real-time functionality
- Maintain responsive design
- Ensure cross-browser compatibility
- Add proper error handling for route fetching

## Success Metrics
- Routes display with correct colors for each service type
- Smooth animation of routes being drawn
- Service emojis visible and moving along routes
- Real-time tracking works seamlessly
- Map remains responsive and performant
