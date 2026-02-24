from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, 
    get_jwt_identity, get_jwt
)
from werkzeug.security import check_password_hash
from models import db, User
from services.auth_service import AuthService
from extensions import limiter
from token_blocklist import revoke_token
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from config import SECRET_KEY

from utils.validators import validate_required_fields, validate_email, validate_password_strength
import os
import threading
import secrets

try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    GOOGLE_AUTH_IMPORT_ERROR = None
except Exception as exc:
    google_id_token = None
    google_requests = None
    GOOGLE_AUTH_IMPORT_ERROR = str(exc)

# Create blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
PENDING_APPROVAL_TOKEN_SALT = "pending-approval-v1"
PENDING_APPROVAL_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60  # 7 days


def _pending_serializer():
    return URLSafeTimedSerializer(SECRET_KEY, salt=PENDING_APPROVAL_TOKEN_SALT)


def _issue_pending_token(user):
    return _pending_serializer().dumps({
        "user_id": int(user.id),
        "email": (user.email or "").strip().lower()
    })


def _verify_pending_token(token):
    return _pending_serializer().loads(token, max_age=PENDING_APPROVAL_TOKEN_MAX_AGE_SECONDS)


def _issue_auth_response(user, success_message='Login successful'):
    """Return the same auth response shapes used by password login."""
    if user.is_account_locked():
        return jsonify({
            'success': False,
            'status': 'account_locked',
            'message': "Account is temporarily locked due to too many failed login attempts"
        }), 423

    if not user.is_active:
        return jsonify({
            'success': False,
            'status': 'account_deactivated',
            'message': "Account is deactivated. Please contact administrator."
        }), 403

    if not user.is_verified:
        return jsonify({
            'success': False,
            'status': 'not_verified',
            'message': "Please verify your email address before logging in"
        }), 401

    if not user.is_approved:
        user.record_login()
        db.session.add(user)
        db.session.commit()
        pending_token = _issue_pending_token(user)
        return jsonify({
            'success': True,
            'status': 'pending_approval',
            'message': "Your account is pending approval by administrator",
            'pending_token': pending_token,
            'user': {
                'id': user.id,
                'email': user.email,
                'role': user.role,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_verified': user.is_verified,
                'is_approved': user.is_approved,
                'created_at': user.created_at.isoformat()
            }
        }), 200

    user.record_login()
    db.session.add(user)
    db.session.commit()
    tokens = AuthService.generate_tokens(user)
    return jsonify({
        'success': True,
        'status': 'success',
        'message': success_message,
        'access_token': tokens['access_token'],
        'refresh_token': tokens['refresh_token'],
        'token_type': tokens['token_type'],
        'expires_in': tokens['expires_in'],
        'user': user.to_dict()
    }), 200


def _notify_admin_for_authority_signup(user):
    """Notify admin when a new authority user signs up via Google."""
    try:
        approval_token = user.generate_approval_token()
        user.save()
        base_url = os.getenv('BACKEND_BASE_URL', request.url_root.rstrip('/'))
        direct_approve_url = f"{base_url}/api/admin/direct-approve/{approval_token}"
        from services.email_service import email_service
        admin_success, admin_message = email_service.send_admin_new_user_notification(
            user,
            direct_approve_url=direct_approve_url
        )
        return admin_success, admin_message
    except Exception as exc:
        return False, f"Admin notification failed: {exc}"


def _send_signup_emails_async(app, user_id):
    """Send signup emails in background so signup response is fast."""
    try:
        with app.app_context():
            user = User.query.get(user_id)
            if not user:
                return

            from services.email_service import email_service

            verification_token = user.verification_token
            email_success, email_message = email_service.send_verification_email(user, verification_token)
            print(f"[Async] Verification email sent: {email_success} - {email_message}")
    except Exception as exc:
        print(f"[Async] Signup email error: {exc}")

