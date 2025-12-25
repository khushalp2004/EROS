# Request Flooding Diagnosis

## Problem Summary
A flood of requests occurs when the backend server starts, overwhelming the server and causing performance issues.

## Root Causes Identified

### 1. Multiple WebSocket Connections
- **Dashboard.js** and **UnitsTracking.js** each create independent WebSocket connections
- Both pages use the `useWebSocket` hook simultaneously
- This creates multiple socket connections to the same backend server

### 2. Aggressive Reconnection Logic
- **useWebSocket.js lines 67-73**: Exponential backoff reconnection triggers multiple times
- Reconnection attempts can cascade when backend is starting up
- Each reconnection emits events immediately upon success

### 3. Immediate Event Emission
Upon WebSocket connection, each instance emits multiple events:
- `join_tracking_room`
- `get_unit_locations`
- `get_emergency_updates`

### 4. Periodic Refresh Intervals
Both components set up 30-second fallback intervals:
- **Dashboard.js lines 89-95**: `setInterval` for data refresh
- **UnitsTracking.js lines 32-42**: `setInterval` for data refresh
- These start immediately when components mount

### 5. Component Mounting Cascade
- React app renders multiple components simultaneously
- Each component triggers its own data fetching
- Backend receives simultaneous requests from multiple sources

## Technical Analysis

### File: frontend/src/hooks/useWebSocket.js
```javascript
// Lines 50-53: Immediate event emission on connection
socket.emit('join_tracking_room');
socket.emit('get_unit_locations');
socket.emit('get_emergency_updates');

// Lines 67-73: Aggressive reconnection
const attemptReconnection = useCallback(() => {
  // Exponential backoff reconnection logic
}, [reconnectAttempts, connect]);
```

### File: frontend/src/pages/Dashboard.js
```javascript
// Lines 89-95: Periodic refresh setup
const interval = setInterval(() => {
  if (units.length === 0 || emergencies.length === 0) {
    fetchData();
  }
}, 30000);
```

### File: frontend/src/pages/UnitsTracking.js
```javascript
// Lines 32-42: Periodic refresh setup
const interval = setInterval(() => {
  if (units.length === 0 || emergencies.length === 0) {
    fetchUnits();
    fetchEmergencies();
  }
}, 30000);
```

## Impact Assessment

### Server Load
- Multiple simultaneous WebSocket connections
- Burst of events on each connection
- Periodic polling from multiple sources
- Reconnection cascades

### Performance Issues
- Backend server overwhelmed with requests
- Network congestion
- Increased memory usage
- Potential server crashes

## Recommended Solutions

### 1. Centralized WebSocket Management
- Create a single WebSocket connection manager
- Share connection across all components
- Implement connection pooling

### 2. Request Throttling
- Add delays between requests
- Implement request queues
- Use debouncing for frequent operations

### 3. Connection State Management
- Single source of truth for connection status
- Coordinate reconnection attempts
- Prevent duplicate connections

### 4. Startup Sequence Control
- Stagger component initialization
- Add connection delays
- Implement graceful startup

### 5. Event Aggregation
- Batch similar events
- Deduplicate requests
- Implement request caching

## Next Steps
1. Implement centralized WebSocket manager
2. Add request throttling mechanisms
3. Create connection state coordination
4. Test with multiple component instances
5. Monitor server load during startup
