from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models import db, User
from services.email_service import email_service
from utils.validators import validate_required_fields, validate_role
import traceback
import functools

# Create blueprint
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def admin_required():
    """
    Decorator to check if current user has admin role
    """
    def decorator(f):
        @jwt_required()
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            current_user = User.query.get(current_user_id)
            
            if not current_user or current_user.role != 'admin':
                return jsonify({
                    'success': False,
                    'message': 'Admin access required',
                    'error': 'ADMIN_REQUIRED'
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@admin_bp.route('/pending-users', methods=['GET'])
@admin_required()
def get_pending_users():
    """
    Get all users pending approval
    GET /api/admin/pending-users
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Response:
    {
        "success": true,
        "users": [
            {
                "id": 1,
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "role": "reporter",
                "organization": "City Fire Dept",
                "phone": "+1234567890",
                "is_verified": true,
                "is_approved": false,
                "created_at": "2024-01-01T09:00:00"
            }
        ],
        "total": 1
    }
    """
    try:
        # Get pending users
        pending_users = User.get_pending_users()
        
        users_data = []
        for user in pending_users:
            users_data.append({
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'organization': user.organization,
                'phone': user.phone,
                'is_verified': user.is_verified,
                'is_approved': user.is_approved,
                'is_active': user.is_active,
                'created_at': user.created_at.isoformat(),
                'updated_at': user.updated_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'users': users_data,
            'total': len(users_data)
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to retrieve pending users: {str(e)}'
        }), 500

@admin_bp.route('/users', methods=['GET'])
@admin_required()
def get_all_users():
    """
    Get all users with optional filtering
    GET /api/admin/users
    
    Query Parameters:
    - role (str): Filter by role (admin, authority, reporter)
    - status (str): Filter by status (active, inactive, pending, locked)
    - page (int): Page number (default: 1)
    - per_page (int): Items per page (default: 20, max: 100)
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Response:
    {
        "success": true,
        "users": [...],
        "total": 50,
        "page": 1,
        "per_page": 20,
        "total_pages": 3
    }
    """
    try:
        # Get query parameters
        role = request.args.get('role')
        status = request.args.get('status')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)  # Max 100 per page
        
        # Build query
        query = User.query
        
        # Apply filters
        if role:
            if role not in ['admin', 'authority', 'reporter']:
                return jsonify({
                    'success': False,
                    'message': 'Invalid role filter'
                }), 400
            query = query.filter_by(role=role)
        
        if status:
            if status == 'active':
                query = query.filter_by(is_active=True)
            elif status == 'inactive':
                query = query.filter_by(is_active=False)
            elif status == 'pending':
                query = query.filter_by(is_approved=False)
            elif status == 'locked':
                from datetime import datetime
                query = query.filter(User.locked_until > datetime.utcnow())
            else:
                return jsonify({
                    'success': False,
                    'message': 'Invalid status filter'
                }), 400
        
        # Order by creation date (newest first)
        query = query.order_by(User.created_at.desc())
        
        # Paginate
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        users_data = []
        for user in pagination.items:
            users_data.append({
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'organization': user.organization,
                'phone': user.phone,
                'is_verified': user.is_verified,
                'is_approved': user.is_approved,
                'is_active': user.is_active,
                'failed_login_attempts': user.failed_login_attempts,
                'locked_until': user.locked_until.isoformat() if user.locked_until else None,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat(),
                'updated_at': user.updated_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'users': users_data,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'total_pages': pagination.pages
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to retrieve users: {str(e)}'
        }), 500

@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@admin_required()
def get_user_details(user_id):
    """
    Get detailed information about a specific user
    GET /api/admin/users/<user_id>
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Response:
    {
        "success": true,
        "user": {
            "id": 1,
            "email": "user@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "role": "reporter",
            "organization": "City Fire Dept",
            "phone": "+1234567890",
            "is_verified": true,
            "is_approved": true,
            "is_active": true,
            "failed_login_attempts": 0,
            "locked_until": null,
            "last_login": "2024-01-01T10:00:00",
            "created_at": "2024-01-01T09:00:00",
            "updated_at": "2024-01-01T09:00:00"
        }
    }
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'organization': user.organization,
                'phone': user.phone,
                'is_verified': user.is_verified,
                'is_approved': user.is_approved,
                'is_active': user.is_active,
                'failed_login_attempts': user.failed_login_attempts,
                'locked_until': user.locked_until.isoformat() if user.locked_until else None,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat(),
                'updated_at': user.updated_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to retrieve user details: {str(e)}'
        }), 500

@admin_bp.route('/approve-user/<int:user_id>', methods=['POST'])
@admin_required()
def approve_user(user_id):
    """
    Approve a user (enable their account)
    POST /api/admin/approve-user/<user_id>
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Request Body (optional):
    {
        "send_notification": true,
        "message": "Welcome to EROS!"  // Optional custom message
    }
    
    Response:
    {
        "success": true,
        "message": "User approved successfully",
        "user_id": 1,
        "notification_sent": true
    }
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        if user.is_approved:
            return jsonify({
                'success': False,
                'message': 'User is already approved'
            }), 400
        
        # Check if user is verified
        if not user.is_verified:
            return jsonify({
                'success': False,
                'message': 'Cannot approve user - email not verified'
            }), 400
        
        # Approve user
        user.approve_user()
        
        # Activate user if verified
        if user.is_verified:
            user.activate_user()
        
        user.save()
        
        # Send notification email if requested
        data = request.get_json() or {}
        send_notification = data.get('send_notification', True)
        custom_message = data.get('message')
        
        notification_sent = False
        if send_notification:
            try:
                success, message = email_service.send_user_approval_notification(user)
                notification_sent = success
            except Exception as e:
                # Log error but don't fail the approval
                print(f"Failed to send approval notification: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': 'User approved successfully',
            'user_id': user.id,
            'notification_sent': notification_sent,
            'custom_message': custom_message
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to approve user: {str(e)}'
        }), 500