@auth_bp.route('/signup', methods=['POST'])
@limiter.limit("5 per minute")
def signup():
    """
    Register a new user
    POST /api/auth/signup
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "SecurePass123!",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1234567890",
        "organization": "City Fire Department",
        "role": "reporter"  # optional, defaults to 'reporter'
    }
    
    Response:
    {
        "success": true,
        "message": "User registered successfully. Please check your email for verification.",
        "user_id": 1
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        # Validate required fields
        required_fields = ['email', 'password']
        is_valid, missing_fields = validate_required_fields(data, required_fields)
        
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Extract user data
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        phone = data.get('phone', '').strip()
        organization = data.get('organization', '').strip()
        role = data.get('role', 'reporter').strip().lower()
        
        # Additional profile data
        profile_data = {
            'first_name': first_name,
            'last_name': last_name,
            'phone': phone,
            'organization': organization
        }
        
        # Validate role
        if role not in ['admin', 'authority', 'reporter', 'unit']:
            return jsonify({
                'success': False,
                'message': 'Invalid role. Must be admin, authority, reporter, or unit'
            }), 400
        
        # Register user
        success, message, user = AuthService.register_user(
            email=email,
            password=password,
            role=role,
            **profile_data
        )
        
        if success:
            app_obj = current_app._get_current_object()
            threading.Thread(
                target=_send_signup_emails_async,
                args=(app_obj, user.id),
                daemon=True
            ).start()

            return jsonify({
                'success': True,
                'message': message,
                'user_id': user.id,
                'email_queued': True,
                'verification_email_message': 'Verification email is being sent.',
                'admin_notified': False,
                'admin_notification_message': 'Admin will be notified after authority email verification.'
            }), 201
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Signup failed: {str(e)}'
        }), 500

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    Authenticate user and return tokens
    POST /api/auth/login
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "SecurePass123!"
    }
    
    Response:
    {
        "success": true,
        "message": "Login successful",
        "access_token": "eyJ...",
        "refresh_token": "eyJ...",
        "user": {
            "id": 1,
            "email": "user@example.com",
            "role": "reporter",
            "first_name": "John",
            "last_name": "Doe"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        # Validate required fields
        required_fields = ['email', 'password']
        is_valid, missing_fields = validate_required_fields(data, required_fields)
        
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Extract credentials
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Authenticate user
        status, message, user = AuthService.authenticate_user(email, password)
        print(f"🔐 Login attempt status={status}")
        
        if status == 'success':
            # Generate tokens for approved users
            tokens = AuthService.generate_tokens(user)
            
            return jsonify({
                'success': True,
                'status': 'success',
                'message': message,
                'access_token': tokens['access_token'],
                'refresh_token': tokens['refresh_token'],
                'token_type': tokens['token_type'],
                'expires_in': tokens['expires_in'],
                'user': user.to_dict()
            }), 200
            
        elif status == 'pending_approval':
            # User is verified but not approved - don't generate tokens
            pending_token = _issue_pending_token(user)
            return jsonify({
                'success': True,
                'status': 'pending_approval',
                'message': message,
                'pending_token': pending_token,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_verified': user.is_verified,
                    'is_approved': user.is_approved,
                    'created_at': user.created_at.isoformat()
                }
            }), 200
            
        elif status == 'not_verified':
            return jsonify({
                'success': False,
                'status': 'not_verified',
                'message': message
            }), 401
            
        elif status == 'account_locked':
            return jsonify({
                'success': False,
                'status': 'account_locked',
                'message': message
            }), 423  # Locked status
            
        elif status == 'account_deactivated':
            return jsonify({
                'success': False,
                'status': 'account_deactivated',
                'message': message
            }), 403  # Forbidden status

        elif status == 'auth_system_error':
            return jsonify({
                'success': False,
                'status': 'auth_system_error',
                'message': message
            }), 500

        else:  # invalid_credentials
            # For security, use generic message and 401 status
            return jsonify({
                'success': False,
                'status': 'invalid_credentials',
                'message': message
            }), 401
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Login failed: {str(e)}'
        }), 500


@auth_bp.route('/google', methods=['POST'])
@limiter.limit("20 per minute")
def google_auth():
    """
    Authenticate or register a user via Google ID token.
    POST /api/auth/google
    """
    try:
        if google_id_token is None or google_requests is None:
            return jsonify({
                'success': False,
                'message': f'Google auth dependency missing on server: {GOOGLE_AUTH_IMPORT_ERROR or "unknown import error"}'
            }), 500

        data = request.get_json() or {}
        id_token_value = (data.get('id_token') or '').strip()
        mode = (data.get('mode') or 'login').strip().lower()
        role = (data.get('role') or 'authority').strip().lower()

        if mode not in {'login', 'signup'}:
            return jsonify({
                'success': False,
                'message': 'Invalid mode. Must be login or signup.'
            }), 400

        if not id_token_value:
            return jsonify({
                'success': False,
                'message': 'Google id_token is required'
            }), 400

        google_client_id = (os.getenv('GOOGLE_CLIENT_ID') or '').strip()
        if not google_client_id:
            return jsonify({
                'success': False,
                'message': 'Google OAuth is not configured'
            }), 500

        token_info = google_id_token.verify_oauth2_token(
            id_token_value,
            google_requests.Request(),
            google_client_id
        )

        issuer = token_info.get('iss')
        if issuer not in {'accounts.google.com', 'https://accounts.google.com'}:
            return jsonify({
                'success': False,
                'message': 'Invalid token issuer'
            }), 401

        if not token_info.get('email_verified'):
            return jsonify({
                'success': False,
                'message': 'Google account email is not verified'
            }), 401

        email = (token_info.get('email') or '').strip().lower()
        if not email:
            return jsonify({
                'success': False,
                'message': 'Google account email not found'
            }), 400

        user = User.find_by_email(email)

        if mode == 'login':
            if not user:
                return jsonify({
                    'success': False,
                    'status': 'account_not_found',
                    'message': 'Account not found. Please sign up first.'
                }), 404

            if not user.is_verified:
                user.is_verified = True
                user.verification_token = None
                user.verification_expires_at = None
                db.session.add(user)
                db.session.commit()

            return _issue_auth_response(user, success_message='Login successful')

        # signup mode
        if role not in ['admin', 'authority', 'reporter', 'unit']:
            return jsonify({
                'success': False,
                'message': 'Invalid role. Must be admin, authority, reporter, or unit'
            }), 400

        if user:
            return jsonify({
                'success': False,
                'status': 'account_exists',
                'message': 'User with this email already exists. Please login with Google.'
            }), 409

        first_name = (data.get('first_name') or token_info.get('given_name') or '').strip()
        last_name = (data.get('last_name') or token_info.get('family_name') or '').strip()
        phone = (data.get('phone') or '').strip()
        organization = (data.get('organization') or '').strip()

        random_password = f"{secrets.token_urlsafe(24)}Aa1!"
        user = User(
            email=email,
            password=random_password,
            role=role,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            organization=organization
        )
        user.is_verified = True
        user.verification_token = None
        user.verification_expires_at = None
        user.save()

        admin_notified = False
        admin_notification_message = 'Admin notification not required for this role.'
        if user.role == 'authority':
            admin_notified, admin_notification_message = _notify_admin_for_authority_signup(user)

        response, status_code = _issue_auth_response(user, success_message='Signup successful')
        payload = response.get_json() or {}
        payload['admin_notified'] = admin_notified
        payload['admin_notification_message'] = admin_notification_message
        return jsonify(payload), status_code

    except ValueError:
        return jsonify({
            'success': False,
            'message': 'Invalid Google token'
        }), 401
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Google authentication failed: {str(e)}'
        }), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout user (invalidate tokens)
    POST /api/auth/logout
    
    Headers:
    Authorization: Bearer <access_token>
    
    Response:
    {
        "success": true,
        "message": "Successfully logged out"
    }
    """
    try:
        token_payload = get_jwt()
        revoke_token(token_payload.get("jti"))
        
        return jsonify({
            'success': True,
            'message': 'Successfully logged out and token invalidated'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Logout failed: {str(e)}'
        }), 500

