# Dashboard Map Enhancement Implementation Plan

## Current Issues Identified
1. **Static Route Display**: Routes calculated but not animating properly
2. **Missing Service Emojis on Routes**: Emojis only on unit markers, not on route paths
3. **Inconsistent Route Colors**: Colors defined but may not be applying correctly
4. **Animation System**: Exists but not triggering properly

## Implementation Strategy

### Phase 1: Fix Route Visualization
1. **Enhanced Route Calculation** - Fix coordinate conversion and caching
2. **Colored Route Lines** - Implement proper service-based coloring
3. **Route Animation System** - Progressive drawing with moving emojis

### Phase 2: Service Emoji Integration
1. **Moving Service Markers** - Emojis that follow route paths
2. **Route Service Indicators** - Static emojis showing service type on routes
3. **Enhanced Animation** - Smooth movement along route paths

### Phase 3: Visual Improvements
1. **Better Route Styling** - Thicker lines, better visibility
2. **Enhanced Legends** - Clear service type indicators
3. **Real-time Status** - Live tracking indicators

## Files to Modify
1. **Dashboard.js** - Fix route polylines calculation and animation triggers
2. **RealtimeMapView.js** - Enhance route rendering and emoji integration
3. **route-animations.css** - Add new animation keyframes for route emojis

## Success Criteria
- Routes display with correct service-based colors
- Smooth animation of routes being drawn
- Service emojis visible and moving along routes
- Real-time tracking works seamlessly
- Map remains responsive and performant