@admin_bp.route('/reject-user/<int:user_id>', methods=['POST'])
@admin_required()
def reject_user(user_id):
    """
    Reject a user (optional - can be used to explicitly reject instead of just not approving)
    POST /api/admin/reject-user/<user_id>
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Request Body:
    {
        "reason": "User information could not be verified",
        "send_notification": true
    }
    
    Response:
    {
        "success": true,
        "message": "User rejected",
        "user_id": 1,
        "reason": "User information could not be verified"
    }
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        data = request.get_json() or {}
        reason = data.get('reason', 'Registration rejected by administrator')
        
        # Deactivate user
        user.deactivate_user()
        user.save()
        
        # TODO: Send rejection notification email (optional)
        # This could be implemented if needed
        
        return jsonify({
            'success': True,
            'message': 'User rejected',
            'user_id': user.id,
            'reason': reason
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to reject user: {str(e)}'
        }), 500

@admin_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@admin_required()
def update_user_role(user_id):
    """
    Update user role
    PUT /api/admin/users/<user_id>/role
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Request Body:
    {
        "role": "authority"
    }
    
    Response:
    {
        "success": true,
        "message": "User role updated successfully",
        "user_id": 1,
        "old_role": "reporter",
        "new_role": "authority"
    }
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        data = request.get_json()
        
        if not data or 'role' not in data:
            return jsonify({
                'success': False,
                'message': 'Role is required'
            }), 400
        
        new_role = data['role']
        
        if not validate_role(new_role):
            return jsonify({
                'success': False,
                'message': 'Invalid role. Must be admin, authority, or reporter'
            }), 400
        
        old_role = user.role
        user.role = new_role
        user.save()
        
        return jsonify({
            'success': True,
            'message': 'User role updated successfully',
            'user_id': user.id,
            'old_role': old_role,
            'new_role': new_role
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to update user role: {str(e)}'
        }), 500