@auth_bp.route('/verify-email/<token>', methods=['GET'])
def verify_email(token):
    """
    Verify user email using verification token
    GET /api/auth/verify-email/<token>
    
    URL Parameter:
    token (str): Email verification token
    
    Response:
    {
        "success": true,
        "message": "Email verified successfully",
        "redirect": "/login?verified=true"
    }
    """
    try:
        pending_user = User.find_by_verification_token(token)

        # Verify email
        success, message = AuthService.verify_email(token)
        
        if success:
            admin_notified = False
            admin_notification_message = "Admin notification not required for this role."
            # Notify admin only for authority role after successful verification.
            if pending_user and pending_user.role == 'authority':
                approval_token = pending_user.generate_approval_token()
                pending_user.save()
                base_url = os.getenv('BACKEND_BASE_URL', request.url_root.rstrip('/'))
                direct_approve_url = f"{base_url}/api/admin/direct-approve/{approval_token}"
                from services.email_service import email_service
                admin_success, admin_message = email_service.send_admin_new_user_notification(
                    pending_user,
                    direct_approve_url=direct_approve_url
                )
                admin_notified = admin_success
                admin_notification_message = admin_message
                print(f"[Verify] Admin notification sent: {admin_success} - {admin_message}")

            return jsonify({
                'success': True,
                'message': message,
                'redirect': '/login?verified=true',
                'admin_notified': admin_notified,
                'admin_notification_message': admin_notification_message
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': message,
                'redirect': '/signup?error=verification_failed'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Email verification failed: {str(e)}',
            'redirect': '/signup?error=verification_error'
        }), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    Get current user profile
    GET /api/auth/profile
    
    Headers:
    Authorization: Bearer <access_token>
    
    Response:
    {
        "success": true,
        "user": {
            "id": 1,
            "email": "user@example.com",
            "role": "reporter",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "+1234567890",
            "organization": "City Fire Department",
            "is_verified": true,
            "is_approved": true,
            "is_active": true,
            "last_login": "2024-01-01T10:00:00",
            "created_at": "2024-01-01T09:00:00"
        }
    }
    """
    try:
        # Get current user ID
        current_user_id = get_jwt_identity()
        
        # Get user profile
        success, user_data, message = AuthService.get_user_profile(current_user_id)
        
        if success:
            return jsonify({
                'success': True,
                'user': user_data,
                'message': message
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Profile retrieval failed: {str(e)}'
        }), 500

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """
    Update current user profile
    PUT /api/auth/profile
    
    Headers:
    Authorization: Bearer <access_token>
    
    Request Body:
    {
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1234567890",
        "organization": "City Fire Department"
    }
    
    Response:
    {
        "success": true,
        "message": "Profile updated successfully"
    }
    """
    try:
        # Get current user ID
        current_user_id = get_jwt_identity()
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        # Update profile
        success, message = AuthService.update_user_profile(current_user_id, **data)
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Profile update failed: {str(e)}'
        }), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token using refresh token
    POST /api/auth/refresh
    
    Headers:
    Authorization: Bearer <refresh_token>
    
    Response:
    {
        "success": true,
        "access_token": "eyJ...",
        "token_type": "Bearer",
        "expires_in": 86400
    }
    """
    try:
        # Get current user ID
        current_user_id = get_jwt_identity()
        
        # Get user
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active:
            return jsonify({
                'success': False,
                'message': 'User not found or inactive'
            }), 404
        
        # Generate new access token
        tokens = AuthService.generate_tokens(user)
        
        return jsonify({
            'success': True,
            'access_token': tokens['access_token'],
            'token_type': tokens['token_type'],
            'expires_in': tokens['expires_in']
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Token refresh failed: {str(e)}'
        }), 500

