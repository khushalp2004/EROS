# Vehicle Number Fetch Fix Plan

## Problem Identified
The unit-tracking page shows "N/A" for vehicle numbers because the authority routes API endpoint `/api/authority/units` doesn't include `unit_vehicle_number` in the response.

## Root Cause
In `/Users/khushalpatil/Desktop/EROS/backend/routes/authority_routes.py`, the `get_units()` function (lines 335-344) only returns:
- unit_id
- service_type
- status
- latitude
- longitude
- last_updated

But it's missing `unit_vehicle_number`.

## Fix Required
Update the `get_units()` function in authority_routes.py to include `unit_vehicle_number` in the response data.

## Files to Edit
1. `/Users/khushalpatil/Desktop/EROS/backend/routes/authority_routes.py` - Add vehicle number to response

## Expected Outcome
- Vehicle numbers will display correctly in the UnitsTracking page table
- Both existing and new units will show their vehicle numbers
- No breaking changes to other functionality

## Testing Steps
1. Start the backend server
2. Navigate to Units Tracking page
3. Verify vehicle numbers display correctly in the table
4. Test adding new unit and verify vehicle number appears
