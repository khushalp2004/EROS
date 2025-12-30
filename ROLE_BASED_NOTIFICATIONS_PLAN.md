# Role-Based Notifications Implementation Plan

## Task Requirements
- **Role=Reporter**: Not logged in users with reporter role must NOT get any notifications and bell icon must NOT be visible
- **Role=Admin**: Admin users should get notifications ONLY for new approval notifications, NOT for dashboard/unit-tracking notifications

## Current System Analysis

### User Roles Identified:
- `reporter` - Basic user who can report emergencies
- `authority` - User who can access dashboard and unit tracking
- `admin` - Admin user who can approve users

### Current Notification Components:
1. **Backend**: `backend/models/notification.py`, `backend/routes/notification_routes.py`
2. **Frontend**: `NotificationBadge.js`, `useNotifications.js`, `NotificationPanel.js`
3. **Auth**: `useAuth.js` for user role management

## Implementation Plan

### Phase 1: Frontend Role-Based Notification Control

#### 1.1 Update NotificationBadge.js
- Add role-based visibility check
- Only show bell icon for admin users
- Hide completely for reporter users

#### 1.2 Update useNotifications.js
- Add role-based initialization logic
- Only initialize WebSocket connections for admin users
- Skip notification loading for reporter users

#### 1.3 Update Navigation.js (if needed)
- Ensure notification badge integration respects role-based access

### Phase 2: Backend Role-Based Notification Filtering

#### 2.1 Update Notification Model
- Add role-based filtering to notification queries
- Ensure only appropriate notifications are created for each role

#### 2.2 Update Notification Routes
- Modify notification creation to respect role restrictions
- Add role validation in notification endpoints
- Filter notification queries based on user role

#### 2.3 Update Notification Creation Functions
- Modify `create_emergency_notification()` to only send to authority users
- Modify `create_unit_notification()` to only send to authority users
- Ensure admin users only receive approval-related notifications

### Phase 3: Admin-Specific Notification Logic

#### 3.1 Create Admin-Only Notification Types
- Separate notification type for approval events
- Ensure admin users only receive approval notifications
- Prevent admin users from receiving dashboard/unit-tracking notifications

#### 3.2 Update Emergency Routes
- Modify notification creation in emergency routes to respect role restrictions

### Phase 4: Testing and Validation

#### 4.1 Create Test Cases
- Test reporter users see no notifications
- Test admin users only see approval notifications
- Test authority users receive appropriate notifications

#### 4.2 Validation
- Ensure WebSocket connections are only established for admin users
- Verify notification counts are accurate per role
- Test notification filtering works correctly

## Files to be Modified

### Backend Files:
- `backend/routes/notification_routes.py` - Add role-based filtering
- `backend/routes/emergency_routes.py` - Update notification creation logic
- `backend/models/notification.py` - Add role-based query methods

### Frontend Files:
- `frontend/src/components/NotificationBadge.js` - Add role visibility check
- `frontend/src/hooks/useNotifications.js` - Add role-based initialization

### New/Enhanced Features:
- Role-based notification visibility
- Admin-only approval notifications
- Complete notification suppression for reporters

## Success Criteria
1. Reporter users see no notification bell icon
2. Reporter users receive no notifications
3. Admin users only receive approval-related notifications
4. Authority users continue to receive appropriate notifications
5. WebSocket connections only established for admin users
6. Notification counts accurate per role