@auth_bp.route('/resend-verification', methods=['POST'])
@jwt_required()
def resend_verification():
    """
    Resend verification email to current user
    POST /api/auth/resend-verification
    
    Headers:
    Authorization: Bearer <access_token>
    
    Response:
    {
        "success": true,
        "message": "Verification email sent successfully"
    }
    """
    try:
        # Get current user ID
        current_user_id = get_jwt_identity()
        
        # Get user
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Resend verification email
        success, message = AuthService.resend_verification_email(user)
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Resend verification failed: {str(e)}'
        }), 500

@auth_bp.route('/resend-verification-unauth', methods=['POST'])
@limiter.limit("5 per hour")
def resend_verification_unauth():
    """
    Resend verification email to unauthenticated user by email
    POST /api/auth/resend-verification-unauth
    
    Request Body:
    {
        "email": "user@example.com"
    }
    
    Response:
    {
        "success": true,
        "message": "If the email exists, verification instructions have been sent"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'email' not in data:
            return jsonify({
                'success': False,
                'message': 'Email is required'
            }), 400
        
        email = data['email'].strip().lower()
        
        # Validate email format
        if not validate_email(email):
            return jsonify({
                'success': False,
                'message': 'Invalid email format'
            }), 400
        
        # Resend verification email
        success, message = AuthService.resend_verification_email_unauth(email)
        
        # Always return success message for security (don't reveal if email exists)
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Resend verification failed: {str(e)}'
        }), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change password for authenticated user
    POST /api/auth/change-password
    
    Headers:
    Authorization: Bearer <access_token>
    
    Request Body:
    {
        "current_password": "OldPass123!",
        "new_password": "NewSecurePass456!"
    }
    
    Response:
    {
        "success": true,
        "message": "Password changed successfully"
    }
    """
    try:
        # Get current user ID
        current_user_id = get_jwt_identity()
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        # Validate required fields
        required_fields = ['current_password', 'new_password']
        is_valid, missing_fields = validate_required_fields(data, required_fields)
        
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Get user
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Change password
        success, message = AuthService.change_password(
            user, 
            data['current_password'], 
            data['new_password']
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Password change failed: {str(e)}'
        }), 500

