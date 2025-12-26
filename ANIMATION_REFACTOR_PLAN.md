# Animation Refactor Plan: OSRM Geometry + Progress Based Animation

## Current Implementation Analysis

### Current System (unitPosition-based):
- **Flow**: unitPosition → polyline starts at unitPosition → animation follows
- **Issues**: 
  - Animation depends on GPS position calculations
  - Polyline visibility controlled by slicing positions array
  - Unit marker position calculated from RouteMovementController

### Desired System:
- **Flow**: OSRM geometry → polyline (fixed) + progress (dynamic) → animation calculated from both
- **Benefits**:
  - Fixed route geometry from OSRM
  - Dynamic progress drives animation
  - Clear separation of route geometry and animation state

## Files to Modify

### 1. Core Animation Components
- **MapView_new.js** - Primary map component with AnimatedPolyline
- **MapView_enhanced.js** - Enhanced map variant
- **MapView.js** - Original map component

### 2. Route Management
- **RouteGeometryManager.js** - Already has OSRM geometry processing
- **RouteMovementController.js** - WebSocket integration, will need updates

### 3. Route Services
- **routeService.js** - OSRM API integration

## Implementation Plan

### Phase 1: Refactor AnimatedPolyline Component
**Current Logic**:
```javascript
const visiblePositions = positions.slice(0, Math.max(2, Math.floor(positions.length * progress)));
```

**New Logic**:
```javascript
// 1. Fixed polyline from OSRM geometry (complete route)
const fullRouteGeometry = positions; // Complete OSRM route
const animatedMarkerPosition = calculateMarkerPositionFromProgress(positions, progress);
// 2. Show full polyline as background
// 3. Show animated marker at calculated position
```

### Phase 2: Update RouteGeometryManager
- Add method to calculate position at progress fraction
- Ensure proper OSRM geometry handling
- Add progress-based position calculation utilities

### Phase 3: Update RouteMovementController
- Modify WebSocket integration to work with new system
- Update polyline data generation for AnimatedPolyline
- Ensure progress updates work with new animation system

### Phase 4: Update Map Components
- Modify all AnimatedPolyline usages
- Update prop passing and data flow
- Ensure backward compatibility

## Detailed Changes Required

### AnimatedPolyline Refactor:
1. **Remove**: `visiblePositions` slicing logic
2. **Add**: Full route polyline display
3. **Add**: Progress-based marker position calculation
4. **Update**: Unit marker rendering logic

### RouteGeometryManager Updates:
1. Add `getPositionAtProgress(routeId, progress)` method
2. Ensure coordinate system consistency
3. Add progress validation (0-1 range)

### MapView Updates:
1. Update AnimatedPolyline prop usage
2. Remove dependency on RouteMovementController for position calculation
3. Update polyline data structure expectations

## Backward Compatibility
- Keep existing prop interfaces where possible
- Graceful degradation for missing data
- Clear migration path for existing implementations

## Testing Strategy
1. Test with existing OSRM route data
2. Verify progress calculations are accurate
3. Ensure smooth animation performance
4. Test WebSocket integration compatibility

## Success Criteria
- ✅ Fixed polyline shows complete OSRM route
- ✅ Progress drives animated marker along route
- ✅ Smooth animation performance
- ✅ Backward compatibility maintained
- ✅ WebSocket integration works with new system
