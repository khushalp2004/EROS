# Email Verification Popup Enhancement Plan

## Objective
Modify the signup process to keep the verification popup open until the user verifies their account, with a resend verification link option.

## Current Behavior Analysis
- SignupModal automatically closes after 3 seconds with success message
- User receives verification email but popup closes before they can act
- No resend verification option in the popup

## Required Changes

### 1. Backend Changes

#### Add Unauthenticated Resend Verification Endpoint
- **File:** `backend/routes/auth_routes.py`
- **New Endpoint:** `/api/auth/resend-verification-unauth`
- **Purpose:** Allow users to resend verification email without JWT authentication
- **Method:** POST
- **Request Body:** `{ "email": "user@example.com" }`

#### Modify Auth Service
- **File:** `backend/services/auth_service.py`
- **Add Method:** `resend_verification_email_unauth(email)`
- **Purpose:** Handle resend verification for unauthenticated users

### 2. Frontend Changes

#### Modify SignupModal.js
- Remove auto-close timeout after successful signup
- Add verification pending state
- Add resend verification functionality
- Keep popup open until verification is complete
- Add proper loading states and error handling

#### Update API
- **File:** `frontend/src/api.js`
- **Add Method:** `resendVerificationUnauth(email)`
- **Purpose:** Call backend endpoint for unauthenticated resend

### 3. State Management
- Add `verificationPending` state to SignupModal
- Add `canResend` state with cooldown timer
- Add `resendLoading` state for button loading

### 4. UI/UX Improvements
- Show clear verification instructions
- Add countdown timer for resend button
- Show success/error messages for resend action
- Add option to close popup manually if needed

## Implementation Steps

### Step 1: Backend Implementation
1. Add new resend verification endpoint
2. Update AuthService with unauthenticated resend method
3. Test the endpoint

### Step 2: Frontend API Update
1. Add resendVerificationUnauth method to api.js
2. Add proper error handling

### Step 3: SignupModal Enhancement
1. Remove auto-close behavior
2. Add verification pending UI state
3. Implement resend functionality
4. Add state management for verification process
5. Add proper loading and error states

### Step 4: Testing
1. Test signup flow
2. Test verification pending state
3. Test resend verification functionality
4. Test popup auto-close after verification

## Files to Modify
1. `backend/routes/auth_routes.py` - Add new endpoint
2. `backend/services/auth_service.py` - Add resend method
3. `frontend/src/api.js` - Add API method
4. `frontend/src/components/SignupModal.js` - Main implementation

## Expected User Flow
1. User fills signup form
2. User submits form
3. Popup shows "Verification email sent" message
4. Popup stays open with resend option
5. User clicks verification link from email
6. Popup detects verification (optional - may require additional polling)
7. Popup closes automatically or shows success message

## Technical Considerations
- Need to handle edge cases (expired tokens, invalid emails)
- Add proper rate limiting for resend requests
- Ensure popup doesn't stay open indefinitely
- Add manual close option as fallback
