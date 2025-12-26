# Add New Unit Feature Implementation Plan

## Overview
Add a comprehensive "Add New Unit" feature that allows authorities to add emergency response units with vehicle number plates, service types, and map-based location selection.

## Requirements Analysis
- **Database**: Add `unit_vehicle_number` column to Unit schema
- **Frontend**: Create add unit form with map location selection
- **Backend**: Add API endpoints for unit creation
- **Integration**: Update existing unit management to display vehicle numbers

## Current System Analysis

### Existing Unit Model (backend/models/unit.py)
```python
class Unit(db.Model):
    __tablename__ = 'units'
    unit_id = db.Column(db.Integer, primary_key=True)
    service_type = db.Column(db.String(20), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    status = db.Column(db.String(20), default='AVAILABLE')
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
```

### Current Unit Routes (backend/routes/unit_routes.py)
- GET `/units` - Fetch all units
- GET `/unit-routes/<int:unit_id>` - Get unit route data
- GET `/active-unit-routes` - Get active routes

### Frontend Structure
- UnitsTracking.js - Main unit management page
- RealtimeMapView.js - Map component for location selection
- RealTimeUnitTracking.js - Real-time tracking page

## Implementation Steps

### 1. Database Schema Update
- **File**: `backend/models/unit.py`
- **Changes**: Add `unit_vehicle_number` column
- **Migration**: Update database schema

### 2. Backend API Enhancement
- **File**: `backend/routes/unit_routes.py`
- **New Route**: POST `/units` - Create new unit
- **Update**: GET routes to include vehicle number
- **Validation**: Add input validation for unit creation

### 3. Frontend Add Unit Form
- **File**: `frontend/src/components/AddUnit.js` (new)
- **Features**:
  - Map-based location selection
  - Vehicle number input with validation
  - Service type dropdown (Ambulance, Fire Truck, Police)
  - Form validation and submission
  - Success/error feedback

### 4. Unit Management Integration
- **Update**: UnitsTracking.js to show vehicle numbers
- **Update**: Authority page to include Add Unit functionality
- **Add**: Button to open add unit form

### 5. Map Integration Enhancement
- **Update**: RealtimeMapView.js to support location selection mode
- **Add**: Click-to-set-location functionality
- **Add**: Visual feedback for selected location

## Implementation Details

### Database Changes
```python
# Add to Unit model
unit_vehicle_number = db.Column(db.String(20), unique=True, nullable=False)
```

### API Endpoints
```python
@unit_bp.route('/units', methods=['POST'])
def create_unit():
    # Create new unit with vehicle number
    pass

@unit_bp.route('/units/<int:unit_id>', methods=['PUT'])
def update_unit():
    # Update unit details including vehicle number
    pass
```

### Form Components
1. **AddUnitForm**: Main form component
2. **LocationSelector**: Map-based location picker
3. **VehicleNumberInput**: Validated input field
4. **ServiceTypeSelector**: Dropdown for service types

### Integration Points
- UnitsTracking.js table display
- Authority.js page integration
- Real-time map updates
- WebSocket notifications for new units

## Files to be Modified/Created

### Backend Files
- `backend/models/unit.py` - Add vehicle number column
- `backend/routes/unit_routes.py` - Add create/update endpoints
- `backend/app.py` - Register new routes

### Frontend Files
- `frontend/src/components/AddUnit.js` - New add unit form
- `frontend/src/components/LocationSelector.js` - Map location picker
- `frontend/src/pages/Authority.js` - Add unit button integration
- `frontend/src/pages/UnitsTracking.js` - Display vehicle numbers
- `frontend/src/components/RealtimeMapView.js` - Location selection mode
- `frontend/src/api.js` - Add API methods for unit creation

## Success Criteria
1. ✅ Vehicle number column added to database
2. ✅ Unit creation API endpoint functional
3. ✅ Add unit form with map location selection works
4. ✅ Vehicle numbers displayed in unit listings
5. ✅ Form validation prevents duplicate vehicle numbers
6. ✅ Real-time updates show new units on map
7. ✅ Integration with existing unit management system

## Next Steps
1. Confirm implementation plan
2. Start with database schema update
3. Implement backend API changes
4. Create frontend components
5. Integrate with existing system
6. Test and validate functionality
