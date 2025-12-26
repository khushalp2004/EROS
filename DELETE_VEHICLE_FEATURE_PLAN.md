# Delete Vehicle Feature Implementation Plan

## Task Overview
Add a delete vehicle button similar to the existing addUnit button, using unit_vehicle_number as the form field to identify which vehicle to delete.

## Information Gathered
1. **Current AddUnit Implementation**: 
   - Located in `frontend/src/components/AddUnit.js`
   - Uses modal interface with form fields for unit_vehicle_number, service_type, and location
   - Has proper validation and error handling
   - Uses `unitAPI.createUnit()` for backend communication

2. **Backend Unit Routes**:
   - Located in `backend/routes/unit_routes.py`
   - Has `create_unit()` endpoint but no delete functionality
   - Uses `Unit.query.filter_by(unit_vehicle_number=data['unit_vehicle_number']).first()` for duplicate checking

3. **API Layer**:
   - Located in `frontend/src/api.js`
   - Has `deleteUnit: (unitId) => api.delete(`/api/units/${unitId}`)` but uses unit_id, not vehicle number
   - Base URL: `http://127.0.0.1:5001`

4. **Unit Model**: 
   - Uses `unit_vehicle_number` as unique identifier
   - Supports service types: 'Ambulance', 'Fire', 'Police'

## Implementation Plan

### Step 1: Backend - Add Delete Endpoint
**File**: `backend/routes/unit_routes.py`
- Add new DELETE endpoint: `/units/vehicle-number/<vehicle_number>`
- Implement validation to ensure vehicle exists before deletion
- Add proper error handling for non-existent vehicles
- Include confirmation dialog data in response

### Step 2: Frontend API - Update API Layer
**File**: `frontend/src/api.js`
- Add new function: `deleteUnitByVehicleNumber: (vehicleNumber) => api.delete(`/api/units/vehicle-number/${vehicleNumber}`)`
- Keep existing `deleteUnit` function for backward compatibility

### Step 3: Create DeleteUnit Component
**File**: `frontend/src/components/DeleteUnit.js`
- Create modal component similar to AddUnit.js structure
- Single form field for unit_vehicle_number input
- Add confirmation step before deletion
- Include success/error notifications
- Use same styling and design patterns as AddUnit component

### Step 4: Integration - Add Delete Button
**Files**: 
- `frontend/src/components/UnitList.js` (if exists)
- `frontend/src/pages/UnitsTracking.js` 
- `frontend/src/pages/Authority.js`
- Add delete button next to addUnit button
- Integrate DeleteUnit component
- Add proper callback handling for unit deletion

### Step 5: Error Handling & Validation
- Validate vehicle number format (3-15 characters)
- Handle non-existent vehicle numbers gracefully
- Add confirmation dialog before deletion
- Show appropriate success/error messages
- Handle network errors and timeouts

## Technical Requirements
1. **Vehicle Number Validation**: Same as AddUnit (3-15 characters, alphanumeric)
2. **Confirmation Dialog**: Double confirmation before deletion
3. **Success Feedback**: Clear success message after deletion
4. **Error Handling**: User-friendly error messages for all scenarios
5. **Loading States**: Proper loading indicators during API calls
6. **Modal Design**: Consistent with existing AddUnit modal design

## Files to be Modified/Created
1. **Backend**: `backend/routes/unit_routes.py` - Add DELETE endpoint
2. **Frontend API**: `frontend/src/api.js` - Add delete by vehicle number function
3. **New Component**: `frontend/src/components/DeleteUnit.js` - Delete modal component
4. **Integration Files**: Add delete button to relevant UI components

## Expected User Flow
1. User clicks "Delete Vehicle" button
2. Modal opens with single input field for vehicle number
3. User enters vehicle number and clicks "Delete"
4. Confirmation dialog appears asking "Are you sure?"
5. If confirmed, API call is made to delete the vehicle
6. Success message shown, modal closes, unit list refreshes

## Follow-up Steps
1. Test the delete functionality thoroughly
2. Verify error handling for edge cases
3. Test integration with existing unit management features
4. Ensure proper cleanup of related data (locations, routes, etc.)
5. Update documentation if needed

## Dependencies
- Backend Flask routes modification
- Frontend React component creation
- API layer updates
- Existing modal styling and design system
