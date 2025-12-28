# EROS Authentication System Implementation Plan

## Overview
Implement a complete authentication system for EROS Emergency Response System with role-based access control, email verification, and admin approval workflow.

## Current System Analysis
- ✅ Flask backend with React frontend
- ✅ PostgreSQL database (Supabase)
- ✅ WebSocket support for real-time features
- ❌ No authentication system exists yet
- ✅ Current navigation: Reporter, Dashboard, Units Tracking

## Implementation Strategy

### Phase 1: Backend Authentication System

#### 1.1 Database Schema & Models
- **User Model** with fields:
  - id (Primary Key)
  - email (Unique)
  - password_hash (Bcrypt encrypted)
  - role (admin, authority, reporter)
  - is_verified (Boolean)
  - is_approved (Boolean - for admin approval)
  - verification_token (String)
  - password_reset_token (String)
  - created_at, updated_at (Timestamps)

#### 1.2 Authentication Routes
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify-email/<token>` - Email verification
- `POST /api/auth/resend-verification` - Resend verification email
- `GET /api/auth/profile` - Get current user profile

#### 1.3 Admin Routes
- `POST /api/admin/verify-user/<user_id>` - Admin approves new user
- `GET /api/admin/pending-users` - Get list of unapproved users
- `GET /api/admin/users` - Get all users (admin only)

#### 1.4 Email Service
- Email verification for new signups
- Admin notification for new user approvals
- Password reset emails

#### 1.5 JWT Token Management
- JWT token generation and validation
- Token refresh mechanism
- Secure token storage

### Phase 2: Frontend Authentication System

#### 2.1 Authentication Context
- React Context for authentication state
- Login/logout functions
- User session management

#### 2.2 Authentication Components
- `LoginForm.js` - Email/password login
- `SignupForm.js` - User registration with verification
- `ProtectedRoute.js` - Route protection component
- `AdminVerification.js` - Admin interface for user approval

#### 2.3 Navigation Updates
- Dynamic navbar based on authentication status
- Guest view: Only "Reporter" and "Admin Login" buttons
- Logged-in view: Full navigation with user menu
- Admin view: Additional admin controls

#### 2.4 API Integration
- Authentication API calls
- Automatic token attachment to requests
- Token refresh on 401 errors

### Phase 3: Security & Protection

#### 3.1 Route Protection
- Dashboard protection (logged-in users only)
- Units Tracking protection (logged-in users only)
- Admin routes protection (admin role only)

#### 3.2 Security Features
- Password strength validation
- Rate limiting for auth attempts
- Secure password hashing
- CSRF protection
- Input validation and sanitization

### Phase 4: Email System Setup

#### 4.1 Email Templates
- Welcome email with verification link
- Admin approval notification
- Password reset email

#### 4.2 Email Service Integration
- SMTP configuration
- Email queue system
- Error handling and retry logic

## Technical Requirements

### Backend Dependencies
- `flask-jwt-extended` - JWT token management
- `bcrypt` - Password hashing
- `flask-mail` - Email sending
- `email-validator` - Email validation
- `python-dotenv` - Environment variables

### Frontend Dependencies
- `react-router-dom` - Already installed
- `jwt-decode` - JWT token decoding
- `react-hook-form` - Form handling

## Implementation Steps

### Step 1: Backend Setup
1. Install authentication dependencies
2. Create User model
3. Implement authentication routes
4. Add JWT middleware
5. Create email service

### Step 2: Frontend Setup
1. Create authentication context
2. Build login/signup components
3. Implement protected routes
4. Update navigation logic
5. Add admin verification interface

### Step 3: Integration
1. Connect frontend to backend
2. Test authentication flow
3. Implement route protection
4. Test email verification
5. Test admin approval workflow

### Step 4: Security Testing
1. Test route protection
2. Test JWT token validation
3. Test email security
4. Test admin role restrictions

## Security Considerations

### Password Security
- Bcrypt hashing with proper salt rounds
- Password strength requirements
- Secure password reset flow

### Token Security
- Short-lived access tokens
- Secure token storage
- Token refresh mechanism
- Proper token invalidation

### Access Control
- Role-based permissions
- Route-level protection
- API endpoint security
- Input validation and sanitization

## Email Verification Flow

1. **User Signup**: User registers with email/password
2. **Verification Email**: System sends verification email to user
3. **Admin Notification**: Admin receives notification of new user
4. **Admin Approval**: Admin approves user through admin interface
5. **User Activation**: User can login after admin approval
6. **Email Verification**: User clicks verification link in email

## File Structure

```
backend/
├── models/
│   ├── user.py              # User model
│   ├── __init__.py          # Updated to include User
│   └── email_token.py       # Email verification tokens
├── routes/
│   ├── auth_routes.py       # Authentication endpoints
│   ├── admin_routes.py      # Admin endpoints
│   └── ...
├── services/
│   ├── email_service.py     # Email handling
│   ├── auth_service.py      # Authentication logic
│   └── token_service.py     # JWT token management
└── utils/
    ├── decorators.py        # Authentication decorators
    └── validators.py        # Input validation

frontend/
├── src/
│   ├── context/
│   │   └── AuthContext.js   # Authentication context
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.js
│   │   │   ├── SignupForm.js
│   │   │   └── AdminVerification.js
│   │   └── ProtectedRoute.js
│   ├── hooks/
│   │   └── useAuth.js       # Authentication hook
│   └── utils/
│       └── auth.js          # Auth utilities
```

## Success Criteria

1. ✅ Unauthenticated users can only access Reporter page
2. ✅ Authenticated users can access Dashboard and Units Tracking
3. ✅ Login form with email/password works correctly
4. ✅ Signup flow includes email verification
5. ✅ Admin approval system for new users
6. ✅ Dynamic navbar based on authentication status
7. ✅ Secure JWT token management
8. ✅ Role-based access control
9. ✅ Email notifications working correctly
10. ✅ Proper error handling and user feedback

## Timeline Estimate
- **Backend Implementation**: 2-3 hours
- **Frontend Implementation**: 2-3 hours
- **Integration & Testing**: 1-2 hours
- **Total Estimated Time**: 5-8 hours

This implementation will provide a robust, secure authentication system that meets all your requirements while maintaining the existing functionality of your EROS system.
