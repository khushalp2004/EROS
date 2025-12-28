from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import string
from sqlalchemy import func
from . import db

class User(db.Model):
    """
    User model for EROS Authentication System
    Supports role-based access control with admin approval workflow
    """
    
    __tablename__ = 'users'
    
    # Primary key
    id = db.Column(db.Integer, primary_key=True)
    
    # Authentication fields
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Role and permissions
    role = db.Column(db.String(20), nullable=False, default='reporter')
    
    # Account status
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    is_approved = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Email verification
    verification_token = db.Column(db.String(100), unique=True, nullable=True)
    verification_expires_at = db.Column(db.DateTime, nullable=True, default=None)
    
    # Password reset
    password_reset_token = db.Column(db.String(100), unique=True, nullable=True)
    password_reset_expires_at = db.Column(db.DateTime, nullable=True)
    
    # Admin approval token for direct email approval
    approval_token = db.Column(db.String(100), unique=True, nullable=True)
    approval_expires_at = db.Column(db.DateTime, nullable=True)
    
    # Profile information
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    organization = db.Column(db.String(100), nullable=True)
    
    # Security fields
    last_login = db.Column(db.DateTime, nullable=True)
    failed_login_attempts = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __init__(self, email, password, role='reporter', **kwargs):
        """
        Initialize a new user with hashed password
        """
        self.email = email.lower().strip()
        self.password_hash = self._hash_password(password)
        self.role = role
        # Set verification token and expiration (24 hours from now)
        self.verification_token = self._generate_verification_token()
        from datetime import timedelta
        self.verification_expires_at = datetime.utcnow() + timedelta(hours=24)
        # Set additional fields from kwargs
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    def _hash_password(self, password):
        """Hash password using Werkzeug's security functions"""
        return generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)
    
    def _generate_verification_token(self):
        """Generate a secure verification token"""
        return secrets.token_urlsafe(32)
    
    def _generate_password_reset_token(self):
        """Generate a secure password reset token"""
        return secrets.token_urlsafe(32)
    
    def _generate_approval_token(self):
        """Generate a secure approval token for direct admin approval"""
        return secrets.token_urlsafe(32)
    
    def check_password(self, password):
        """Check if provided password matches the hash"""
        return check_password_hash(self.password_hash, password)
    
    def set_password(self, new_password):
        """Set a new password (with hashing)"""
        self.password_hash = self._hash_password(new_password)
        self.password_reset_token = None
        self.password_reset_expires_at = None
    
    def generate_verification_token(self):
        """Generate and set a new verification token"""
        self.verification_token = self._generate_verification_token()
        self.verification_expires_at = datetime.utcnow()
        return self.verification_token
    
    def generate_password_reset_token(self):
        """Generate and set a new password reset token"""
        self.password_reset_token = self._generate_password_reset_token()
        from datetime import timedelta
        self.password_reset_expires_at = datetime.utcnow() + timedelta(hours=1)
        return self.password_reset_token
    
    def generate_approval_token(self):
        """Generate and set a new approval token for direct admin approval"""
        self.approval_token = self._generate_approval_token()
        from datetime import timedelta
        self.approval_expires_at = datetime.utcnow() + timedelta(hours=24)
        return self.approval_token
    
    def approve_via_direct_token(self, token):
        """
        Approve user using direct approval token (no login required)
        
        Args:
            token (str): The approval token from admin email
            
        Returns:
            tuple: (success: bool, message: str)
        """
        # Check if token matches and is not expired
        if (self.approval_token == token and 
            self.approval_expires_at and 
            datetime.utcnow() <= self.approval_expires_at):
            
            # Check if user is verified (must verify email first)
            if not self.is_verified:
                return False, "Cannot approve user - email not verified"
            
            # Approve user
            self.is_approved = True
            
            # Generate approval confirmation for audit
            self.approval_token = None  # One-time use
            self.approval_expires_at = None
            
            # Save changes
            self.save()
            
            return True, "User approved successfully via direct token"
        
        elif self.approval_token != token:
            return False, "Invalid approval token"
        else:
            return False, "Approval token has expired"
    
    def verify_email(self, token):
        """Verify email using provided token"""
        if (self.verification_token == token and 
            self.verification_expires_at and 
            datetime.utcnow() <= self.verification_expires_at):
            self.is_verified = True
            self.verification_token = None
            self.verification_expires_at = None
            return True
        return False
    
    def reset_password(self, token, new_password):
        """Reset password using provided token"""
        if (self.password_reset_token == token and 
            self.password_reset_expires_at and 
            datetime.utcnow() <= self.password_reset_expires_at):
            self.set_password(new_password)
            return True
        return False
    
    def approve_user(self):
        """Approve the user (admin action)"""
        self.is_approved = True
    
    def activate_user(self):
        """Activate a verified and approved user"""
        if self.is_verified and self.is_approved:
            self.is_active = True
            return True
        return False
    
    def deactivate_user(self):
        """Deactivate the user"""
        self.is_active = False
    
    def lock_account(self, duration_hours=24):
        """Lock user account for specified duration"""
        from datetime import timedelta
        self.locked_until = datetime.utcnow() + timedelta(hours=duration_hours)
        self.failed_login_attempts = 0
    
    def unlock_account(self):
        """Unlock user account"""
        self.locked_until = None
        self.failed_login_attempts = 0
    
    def increment_failed_login(self):
        """Increment failed login attempts and lock account if needed"""
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.lock_account()
    
    def is_account_locked(self):
        """Check if account is currently locked"""
        if self.locked_until and datetime.utcnow() < self.locked_until:
            return True
        elif self.locked_until and datetime.utcnow() >= self.locked_until:
            self.unlock_account()
        return False
    
    def record_login(self):
        """Record successful login"""
        self.last_login = datetime.utcnow()
        self.failed_login_attempts = 0
        self.unlock_account()
    
    def to_dict(self, include_sensitive=False):
        """Convert user object to dictionary"""
        data = {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'organization': self.organization,
            'is_verified': self.is_verified,
            'is_approved': self.is_approved,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_sensitive:
            data.update({
                'verification_token': self.verification_token,
                'password_reset_token': self.password_reset_token,
                'approval_token': self.approval_token,
                'approval_expires_at': self.approval_expires_at.isoformat() if self.approval_expires_at else None,
                'failed_login_attempts': self.failed_login_attempts,
                'locked_until': self.locked_until.isoformat() if self.locked_until else None
            })
        
        return data
    
    def __repr__(self):
        return f'<User {self.email} ({self.role})>'
    
    @staticmethod
    def get_pending_users():
        """Get all users pending approval"""
        return User.query.filter_by(is_approved=False).order_by(User.created_at.desc()).all()
    
    @staticmethod
    def get_unverified_users():
        """Get all users who haven't verified their email"""
        return User.query.filter_by(is_verified=False).order_by(User.created_at.desc()).all()
    
    @staticmethod
    def get_users_by_role(role):
        """Get all users with specified role"""
        return User.query.filter_by(role=role).order_by(User.created_at.desc()).all()
    
    @staticmethod
    def find_by_email(email):
        """Find user by email (case-insensitive)"""
        return User.query.filter(func.lower(User.email) == email.lower().strip()).first()
    
    @staticmethod
    def find_by_verification_token(token):
        """Find user by verification token"""
        return User.query.filter_by(verification_token=token).first()
    
    @staticmethod
    def find_by_password_reset_token(token):
        """Find user by password reset token"""
        return User.query.filter_by(password_reset_token=token).first()
    
    @staticmethod
    def find_by_approval_token(token):
        """Find user by approval token"""
        return User.query.filter_by(approval_token=token).first()
    
    def save(self):
        """Save user to database"""
        db.session.add(self)
        db.session.commit()
        return self
    
    def delete(self):
        """Delete user from database"""
        db.session.delete(self)
        db.session.commit()
