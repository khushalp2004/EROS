# Real-time WebSocket Fix Plan

## Problem Analysis
The issue is that while the WebSocket infrastructure exists (both backend and frontend have WebSocket setup), **the backend route handlers are NOT emitting real-time events** when data changes. This forces users to manually refresh to see new requests and updates.

## Current State
✅ **Working Components:**
- WebSocket server in `backend/events.py` with proper event handlers
- Frontend WebSocket manager (`useWebSocketManager`) 
- Real-time map visualization components
- Unit simulation and tracking system

❌ **Missing Components:**
- WebSocket event emissions in route handlers
- Real-time data updates when emergencies are created/modified
- Real-time updates when units are dispatched/status changed
- Real-time notifications for all emergency lifecycle events

## Root Cause
The route files (`emergency_routes.py`, `authority_routes.py`) only update the database but don't broadcast changes via WebSocket, while the frontend Dashboard is designed to receive real-time updates.

## Solution Plan

### 1. Backend Route Updates
**Files to Modify:**
- `backend/routes/emergency_routes.py` - Add WebSocket events for emergency creation
- `backend/routes/authority_routes.py` - Add WebSocket events for dispatch/completion
- `backend/routes/unit_routes.py` - Add WebSocket events for unit updates (if exists)

**Events to Emit:**
```javascript
// Emergency events
socketio.emit('emergency_created', emergency_data)
socketio.emit('emergency_updated', {action: 'approved', emergency: data})
socketio.emit('emergency_updated', {action: 'assigned', emergency: data})
socketio.emit('emergency_updated', {action: 'completed', emergency: data})

// Unit events  
socketio.emit('unit_status_update', {unit_id, status, emergency_id})
socketio.emit('unit_location_update', location_data)

// Room-based events for targeted updates
socketio.emit('emergency_update', data, room='unit_tracking')
socketio.emit('dashboard_update', data, room='authority_dashboard')
```

### 2. Frontend Enhancements
**Files to Check:**
- `frontend/src/pages/Dashboard.js` - Ensure proper event handling
- `frontend/src/hooks/useWebSocketManager.js` - Verify event subscriptions
- `frontend/src/components/RealtimeMapView.js` - Check real-time updates

**Required Frontend Subscriptions:**
```javascript
// Subscribe to emergency lifecycle events
socket.on('emergency_created', handleEmergencyCreated)
socket.on('emergency_updated', handleEmergencyUpdated)
socket.on('emergency_completed', handleEmergencyCompleted)

// Subscribe to unit status changes
socket.on('unit_status_update', handleUnitStatusUpdate)
socket.on('unit_location_update', handleUnitLocationUpdate)

// Subscribe to dashboard updates
socket.on('dashboard_update', handleDashboardUpdate)
```

### 3. Implementation Steps

#### Step 1: Update Emergency Routes
- Add `socketio` import and WebSocket emissions in `emergency_routes.py`
- Emit `emergency_created` event when new emergency is added
- Ensure proper event data structure

#### Step 2: Update Authority Routes  
- Add WebSocket emissions in `authority_routes.py`
- Emit `emergency_updated` for status changes (approved → assigned → completed)
- Emit `unit_status_update` when units are dispatched/released
- Include relevant data in each event

#### Step 3: Verify Frontend Handling
- Check Dashboard component properly handles real-time events
- Ensure map updates without refresh
- Verify notification system works with real-time events

#### Step 4: Testing
- Create new emergency → should appear immediately on Dashboard
- Dispatch emergency → unit should move in real-time on map
- Complete emergency → status should update instantly
- All changes should be visible without manual refresh

## Expected Outcome
After implementation:
1. **No Manual Refresh Needed**: All data changes appear instantly
2. **Real-time Map Updates**: Units move smoothly without page refresh  
3. **Live Notifications**: Emergency status changes show immediately
4. **Seamless User Experience**: Dashboard feels responsive and current

## Files to Modify
1. `/backend/routes/emergency_routes.py` - Add real-time event emissions
2. `/backend/routes/authority_routes.py` - Add dispatch/completion events
3. Test real-time functionality across Dashboard and UnitsTracking pages

## Success Criteria
- ✅ New emergencies appear instantly on Dashboard without refresh
- ✅ Unit dispatch shows real-time movement on map
- ✅ Emergency status changes (pending → assigned → completed) update live
- ✅ All connected clients receive updates simultaneously
- ✅ WebSocket connection remains stable during operations
