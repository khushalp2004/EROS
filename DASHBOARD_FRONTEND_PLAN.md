# Dashboard.js Frontend Enhancement Plan

## Problem Analysis

### Current Issues:
1. **Disconnected Simulations**: Dashboard.js creates its own simulation (`simTracks`) that doesn't sync with backend WebSocket simulation
2. **Missing Real-time Integration**: Frontend doesn't properly use the `useRealtimeUnitMarkers` hook data
3. **Duplicate Animation Logic**: Both frontend and backend have separate simulation engines
4. **Route Cache Issues**: Route fetching and caching not properly synchronized with real-time updates

## Solution Architecture

### 1. **Unified Real-time Integration**
- Replace frontend simulation with WebSocket real-time data
- Use `useRealtimeUnitMarkers` hook for actual unit positions
- Connect polylines with real backend unit locations

### 2. **Enhanced Route Animation System**
- Sync polyline progress with actual WebSocket unit locations
- Add real-time route progress indicators
- Implement proper source/destination synchronization

### 3. **Improved Visual Feedback**
- Add clear indicators for real-time vs simulated data
- Show actual unit progress on routes
- Enhanced animation synchronization

### 4. **Performance Optimizations**
- Reduce redundant API calls
- Optimize WebSocket data usage
- Better state management for real-time updates

## Implementation Steps

### Step 1: Replace Frontend Simulation with WebSocket Data
- Remove `simTracks` state management
- Integrate `useRealtimeUnitMarkers` for unit positions
- Update animation logic to use real-time data

### Step 2: Enhance Route Synchronization
- Sync polylines with actual WebSocket unit locations
- Calculate route progress from real unit positions
- Add proper route interpolation

### Step 3: Improve Visual Indicators
- Add real-time vs simulated status indicators
- Enhanced progress tracking
- Better animation synchronization

### Step 4: Optimize Performance
- Reduce redundant calculations
- Better state management
- Improved rendering optimization

## Success Criteria
- ✅ Real-time unit positions from WebSocket visible on map
- ✅ Route animations sync with actual unit movement
- ✅ Clear indicators for real-time vs simulated data
- ✅ Smooth, synchronized animations
- ✅ Better performance and responsiveness
