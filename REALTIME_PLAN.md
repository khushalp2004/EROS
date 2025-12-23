# Real-Time Unit Location Event System Plan

## Current State Analysis
- Application has animated route paths with simulated movement
- Backend API endpoints for unit and emergency management
- Frontend with React and Leaflet for map visualization

## Real-Time Event System Requirements

### 1. WebSocket Infrastructure
- Backend: Flask-SocketIO for WebSocket communication
- Frontend: socket.io-client for real-time updates
- Real-time broadcasting of unit location changes

### 2. Unit Location Management
- In-memory unit position tracking
- Location update API endpoints
- Periodic broadcasting of unit movements

### 3. Frontend Real-Time Integration
- WebSocket connection management
- Live map marker updates
- Automatic re-centering on moving units

## Implementation Steps

### Step 1: Backend WebSocket Setup
- Install Flask-SocketIO
- Create WebSocket event handlers
- Add unit location broadcasting

### Step 2: Frontend WebSocket Integration
- Install socket.io-client
- Connect to WebSocket server
- Handle real-time unit location updates

### Step 3: Unit Location Management
- Add location update endpoints
- Implement real-time broadcasting
- Test and optimize performance

### Step 4: Enhanced Map Features
- Live unit tracking
- Automatic map following
- Location history trails
