# CORS Fix Plan for EROS Emergency Response System

## Issues Identified

### 1. Inconsistent Host Configuration
- **Problem**: Mix of `localhost` and `127.0.0.1` across components
- **Impact**: CORS preflight fails due to origin mismatch
- **Files Affected**: 
  - `frontend/src/api.js` (127.0.0.1:5001)
  - `frontend/src/components/RealTimeMap.js` (localhost:5001)
  - `backend/app.py` (supports both but inconsistent)

### 2. SocketIO Configuration Issues
- **Problem**: Frontend connects to SocketIO without proper namespace handling
- **Backend expects**: `'/map'` namespace in RealTimeMap.js
- **Backend provides**: Root namespace only
- **Impact**: WebSocket connections fail

### 3. Mixed API Call Methods
- **Problem**: Inconsistent use of axios vs fetch()
- **Impact**: Different CORS handling, harder to debug

### 4. CORS Credentials Mismatch
- **Problem**: Backend CORS credentials=False but frontend might expect cookies/sessions
- **Impact**: Authentication/session issues if needed

## Solution Plan

### Phase 1: Standardize Host Configuration
1. **Update frontend/api.js**: Use consistent `http://127.0.0.1:5001`
2. **Update RealTimeMap.js**: Replace localhost with 127.0.0.1
3. **Verify all components**: Search and replace localhost with 127.0.0.1

### Phase 2: Fix SocketIO Configuration
1. **Update backend events.py**: Remove namespace dependency
2. **Update RealTimeMap.js**: Connect to root namespace
3. **Ensure proper CORS headers**: SocketIO connections

### Phase 3: Standardize API Calls
1. **Update RealTimeMap.js**: Replace fetch() with axios from api.js
2. **Remove duplicate API logic**: Use centralized api.js

### Phase 4: Enhanced CORS Configuration
1. **Update backend CORS**: Add more permissive settings for development
2. **Add CORS headers**: Explicit preflight handling
3. **Add error handling**: Better CORS error messages

## Implementation Steps

1. **Fix API Consistency**
2. **Fix SocketIO Connection**
3. **Update CORS Headers**
4. **Test Connectivity**
5. **Verify All Components**

## Expected Outcome
- Eliminated CORS preflight errors
- Consistent API connectivity
- Working WebSocket connections
- Better error handling and debugging
