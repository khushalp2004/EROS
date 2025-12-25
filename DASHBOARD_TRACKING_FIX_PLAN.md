# Dashboard Tracking Fix Plan

## Overview
This plan addresses the tracking inconsistencies between UnitsTracking.js and Dashboard.js by implementing standardized real-time tracking logic.

## Step-by-Step Implementation

### Step 1: Standardize WebSocket Hook Usage
**File:** `frontend/src/pages/Dashboard.js`

**Current Issue:** Dashboard uses `useRealtimeUnitMarkers(units)` which creates unnecessary complexity.

**Solution:** Replace with direct `useWebSocket()` hook usage like UnitsTracking:

```javascript
// Replace this line:
const { markers: realtimeUnitMarkers, isConnected: wsConnected, hasRealtimeData } = useRealtimeUnitMarkers(units);

// With this:
const { isConnected: wsConnected, unitLocations } = useWebSocket();
```

### Step 2: Simplify Route Data Processing
**Current Logic:** Complex multi-layer transformations:
- `activeRouteTracking` → `realtimeEmergencyMarkers` → `realtimeRoutePolylines`

**New Logic:** Direct route calculation (similar to UnitsTracking):

```javascript
const routePolylines = useMemo(() => {
  const routes = [];
  
  emergencies
    .filter(e => e.status === 'ASSIGNED')
    .forEach(emergency => {
      const unit = units.find(u => u.unit_id === emergency.assigned_unit);
      if (unit) {
        // Use real-time location if available
        const realtimeLocation = unitLocations[unit.unit_id];
        const unitLat = realtimeLocation ? realtimeLocation.latitude : unit.latitude;
        const unitLon = realtimeLocation ? realtimeLocation.longitude : unit.longitude;
        
        routes.push({
          id: `${unit.unit_id}-${emergency.request_id}`,
          positions: [
            [unitLat, unitLon],
            [emergency.latitude, emergency.longitude]
          ],
          color: getRouteColor(unit.service_type),
          unitId: unit.unit_id,
          emergencyId: emergency.request_id,
          serviceType: unit.service_type,
          isRealtime: !!realtimeLocation
        });
      }
    });
    
  return routes;
}, [units, emergencies, unitLocations]);
```

### Step 3: Fix Emergency Filtering Logic
**Current Issue:** Only shows routes for ASSIGNED emergencies, missing ENROUTE units.

**New Logic:** Show tracking for all active units:

```javascript
// Replace restrictive filter with broader scope
const activeUnits = units.filter(unit => {
  const realtimeLocation = unitLocations[unit.unit_id];
  const hasAssignment = emergencies.some(e => e.assigned_unit === unit.unit_id);
  
  return unit.status === 'ENROUTE' || 
         unit.status === 'DEPARTED' || 
         realtimeLocation ||
         hasAssignment;
});
```

### Step 4: Add Debug Logging
**Purpose:** Track data flow for troubleshooting.

```javascript
useEffect(() => {
  console.log('🔍 Dashboard tracking debug:', {
    wsConnected,
    unitLocationsCount: Object.keys(unitLocations).length,
    unitsCount: units.length,
    emergenciesCount: emergencies.length,
    activeRoutes: routePolylines.length,
    realtimeUnits: Object.keys(unitLocations)
  });
}, [wsConnected, unitLocations, units, emergencies, routePolylines]);
```

### Step 5: Fix Map Markers Integration
**Current Issue:** Complex marker merging logic.

**New Logic:** Simplified approach:

```javascript
const mapMarkers = useMemo(() => {
  // Show all emergencies
  const emergencyMarkers = emergencies.map(e => ({ ...e, type: e.emergency_type }));
  
  // Add real-time unit markers for assigned units
  const unitMarkers = units
    .filter(u => emergencies.some(e => e.assigned_unit === u.unit_id))
    .map(unit => {
      const realtimeLocation = unitLocations[unit.unit_id];
      return {
        ...unit,
        latitude: realtimeLocation ? realtimeLocation.latitude : unit.latitude,
        longitude: realtimeLocation ? realtimeLocation.longitude : unit.longitude,
        isRealtime: !!realtimeLocation,
        status: realtimeLocation ? realtimeLocation.status : unit.status
      };
    });
    
  return [...emergencyMarkers, ...unitMarkers];
}, [units, emergencies, unitLocations]);
```

### Step 6: Update Connection Status Display
**Current:** Complex status logic with multiple conditions.

**New:** Simple status like UnitsTracking:

```javascript
<div style={{ 
  color: wsConnected ? '#28a745' : '#dc3545',
  fontWeight: 'bold'
}}>
  {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
  {routePolylines.length > 0 && ` • ${routePolylines.length} Active Routes`}
</div>
```

## Testing Strategy

### 1. Verify WebSocket Connection
- Check browser console for connection logs
- Confirm `wsConnected` status updates

### 2. Test Route Generation
- Create test emergency and assign unit
- Verify route appears in both UnitsTracking and Dashboard
- Check that routes update with real-time data

### 3. Validate Real-time Updates
- Monitor unit movement in UnitsTracking
- Confirm same movement appears in Dashboard
- Check for synchronization between pages

### 4. Edge Case Testing
- Test with no assigned emergencies
- Test with disconnected WebSocket
- Test with multiple active routes

## Implementation Priority

**High Priority:**
1. Step 1: Standardize WebSocket hook
2. Step 2: Simplify route processing  
3. Step 4: Add debug logging

**Medium Priority:**
3. Fix emergency filtering
5. Fix map markers integration

**Low Priority:**
6. Update connection status display

## Expected Outcomes

After implementation:
- ✅ Dashboard tracking matches UnitsTracking functionality
- ✅ Real-time updates work consistently across both pages
- ✅ Simplified code reduces maintenance burden
- ✅ Better debugging capabilities for future issues

## Files to Modify

1. `frontend/src/pages/Dashboard.js` - Main implementation
2. `frontend/src/hooks/useWebSocket.js` - May need minor adjustments
3. Test in browser to verify both pages show identical tracking behavior
