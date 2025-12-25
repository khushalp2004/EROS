# Tracking Feature Diagnosis: UnitsTracking vs Dashboard

## Problem Summary
The tracking feature works correctly in UnitsTracking.js but not properly in Dashboard.js.

## Root Causes Identified

### 1. **Different WebSocket Hook Usage**
- **UnitsTracking**: Uses `useWebSocket()` directly
  ```javascript
  const { isConnected, unitLocations } = useWebSocket();
  ```
- **Dashboard**: Uses `useRealtimeUnitMarkers(units)` which adds complexity
  ```javascript
  const { markers: realtimeUnitMarkers, isConnected: wsConnected, hasRealtimeData } = useRealtimeUnitMarkers(units);
  ```

### 2. **Overly Complex Data Flow in Dashboard**
Dashboard has multiple layers of data transformation:
- `activeRouteTracking` → `realtimeEmergencyMarkers` → `realtimeRoutePolylines`
- This creates more points of failure compared to UnitsTracking's direct approach

### 3. **Restricted Emergency Filtering**
Dashboard filters emergencies differently:
```javascript
// Dashboard only shows routes for ASSIGNED emergencies
emergencies.filter((e) => e.status === "ASSIGNED" && e.assigned_unit)
```
This means units without assigned emergencies don't show tracking.

### 4. **Inconsistent Real-time Data Handling**
- UnitsTracking: Updates route positions based on `unitLocations` from WebSocket
- Dashboard: Creates separate marker arrays which may not sync properly

### 5. **Potential Race Conditions**
Dashboard's complex state management with `useMemo` dependencies may cause:
- Stale closures in route calculations
- Inconsistent re-rendering cycles
- Timing issues between WebSocket updates and React state updates

## Recommendations

### 1. **Standardize WebSocket Hook Usage**
Make Dashboard use the same direct approach as UnitsTracking:
```javascript
// Replace useRealtimeUnitMarkers with direct useWebSocket
const { isConnected, unitLocations } = useWebSocket();
```

### 2. **Simplify Data Flow**
Remove unnecessary transformations:
```javascript
// Direct route calculation from unitLocations
const routePolylines = emergencies
  .filter(e => e.status === 'ASSIGNED')
  .map(emergency => {
    const unit = units.find(u => u.unit_id === emergency.assigned_unit);
    const realtimeLocation = unitLocations[unit.unit_id];
    // ... rest of logic
  });
```

### 3. **Add Debug Logging**
Add console logs to track data flow:
```javascript
console.log('🔍 Dashboard tracking data:', {
  wsConnected,
  unitLocations,
  realtimeMarkers: realtimeUnitMarkers.length,
  routes: realtimeRoutePolylines.length
});
```

### 4. **Fix Emergency Filtering**
Show tracking for all relevant units, not just assigned ones:
```javascript
// Show routes for units that are ENROUTE or have active tracking
const activeUnits = units.filter(u => 
  u.status === 'ENROUTE' || 
  unitLocations[u.unit_id] ||
  emergencies.some(e => e.assigned_unit === u.unit_id)
);
```

## Next Steps
1. Implement the simplified approach
2. Test with real WebSocket data
3. Add debugging to identify specific failure points
4. Verify both pages use identical tracking logic