@admin_bp.route('/users/<int:user_id>/status', methods=['PUT'])
@admin_required()
def update_user_status(user_id):
    """
    Update user account status (activate/deactivate)
    PUT /api/admin/users/<user_id>/status
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Request Body:
    {
        "is_active": true
    }
    
    Response:
    {
        "success": true,
        "message": "User status updated successfully",
        "user_id": 1,
        "is_active": true
    }
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        data = request.get_json()
        
        if not data or 'is_active' not in data:
            return jsonify({
                'success': False,
                'message': 'is_active field is required'
            }), 400
        
        is_active = data['is_active']
        
        if is_active:
            # Check if user can be activated
            if not user.is_verified or not user.is_approved:
                return jsonify({
                    'success': False,
                    'message': 'Cannot activate user - user must be verified and approved first'
                }), 400
            user.activate_user()
        else:
            user.deactivate_user()
        
        user.save()
        
        return jsonify({
            'success': True,
            'message': 'User status updated successfully',
            'user_id': user.id,
            'is_active': user.is_active
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to update user status: {str(e)}'
        }), 500

@admin_bp.route('/users/<int:user_id>/unlock', methods=['POST'])
@admin_required()
def unlock_user(user_id):
    """
    Unlock a locked user account
    POST /api/admin/users/<user_id>/unlock
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Response:
    {
        "success": true,
        "message": "User account unlocked successfully",
        "user_id": 1
    }
    """
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        if not user.is_account_locked():
            return jsonify({
                'success': False,
                'message': 'User account is not locked'
            }), 400
        
        user.unlock_account()
        user.save()
        
        return jsonify({
            'success': True,
            'message': 'User account unlocked successfully',
            'user_id': user.id
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to unlock user account: {str(e)}'
        }), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required()
def delete_user(user_id):
    """
    Delete a user (admin only)
    DELETE /api/admin/users/<user_id>
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Request Body:
    {
        "reason": "User violated terms of service"
    }
    
    Response:
    {
        "success": true,
        "message": "User deleted successfully",
        "user_id": 1,
        "reason": "User violated terms of service"
    }
    """
    try:
        # Prevent admin from deleting themselves
        current_user_id = get_jwt_identity()
        if user_id == current_user_id:
            return jsonify({
                'success': False,
                'message': 'Cannot delete your own account'
            }), 400
        
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        data = request.get_json() or {}
        reason = data.get('reason', 'Deleted by administrator')
        
        # Delete user
        user.delete()
        
        return jsonify({
            'success': True,
            'message': 'User deleted successfully',
            'user_id': user_id,
            'reason': reason
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to delete user: {str(e)}'
        }), 500

@admin_bp.route('/stats', methods=['GET'])
@admin_required()
def get_admin_stats():
    """
    Get system statistics for admin dashboard
    GET /api/admin/stats
    
    Headers:
    Authorization: Bearer <admin_access_token>
    
    Response:
    {
        "success": true,
        "stats": {
            "total_users": 150,
            "active_users": 120,
            "pending_users": 5,
            "locked_users": 2,
            "users_by_role": {
                "admin": 3,
                "authority": 25,
                "reporter": 122
            },
            "recent_registrations": 10,
            "verification_rate": 95.5
        }
    }
    """
    try:
        from datetime import datetime, timedelta
        
        # Total users
        total_users = User.query.count()
        
        # Active users
        active_users = User.query.filter_by(is_active=True).count()
        
        # Pending users
        pending_users = User.query.filter_by(is_approved=False).count()
        
        # Locked users
        locked_users = User.query.filter(User.locked_until > datetime.utcnow()).count()
        
        # Users by role
        users_by_role = {}
        for role in ['admin', 'authority', 'reporter']:
            users_by_role[role] = User.query.filter_by(role=role).count()
        
        # Recent registrations (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_registrations = User.query.filter(User.created_at >= thirty_days_ago).count()
        
        # Verification rate
        verified_users = User.query.filter_by(is_verified=True).count()
        verification_rate = (verified_users / total_users * 100) if total_users > 0 else 0
        
        return jsonify({
            'success': True,
            'stats': {
                'total_users': total_users,
                'active_users': active_users,
                'pending_users': pending_users,
                'locked_users': locked_users,
                'users_by_role': users_by_role,
                'recent_registrations': recent_registrations,
                'verification_rate': round(verification_rate, 1)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to retrieve admin stats: {str(e)}'
        }), 500

@admin_bp.route('/health', methods=['GET'])
def admin_health():
    """
    Health check endpoint for admin routes (no auth required)
    GET /api/admin/health
    """
    return jsonify({
        'success': True,
        'message': 'Admin routes are healthy',
        'service': 'EROS Admin API'
    }), 200

@admin_bp.route('/direct-approve/<token>', methods=['GET'])
def direct_approve_user(token):
    """
    Direct user approval using approval token (no authentication required)
    POST /api/admin/direct-approve/<token>
    
    This endpoint allows admin to approve users directly from email notifications
    without needing to log in to the system.
    
    Args:
        token (str): The approval token from admin email
        
    Response:
    {
        "success": true,
        "message": "User approved successfully",
        "user_id": 1,
        "user_email": "user@example.com",
        "user_name": "John Doe",
        "approval_method": "direct_email_token"
    }
    
    Error responses:
    - 400: Invalid token, expired token, user not found, or user not verified
    - 500: Server error
    """
    try:
        # Find user by approval token
        user = User.find_by_approval_token(token)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'Invalid or expired approval token',
                'error': 'INVALID_TOKEN'
            }), 400
        
        # Check if token is expired
        from datetime import datetime
        if user.approval_expires_at and datetime.utcnow() > user.approval_expires_at:
            return jsonify({
                'success': False,
                'message': 'Approval token has expired',
                'error': 'TOKEN_EXPIRED',
                'expired_at': user.approval_expires_at.isoformat()
            }), 400
        
        # Check if user is already approved
        if user.is_approved:
            return jsonify({
                'success': False,
                'message': 'User is already approved',
                'error': 'ALREADY_APPROVED',
                'user_id': user.id,
                'approved_at': user.updated_at.isoformat()
            }), 400
        
        # Check if user is verified (must verify email first)
        if not user.is_verified:
            return jsonify({
                'success': False,
                'message': 'Cannot approve user - email not verified',
                'error': 'EMAIL_NOT_VERIFIED',
                'user_id': user.id
            }), 400
        
        # Approve user using direct token
        success, message = user.approve_via_direct_token(token)
        
        if not success:
            return jsonify({
                'success': False,
                'message': message,
                'error': 'APPROVAL_FAILED'
            }), 400
        
        # Prepare response data
        user_data = {
            'user_id': user.id,
            'user_email': user.email,
            'user_name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
            'user_role': user.role,
            'organization': user.organization,
            'approval_method': 'direct_email_token'
        }
        
        # Send user approval notification
        try:
            notification_success, notification_message = email_service.send_user_approval_notification(user)
            user_data['notification_sent'] = notification_success
            user_data['notification_message'] = notification_message
        except Exception as e:
            # Log error but don't fail the approval
            print(f"Failed to send approval notification: {str(e)}")
            user_data['notification_sent'] = False
            user_data['notification_error'] = str(e)
        
        return jsonify({
            'success': True,
            'message': 'User approved successfully via direct email token',
            'data': user_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to approve user: {str(e)}',
            'error': 'SERVER_ERROR'
        }), 500

# Error handlers
@admin_bp.errorhandler(403)
def handle_forbidden(error):
    """Handle forbidden access"""
    return jsonify({
        'success': False,
        'message': 'Admin access required',
        'error': 'ADMIN_REQUIRED'
    }), 403

