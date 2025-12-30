# Unit Display Fix Plan

## Problem Identified
The dashboard shows "No units available" when units are actually available. This is due to a **type mismatch** between frontend expectations and backend data.

## Root Cause Analysis

### Frontend Dashboard.js Expectations:
- Looking for service types: `'AMBULANCE'`, `'FIRE_TRUCK'`, `'POLICE'` (uppercase, underscore-separated)
- EmergencyList.js uses `availableByType[emergency.emergency_type]` to check availability

### Backend Actual Data:
- Unit model stores service types as: `'Ambulance'`, `'Fire'`, `'Police'` (proper case)
- Emergency model stores emergency types the same way
- Authority routes dispatch logic uses exact string matching

### Current Flow (Broken):
1. Dashboard fetches units from `/api/authority/units`
2. Units have service_type: 'Ambulance', 'Fire', 'Police' 
3. Dashboard filters for: 'AMBULANCE', 'FIRE_TRUCK', 'POLICE'
4. Result: 0 matches → shows "No units available"

## Solution Options

### Option 1: Standardize Backend Service Types (Recommended)
- Update backend to use uppercase service types with underscores
- Update database data to match frontend expectations
- Most consistent with the frontend logic

### Option 2: Update Frontend to Match Backend
- Change Dashboard.js to filter for: 'Ambulance', 'Fire', 'Police'
- Update EmergencyList.js to use lowercase service types
- Less disruptive to existing backend code

### Option 3: Create Mapping Layer
- Keep both systems as-is
- Add mapping functions in frontend to convert between formats
- More complex but preserves existing data

## Recommended Implementation Plan

### Step 1: Update Backend Service Type Validation
**File:** `/backend/routes/unit_routes.py`
- Change `valid_service_types` from `['Ambulance', 'Fire', 'Police']` to `['AMBULANCE', 'FIRE_TRUCK', 'POLICE']`
- Update create_unit function to accept uppercase service types
- Add mapping for backwards compatibility

### Step 2: Update Frontend Type References
**File:** `/frontend/src/pages/Dashboard.js`
- Keep existing filtering logic (it's already correct)
- Add debug logging to verify data flow

**File:** `/frontend/src/components/EmergencyList.js`
- Ensure emergency type comparison works correctly

### Step 3: Update Authority Dispatch Logic
**File:** `/backend/routes/authority_routes.py`
- Ensure dispatch logic uses consistent service type matching
- Add debug logging to verify matching

### Step 4: Test Data Migration
**File:** `/backend/migrate_service_types.py` (create new)
- Script to update existing unit service types in database
- Convert 'Ambulance' → 'AMBULANCE', 'Fire' → 'FIRE_TRUCK', 'Police' → 'POLICE'

### Step 5: Add Unit Creation Compatibility
**File:** `/frontend/src/components/AddUnit.js`
- Update service type options to match backend expectations
- Ensure dropdown uses correct service type values

## Expected Outcome
- Dashboard will correctly show available units count
- "No units available" button will change to "Approve & Dispatch" when units are present
- Service type matching will work correctly throughout the system

## Testing Verification
1. Create units with service types: 'AMBULANCE', 'FIRE_TRUCK', 'POLICE'
2. Create emergency requests for same types
3. Verify Dashboard shows correct available unit counts
4. Verify dispatch functionality works
