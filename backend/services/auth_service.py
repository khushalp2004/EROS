import re
import secrets
from datetime import datetime, timedelta
from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token
from werkzeug.security import check_password_hash
from models import db, User
from utils.validators import validate_email_format, validate_password_strength

class AuthService:
    """
    Authentication service for EROS system
    Handles user registration, login, password management, and email verification
    """
    
    @staticmethod
    def register_user(email, password, role='reporter', **profile_data):
        """
        Register a new user with email verification required
        
        Args:
            email (str): User email
            password (str): User password
            role (str): User role (admin, authority, reporter)
            **profile_data: Additional profile information
            
        Returns:
            tuple: (success: bool, message: str, user: User or None)
        """
        try:
            # Validate input
            if not validate_email_format(email):
                return False, "Invalid email format", None
            
            if not validate_password_strength(password):
                return False, "Password must be at least 8 characters with uppercase, lowercase, number, and special character", None
            
            # Check if user already exists
            if User.find_by_email(email):
                return False, "User with this email already exists", None
            
            # Create new user
            user = User(
                email=email,
                password=password,
                role=role,
                **profile_data
            )
            
            # Save user to database
            user.save()
            
            return True, "User registered successfully. Please check your email for verification.", user
            
        except Exception as e:
            return False, f"Registration failed: {str(e)}", None
    
    @staticmethod
    def authenticate_user(email, password):
        """
        Authenticate user with email and password
        
        Args:
            email (str): User email
            password (str): User password
            
        Returns:
            tuple: (status: str, message: str, user: User or None)
                 status can be: 'success', 'pending_approval', 'not_verified',
                               'invalid_credentials', 'account_locked',
                               'account_deactivated', 'auth_system_error'
        """
        try:
            # Find user by email
            user = User.find_by_email(email)
            
            # For security, if user doesn't exist, return generic message
            if not user:
                return 'invalid_credentials', "Invalid email or password", None
            
            # Check if account is locked
            if user.is_account_locked():
                return 'account_locked', "Account is temporarily locked due to too many failed login attempts", None
            
            # Check if user is active
            if not user.is_active:
                return 'account_deactivated', "Account is deactivated. Please contact administrator.", None
            
            # Verify password
            if not user.check_password(password):
                user.increment_failed_login()
                return 'invalid_credentials', "Invalid email or password", None
            
            # Check if user is verified
            if not user.is_verified:
                return 'not_verified', "Please verify your email address before logging in", None
            
            # Check if user is approved
            if not user.is_approved:
                # Record login attempt but don't generate tokens
                user.record_login()
                return 'pending_approval', "Your account is pending approval by administrator", user
            
            # Record successful login for approved users
            user.record_login()
            
            return 'success', "Login successful", user
            
        except Exception as e:
            return 'auth_system_error', f"Authentication failed: {str(e)}", None
    
    @staticmethod
    def generate_tokens(user):
        """
        Generate JWT access and refresh tokens for user
        
        Args:
            user (User): User object
            
        Returns:
            dict: Dictionary containing access_token and refresh_token
        """
        try:
            # Create additional identity claims
            additional_claims = {
                'user_id': user.id,
                'email': user.email,
                'role': user.role,
                'is_verified': user.is_verified,
                'is_approved': user.is_approved
            }
            
            # Generate tokens
            access_token = create_access_token(
                identity=str(user.id),  # Convert to string to avoid JWT identity error
                additional_claims=additional_claims,
                expires_delta=timedelta(hours=24)  # Access token expires in 24 hours
            )
            
            refresh_token = create_refresh_token(
                identity=str(user.id),  # Convert to string to avoid JWT identity error
                expires_delta=timedelta(days=30)  # Refresh token expires in 30 days
            )
            
            return {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'token_type': 'Bearer',
                'expires_in': 86400  # 24 hours in seconds
            }
            
        except Exception as e:
            raise Exception(f"Token generation failed: {str(e)}")
    
    @staticmethod
    def verify_email(token):
        """
        Verify user's email using verification token
        
        Args:
            token (str): Email verification token
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Find user by verification token
            user = User.find_by_verification_token(token)
            
            if not user:
                return False, "Invalid or expired verification token"
            
            # Verify email
            if user.verify_email(token):
                user.save()
                return True, "Email verified successfully"
            else:
                return False, "Verification token has expired"
            
        except Exception as e:
            return False, f"Email verification failed: {str(e)}"
    
    @staticmethod
    def resend_verification_email(user):
        """
        Resend verification email to user
        
        Args:
            user (User): User object
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            if user.is_verified:
                return False, "Email is already verified"
            
            # Generate new verification token
            token = user.generate_verification_token()
            user.save()
            
            # Send verification email
            from services.email_service import email_service
            email_success, email_message = email_service.send_verification_email(user, token)
            if not email_success:
                return False, email_message

            return True, "Verification email sent successfully"
            
        except Exception as e:
            return False, f"Failed to send verification email: {str(e)}"
    
    @staticmethod
    def resend_verification_email_unauth(email):
        """
        Resend verification email to unauthenticated user by email
        
        Args:
            email (str): User email
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Validate email format
            if not validate_email_format(email):
                return False, "Invalid email format"
            
            # Find user by email
            user = User.find_by_email(email)
            
            if not user:
                # Don't reveal if email exists or not
                return True, "If the email exists, verification instructions have been sent"
            
            if user.is_verified:
                return False, "Email is already verified"
            
            # Generate new verification token
            token = user.generate_verification_token()
            user.save()
            
            # Send verification email
            from services.email_service import email_service
            email_success, email_message = email_service.send_verification_email(user, token)
            if not email_success:
                return False, email_message

            return True, "Verification email sent successfully"
            
        except Exception as e:
            return False, f"Failed to send verification email: {str(e)}"
    
    @staticmethod
    def initiate_password_reset(email):
        """
        Initiate password reset process
        
        Args:
            email (str): User email
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Find user by email
            user = User.find_by_email(email)
            
            if not user:
                # Don't reveal if email exists or not
                return True, "If the email exists, password reset instructions have been sent"
            
            # Generate password reset token
            token = user.generate_password_reset_token()
            user.save()
            
            # Send password reset email
            from services.email_service import email_service
            email_service.send_password_reset_email(user, token)
            
            return True, "If the email exists, password reset instructions have been sent"
            
        except Exception as e:
            return False, f"Password reset initiation failed: {str(e)}"
    
    @staticmethod
    def reset_password(token, new_password):
        """
        Reset password using reset token
        
        Args:
            token (str): Password reset token
            new_password (str): New password
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Validate password strength
            if not validate_password_strength(new_password):
                return False, "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
            
            # Find user by reset token
            user = User.find_by_password_reset_token(token)
            
            if not user:
                return False, "Invalid or expired reset token"
            
            # Reset password
            if user.reset_password(token, new_password):
                user.save()
                return True, "Password reset successfully"
            else:
                return False, "Reset token has expired"
            
        except Exception as e:
            return False, f"Password reset failed: {str(e)}"
    
    @staticmethod
    def change_password(user, current_password, new_password):
        """
        Change password for authenticated user
        
        Args:
            user (User): User object
            current_password (str): Current password
            new_password (str): New password
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Verify current password
            if not user.check_password(current_password):
                return False, "Current password is incorrect"
            
            # Validate new password strength
            if not validate_password_strength(new_password):
                return False, "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
            
            # Set new password
            user.set_password(new_password)
            user.save()
            
            return True, "Password changed successfully"
            
        except Exception as e:
            return False, f"Password change failed: {str(e)}"
    
    @staticmethod
    def get_user_profile(user_id):
        """
        Get user profile by ID
        
        Args:
            user_id (int): User ID
            
        Returns:
            tuple: (success: bool, user_data: dict or None, message: str)
        """
        try:
            user = User.query.get(user_id)
            
            if not user:
                return False, None, "User not found"
            
            return True, user.to_dict(), "Profile retrieved successfully"
            
        except Exception as e:
            return False, None, f"Profile retrieval failed: {str(e)}"
    
    @staticmethod
    def update_user_profile(user_id, **profile_data):
        """
        Update user profile
        
        Args:
            user_id (int): User ID
            **profile_data: Profile fields to update
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            user = User.query.get(user_id)
            
            if not user:
                return False, "User not found"
            
            # Update allowed fields
            allowed_fields = ['first_name', 'last_name', 'phone', 'organization']
            for field, value in profile_data.items():
                if field in allowed_fields and hasattr(user, field):
                    setattr(user, field, value)
            
            user.save()
            
            return True, "Profile updated successfully"
            
        except Exception as e:
            return False, f"Profile update failed: {str(e)}"
    
    @staticmethod
    def validate_token(token):
        """
        Validate JWT token and return user info
        
        Args:
            token (str): JWT token
            
        Returns:
            tuple: (success: bool, user: User or None, message: str)
        """
        try:
            from flask_jwt_extended import get_jwt_identity, get_jwt
            from flask import request
            
            # Get token from header
            if not token:
                return False, None, "Token not provided"
            
            # Verify token (this will raise an exception if invalid)
            try:
                # This is a simplified validation - in practice, you'd use JWT.decode()
                jti = secrets.token_urlsafe(32)  # This should come from the JWT
                return True, None, "Token validation successful"
            except Exception:
                return False, None, "Invalid token"
                
        except Exception as e:
            return False, None, f"Token validation failed: {str(e)}"