@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per hour")
def forgot_password():
    """
    Initiate password reset process
    POST /api/auth/forgot-password
    
    Request Body:
    {
        "email": "user@example.com"
    }
    
    Response:
    {
        "success": true,
        "message": "If the email exists, password reset instructions have been sent"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'email' not in data:
            return jsonify({
                'success': False,
                'message': 'Email is required'
            }), 400
        
        email = data['email'].strip().lower()
        
        # Initiate password reset
        success, message = AuthService.initiate_password_reset(email)
        
        # Always return success message for security (don't reveal if email exists)
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Password reset initiation failed: {str(e)}'
        }), 500

@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("10 per hour")
def reset_password():
    """
    Reset password using reset token
    POST /api/auth/reset-password
    
    Request Body:
    {
        "token": "reset_token_here",
        "new_password": "NewSecurePass456!"
    }
    
    Response:
    {
        "success": true,
        "message": "Password reset successfully"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        # Validate required fields
        required_fields = ['token', 'new_password']
        is_valid, missing_fields = validate_required_fields(data, required_fields)
        
        if not is_valid:
            return jsonify({
                'success': False,
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Reset password
        success, message = AuthService.reset_password(
            data['token'], 
            data['new_password']
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Password reset failed: {str(e)}'
        }), 500

@auth_bp.route('/check-approval-status', methods=['POST'])
def check_approval_status():
    """
    Check if pending approval user has been approved
    POST /api/auth/check-approval-status
    
    Request Body:
    {
        "email": "user@example.com"
    }
    
    Response:
    {
        "success": true,
        "approved": false,
        "user": {
            "id": 1,
            "email": "user@example.com",
            "role": "reporter",
            "first_name": "John",
            "last_name": "Doe",
            "is_verified": true,
            "is_approved": false
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'email' not in data:
            return jsonify({
                'success': False,
                'message': 'Email is required'
            }), 400
        
        email = data['email'].strip().lower()
        pending_token = data.get('pending_token')
        pending_payload = None

        # Legacy fallback: allow status check by email when pending token is unavailable.
        if pending_token:
            try:
                pending_payload = _verify_pending_token(pending_token)
            except SignatureExpired:
                return jsonify({
                    'success': False,
                    'message': 'Pending approval session expired. Please log in again.'
                }), 401
            except BadSignature:
                return jsonify({
                    'success': False,
                    'message': 'Invalid pending approval session. Please log in again.'
                }), 401
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        if pending_payload and (
            str(pending_payload.get('user_id')) != str(user.id) or
            (pending_payload.get('email') or '').strip().lower() != email
        ):
            return jsonify({
                'success': False,
                'message': 'Pending approval session does not match this user.'
            }), 401

        is_rejected = not user.is_active

        if is_rejected:
            rejection_message = 'Your registration request has been rejected by administrator.'
            if user.is_approved:
                rejection_message = 'Your account has been deactivated by administrator.'
            return jsonify({
                'success': True,
                'approved': False,
                'verified': user.is_verified,
                'rejected': True,
                'message': rejection_message,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_verified': user.is_verified,
                    'is_approved': user.is_approved,
                    'is_active': user.is_active,
                    'created_at': user.created_at.isoformat()
                }
            }), 200

        if user.is_approved and user.is_verified and user.is_active:
            tokens = AuthService.generate_tokens(user)
            user.record_login()
            db.session.add(user)
            db.session.commit()
            return jsonify({
                'success': True,
                'approved': True,
                'verified': True,
                'rejected': False,
                'status': 'success',
                'message': 'Your account has been approved',
                'access_token': tokens['access_token'],
                'refresh_token': tokens['refresh_token'],
                'token_type': tokens['token_type'],
                'expires_in': tokens['expires_in'],
                'user': user.to_dict()
            }), 200
        
        # Return user status
        return jsonify({
            'success': True,
            'approved': user.is_approved,
            'verified': user.is_verified,
            'rejected': False,
            'user': {
                'id': user.id,
                'email': user.email,
                'role': user.role,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_verified': user.is_verified,
                'is_approved': user.is_approved,
                'is_active': user.is_active,
                'created_at': user.created_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Status check failed: {str(e)}'
        }), 500


@auth_bp.route('/request-approval-again', methods=['POST'])
def request_approval_again():
    """
    Re-activate a previously rejected user so they can be reviewed again.
    POST /api/auth/request-approval-again
    """
    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()

        if not email:
            return jsonify({
                'success': False,
                'message': 'Email is required'
            }), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        if user.is_approved and user.is_active:
            return jsonify({
                'success': False,
                'message': 'Account is already approved and active.'
            }), 400

        if not user.is_verified:
            return jsonify({
                'success': False,
                'message': 'Please verify your email before requesting approval again.'
            }), 400

        if user.is_approved and not user.is_active:
            return jsonify({
                'success': False,
                'message': 'This account was deactivated. Please contact administrator.'
            }), 400

        user.is_active = True
        db.session.add(user)
        db.session.commit()

        admin_notified = False
        admin_notification_message = 'Admin notification not required for this role.'
        if user.role == 'authority':
            admin_notified, admin_notification_message = _notify_admin_for_authority_signup(user)

        return jsonify({
            'success': True,
            'message': 'Request submitted again. Please wait for admin approval.',
            'admin_notified': admin_notified,
            'admin_notification_message': admin_notification_message
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Request failed: {str(e)}'
        }), 500

@auth_bp.route('/status', methods=['GET'])
def auth_status():
    """
    Check authentication status (no auth required)
    GET /api/auth/status
    
    Response:
    {
        "success": true,
        "authenticated": false,
        "message": "Authentication service is running"
    }
    """
    return jsonify({
        'success': True,
        'authenticated': False,
        'message': 'Authentication service is running'
    }), 200

# Error handlers for JWT
@auth_bp.errorhandler(422)
def handle_unprocessable_entity(error):
    """Handle JWT validation errors"""
    return jsonify({
        'success': False,
        'message': 'Invalid token or missing required fields',
        'error': 'VALIDATION_ERROR'
    }), 422

@auth_bp.errorhandler(401)
def handle_unauthorized(error):
    """Handle unauthorized access"""
    return jsonify({
        'success': False,
        'message': 'Invalid or expired token',
        'error': 'UNAUTHORIZED'
    }), 401
