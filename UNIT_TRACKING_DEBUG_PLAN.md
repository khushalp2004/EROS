# Unit Tracking Database Route Fetch Issue - Debug & Fix Plan

## Problem Analysis
The unit-tracking system is failing to fetch route data from the database, preventing proper route visualization and animation.

## Evidence Found
1. **Backend API endpoints exist** in `backend/routes/unit_routes.py`:
   - `/unit-routes/<int:unit_id>` - Fetch specific unit route
   - `/unit-routes/active-unit-routes` - Fetch all active routes

2. **Frontend API calls exist** in `frontend/src/api.js`:
   - `unitAPI.getUnitRoutes(unitId)`
   - `unitAPI.getActiveUnitRoutes()`

3. **Route data storage** in `authority_routes.py` during dispatch:
   - Route data stored in `RouteCalculation` model
   - `polyline_positions` field contains route coordinates
   - Real-time broadcasting includes route data

4. **Frontend usage** in `UnitsTracking.js`:
   - Calls `unitAPI.getActiveUnitRoutes()` to fetch route data
   - Expects database-driven route coordinates
   - Uses route data for animation and visualization

## Potential Root Causes

### 1. **Blueprint Registration Issue**
- The `unit_routes` blueprint might not be registered in `backend/app.py`
- Missing import and registration would cause 404 errors

### 2. **Database Data Issue**
- No route calculations exist in database
- Route data not properly stored during dispatch
- Database connection/permission problems

### 3. **API Endpoint Issues**
- Wrong endpoint URLs being called
- Authentication/permission issues
- CORS configuration problems

### 4. **Frontend Integration Issues**
- Incorrect API call structure
- Missing error handling
- Race condition between data fetching

## Debug Steps

### Step 1: Check Blueprint Registration
**Status**: NEEDS VERIFICATION
- Verify `unit_bp` is imported in `app.py`
- Confirm blueprint is registered with correct URL prefix
- Check if `/unit-routes/` endpoints are accessible

### Step 2: Database Verification
**Status**: NEEDS VERIFICATION  
- Check if `route_calculations` table has data
- Verify `polyline_positions` field contains route coordinates
- Test database queries manually

### Step 3: API Endpoint Testing
**Status**: NEEDS VERIFICATION
- Test `/unit-routes/active-unit-routes` endpoint directly
- Verify response format and data structure
- Check for any server errors or 404 responses

### Step 4: Frontend Error Handling
**Status**: NEEDS VERIFICATION
- Check browser console for API errors
- Verify error handling in UnitsTracking.js
- Test fallback behavior when no route data

### Step 5: Integration Testing
**Status**: NEEDS VERIFICATION
- Create test emergency and dispatch unit
- Verify route data is stored in database
- Confirm frontend receives and displays route data

## Fix Implementation Plan

### Fix 1: Ensure Blueprint Registration
```python
# In backend/app.py
from routes.unit_routes import unit_bp
app.register_blueprint(unit_bp)
```

### Fix 2: Add Comprehensive Error Handling
```javascript
// In UnitsTracking.js
const fetchRoutesFromDatabase = async () => {
  try {
    console.log('🗄️ Fetching all active routes from database...');
    const response = await unitAPI.getActiveUnitRoutes();
    // ... existing code
  } catch (err) {
    console.error('❌ Database route fetch failed:', err);
    setError(`Failed to fetch route data: ${err.message}`);
  }
};
```

### Fix 3: Add Database Health Check
```python
# In unit_routes.py
@unit_bp.route('/health', methods=['GET'])
def health_check():
    """Health check for unit routes service"""
    try:
        active_count = RouteCalculation.query.filter_by(is_active=True).count()
        return jsonify({
            "status": "healthy",
            "active_routes": active_count,
            "database": "connected"
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500
```

### Fix 4: Enhanced Route Data Validation
```python
# In unit_routes.py
def validate_route_data(route_calc):
    """Validate route calculation data integrity"""
    if not route_calc.polyline_positions:
        return False, "No polyline positions stored"
    
    try:
        positions = json.loads(route_calc.polyline_positions)
        if not isinstance(positions, list) or len(positions) < 2:
            return False, "Invalid position format"
        return True, "Valid"
    except json.JSONDecodeError:
        return False, "Corrupted polyline data"
```

## Expected Outcomes
1. **Successful route data retrieval** from database
2. **Proper route visualization** with polylines on map
3. **Real-time progress tracking** based on database timestamps
4. **Enhanced error handling** with user-friendly messages
5. **Improved debugging** with comprehensive logging

## Testing Checklist
- [ ] Blueprint registration verified
- [ ] Database contains route calculations with polyline positions
- [ ] API endpoints return expected data structure
- [ ] Frontend displays routes from database
- [ ] Real-time updates work correctly
- [ ] Error handling works for missing data scenarios
