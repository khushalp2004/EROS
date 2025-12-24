# CORS Error Fix Plan

## Problem Analysis
The CORS error in AddEmergency.js is likely caused by:

1. **Credentials + Wildcard Origin Issue**: Using `supports_credentials=True` with `origins="*"` causes browser CORS violations
2. **Backend OPTIONS handling**: Flask-CORS should handle preflight requests automatically, but explicit handlers might conflict
3. **Frontend withCredentials setting**: The frontend sends credentials which require specific origin handling

## Solution Plan

### 1. Fix Backend CORS Configuration
- **File**: `/backend/app.py`
- **Changes**:
  - Replace wildcard `origins="*"` with specific origin `"http://localhost:3000"`
  - Remove explicit CORS headers from route handlers (Flask-CORS handles this)
  - Simplify CORS configuration

### 2. Update Frontend API Configuration
- **File**: `/frontend/src/api.js`
- **Changes**:
  - Remove `withCredentials: true` since we're not using authentication
  - Keep `crossDomain: true` for explicit CORS handling
  - Ensure proper error handling for CORS errors

### 3. Clean Up Emergency Routes
- **File**: `/backend/routes/emergency_routes.py`
- **Changes**:
  - Remove explicit CORS headers from OPTIONS handlers
  - Let Flask-CORS handle preflight requests automatically
  - Simplify error responses

## Expected Results
- CORS preflight requests will be handled automatically
- Frontend will successfully connect to backend API
- AddEmergency component will work without CORS errors

## Testing Steps
1. Start backend server (`python app.py`)
2. Start frontend server (`npm start`)
3. Test AddEmergency form submission
4. Check browser console for CORS errors

## COMPLETED FIXES ✅

### 1. Backend CORS Configuration
- **File**: `/backend/app.py`
- **Changes Applied**:
  - ✅ Replaced `origins="*"` with `["http://localhost:3000", "http://127.0.0.1:3000"]`
  - ✅ Changed `supports_credentials=True` to `supports_credentials=False`

### 2. Frontend API Configuration
- **File**: `/frontend/src/api.js`
- **Changes Applied**:
  - ✅ Removed `withCredentials: true`
  - ✅ Kept `crossDomain: true` for explicit CORS handling

### 3. Cleaned Up All Route Handlers
- **Files Updated**:
  - ✅ `/backend/routes/emergency_routes.py`
  - ✅ `/backend/routes/unit_routes.py`
  - ✅ `/backend/routes/notification_routes.py`
  - ✅ `/backend/routes/authority_routes.py`
- **Changes Applied**:
  - ✅ Removed explicit CORS headers from OPTIONS handlers
  - ✅ Simplified responses using direct `jsonify()` returns
  - ✅ Let Flask-CORS handle preflight requests automatically

### 4. SocketIO CORS Configuration
- **File**: `/backend/events.py`
- **Changes Applied**:
  - ✅ Updated to match main Flask app CORS configuration
