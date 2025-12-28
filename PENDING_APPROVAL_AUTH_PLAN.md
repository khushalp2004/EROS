# Pending Approval Authentication Implementation Plan

## Problem Statement
Current authentication system has issues when handling users who are:
1. **Verified but not approved**: Currently shows "Your account is pending approval" and logs them out
2. **Non-existent accounts**: Shows error popup revealing account doesn't exist

## Required Changes

### Backend Modifications

#### 1. Auth Service Changes (`backend/services/auth_service.py`)
- **Modify `authenticate_user` method** to handle verified but unapproved users
- **Add new return status** for pending approval users (without tokens)
- **Handle non-existent accounts** with generic messages

#### 2. Authentication Routes Changes (`backend/routes/auth_routes.py`)
- **Update login endpoint** to handle pending approval response
- **Return appropriate HTTP status codes** for different scenarios

### Frontend Modifications

#### 1. Create Pending Approval Page (`frontend/src/pages/PendingApproval.js`)
- **New component** to display pending approval message
- **User-friendly interface** explaining the situation
- **No access to dashboard** - purely informational

#### 2. Login Modal Changes (`frontend/src/components/LoginModal.js`)
- **Handle pending approval** case specially
- **Silent handling** of non-existent accounts (no error popup)
- **Redirect to pending approval page** when appropriate

#### 3. Auth Hook Updates (`frontend/src/hooks/useAuth.js`)
- **Support pending approval state**
- **Handle authentication flow** for pending users
- **Session management** for pending users

#### 4. App Routing Updates (`frontend/src/App.js`)
- **Add route** for pending approval page
- **Handle navigation** for pending users

## Implementation Steps

### Step 1: Backend Authentication Service Updates
1. Modify `authenticate_user` to return different statuses:
   - `success`: Fully authenticated (approved users)
   - `pending_approval`: Verified but not approved
   - `invalid_credentials`: Wrong password or non-existent account
   - `account_locked`: Temporarily locked account

2. Update token generation to only work for approved users

### Step 2: Backend API Response Updates
1. Update login endpoint to return appropriate status codes
2. Ensure consistent error messaging for security

### Step 3: Frontend Pending Approval Page
1. Create new `PendingApproval.js` component
2. Design user-friendly interface
3. Add proper styling and messaging

### Step 4: Frontend Login Flow Updates
1. Update `LoginModal.js` to handle new response statuses
2. Implement silent handling for non-existent accounts
3. Add navigation to pending approval page

### Step 5: Auth Context Updates
1. Update `useAuth.js` to support pending approval state
2. Handle different authentication scenarios

### Step 6: Routing and Navigation
1. Add pending approval route to `App.js`
2. Update navigation logic

## Security Considerations
1. **No sensitive data exposure** for non-existent accounts
2. **Proper session management** for pending users
3. **Token security** - only approved users get tokens
4. **Audit logging** for authentication attempts

## User Experience Goals
1. **Seamless flow** for pending approval users
2. **Clear communication** about account status
3. **No confusing error messages** for non-existent accounts
4. **Professional interface** for pending approval state

## Testing Requirements
1. Test verified but unapproved user login flow
2. Test non-existent account login (no error popup)
3. Test approved user login (existing functionality)
4. Test pending approval page display
5. Test session persistence for pending users

## Files to be Modified
- `backend/services/auth_service.py`
- `backend/routes/auth_routes.py`
- `frontend/src/pages/PendingApproval.js` (new)
- `frontend/src/components/LoginModal.js`
- `frontend/src/hooks/useAuth.js`
- `frontend/src/App.js`
