import os
import json
from flask import Blueprint, request, jsonify, render_template_string
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models import db, User, TrafficSegment
from services.email_service import email_service
from utils.validators import validate_required_fields, validate_role
from routes.notification_routes import create_system_notification
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

def is_protected_account(user):
    """Check if the user is configured as a protected/non-mutable account."""
    protected_user_id = (os.getenv('NON_DELETABLE_USER_ID') or '').strip()
    protected_user_email = (os.getenv('NON_DELETABLE_USER_EMAIL') or '').strip().lower()
    return (
        (protected_user_id and str(user.id) == protected_user_id) or
        (protected_user_email and (user.email or '').strip().lower() == protected_user_email)
    )


def _validate_traffic_geometry(geometry):
    if not isinstance(geometry, dict):
        return False, "Geometry must be a GeoJSON object"

    if geometry.get("type") != "LineString":
        return False, "Geometry type must be LineString"

    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return False, "LineString must contain at least 2 coordinates"

    for coord in coordinates:
        if (
            not isinstance(coord, list) or
            len(coord) != 2 or
            not isinstance(coord[0], (int, float)) or
            not isinstance(coord[1], (int, float))
        ):
            return False, "Each coordinate must be [lng, lat]"

    return True, None


def _extract_segment_meta(raw_notes):
    if not raw_notes:
        return {"city": None, "zone": None, "note": None}
    if isinstance(raw_notes, str) and raw_notes.startswith("__meta__:"):
        try:
            payload = json.loads(raw_notes.split("__meta__:", 1)[1])
            return {
                "city": (payload.get("city") or "").strip() or None,
                "zone": (payload.get("zone") or "").strip() or None,
                "note": (payload.get("note") or "").strip() or None
            }
        except Exception:
            return {"city": None, "zone": None, "note": raw_notes}
    return {"city": None, "zone": None, "note": raw_notes}


def _build_segment_meta_notes(city=None, zone=None, note=None):
    payload = {
        "city": (city or "").strip() or None,
        "zone": (zone or "").strip() or None,
        "note": (note or "").strip() or None
    }
    return f"__meta__:{json.dumps(payload)}"


def _segment_to_payload(row):
    item = row.to_dict()
    try:
        item["geometry"] = json.loads(item["geometry"])
    except Exception:
        item["geometry"] = None
    meta = _extract_segment_meta(item.get("notes"))
    item["notes"] = meta["note"]
    item["city"] = meta["city"]
    item["zone"] = meta["zone"]
    return item

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
            if role not in ['admin', 'authority', 'reporter', 'unit']:
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
        
        # Send in-app notification to admin users about the approval
        try:
            admin_notification_message = f"User {user.first_name} {user.last_name} ({user.email}) has been approved and activated."
            if custom_message:
                admin_notification_message += f" Custom message: {custom_message}"
            
            create_system_notification(
                title="User Approved",
                message=admin_notification_message,
                priority='normal',
                target_roles=['admin']  # Only notify other admin users
            )
        except Exception as e:
            # Log error but don't fail the approval
            print(f"Failed to send admin notification: {str(e)}")
        
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

        if is_protected_account(user):
            return jsonify({
                'success': False,
                'message': 'This account is protected and cannot be deactivated/rejected'
            }), 403
        
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
                'message': 'Invalid role. Must be admin, authority, reporter, or unit'
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

        if not is_active and is_protected_account(user):
            return jsonify({
                'success': False,
                'message': 'This account is protected and cannot be deactivated'
            }), 403
        
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

@admin_bp.route('/users/<int:user_id>/lock', methods=['POST'])
@admin_required()
def lock_user(user_id):
    """
    Lock a user account
    POST /api/admin/users/<user_id>/lock

    Headers:
    Authorization: Bearer <admin_access_token>

    Request Body (optional):
    {
        "duration_hours": 24
    }

    Response:
    {
        "success": true,
        "message": "User account locked successfully",
        "user_id": 1,
        "locked_until": "2024-01-02T12:00:00"
    }
    """
    try:
        current_user_id = get_jwt_identity()
        if user_id == current_user_id:
            return jsonify({
                'success': False,
                'message': 'Cannot lock your own account'
            }), 400

        user = User.query.get(user_id)

        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        if is_protected_account(user):
            return jsonify({
                'success': False,
                'message': 'This account is protected and cannot be locked'
            }), 403

        data = request.get_json() or {}
        duration_hours = int(data.get('duration_hours', 24))
        duration_hours = max(1, min(duration_hours, 720))

        user.lock_account(duration_hours=duration_hours)
        user.save()

        return jsonify({
            'success': True,
            'message': 'User account locked successfully',
            'user_id': user.id,
            'locked_until': user.locked_until.isoformat() if user.locked_until else None
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Failed to lock user account: {str(e)}'
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

        if is_protected_account(user):
            return jsonify({
                'success': False,
                'message': 'This account is protected and cannot be deleted'
            }), 403
        
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
        for role in ['admin', 'authority', 'reporter', 'unit']:
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


@admin_bp.route('/traffic-segments', methods=['GET'])
@admin_required()
def get_traffic_segments():
    """Get all manual traffic simulation segments (admin only)."""
    try:
        active_only = request.args.get('active') == 'true'
        city_filter = (request.args.get('city') or '').strip().lower()
        zone_filter = (request.args.get('zone') or '').strip().lower()

        query = TrafficSegment.query
        if active_only:
            query = query.filter_by(is_active=True)

        rows = query.order_by(TrafficSegment.updated_at.desc()).all()
        payload = []
        for row in rows:
            item = _segment_to_payload(row)
            item_city = (item.get("city") or "").strip().lower()
            item_zone = (item.get("zone") or "").strip().lower()
            if city_filter and item_city != city_filter:
                continue
            if zone_filter and item_zone != zone_filter:
                continue
            payload.append(item)

        return jsonify({
            "success": True,
            "segments": payload,
            "total": len(payload)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to load traffic segments: {str(e)}"
        }), 500


@admin_bp.route('/traffic-segments', methods=['POST'])
@admin_required()
def create_traffic_segment():
    """Create a traffic segment (admin only)."""
    try:
        data = request.get_json() or {}
        geometry = data.get("geometry")
        jam_level = (data.get("jam_level") or "MEDIUM").strip().upper()
        if jam_level == "BLOCKED":
            jam_level = "HIGH"
        name = (data.get("name") or "").strip() or None
        notes = (data.get("notes") or "").strip() or None
        city = (data.get("city") or "").strip() or None
        zone = (data.get("zone") or "").strip() or None
        is_active = bool(data.get("is_active", True))

        valid_levels = {"LOW", "MEDIUM", "HIGH"}
        if jam_level not in valid_levels:
            return jsonify({
                "success": False,
                "message": "jam_level must be LOW, MEDIUM, or HIGH"
            }), 400

        is_valid, error = _validate_traffic_geometry(geometry)
        if not is_valid:
            return jsonify({"success": False, "message": error}), 400

        row = TrafficSegment(
            name=name,
            jam_level=jam_level,
            geometry=json.dumps(geometry),
            notes=_build_segment_meta_notes(city=city, zone=zone, note=notes),
            is_active=is_active
        )

        db.session.add(row)
        db.session.commit()

        item = _segment_to_payload(row)
        return jsonify({
            "success": True,
            "message": "Traffic segment created",
            "segment": item
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Failed to create traffic segment: {str(e)}"
        }), 500


@admin_bp.route('/traffic-segments/<int:segment_id>', methods=['PUT'])
@admin_required()
def update_traffic_segment(segment_id):
    """Update traffic segment details (admin only)."""
    try:
        row = TrafficSegment.query.get(segment_id)
        if not row:
            return jsonify({"success": False, "message": "Traffic segment not found"}), 404

        data = request.get_json() or {}
        current_meta = _extract_segment_meta(row.notes)

        if "name" in data:
            row.name = (data.get("name") or "").strip() or None
        if "is_active" in data:
            row.is_active = bool(data.get("is_active"))
        if "jam_level" in data:
            jam_level = (data.get("jam_level") or "").strip().upper()
            if jam_level == "BLOCKED":
                jam_level = "HIGH"
            if jam_level not in {"LOW", "MEDIUM", "HIGH"}:
                return jsonify({
                    "success": False,
                    "message": "jam_level must be LOW, MEDIUM, or HIGH"
                }), 400
            row.jam_level = jam_level
        if "geometry" in data:
            geometry = data.get("geometry")
            is_valid, error = _validate_traffic_geometry(geometry)
            if not is_valid:
                return jsonify({"success": False, "message": error}), 400
            row.geometry = json.dumps(geometry)

        if "notes" in data or "city" in data or "zone" in data:
            next_note = current_meta["note"] if "notes" not in data else (data.get("notes") or "").strip() or None
            next_city = current_meta["city"] if "city" not in data else (data.get("city") or "").strip() or None
            next_zone = current_meta["zone"] if "zone" not in data else (data.get("zone") or "").strip() or None
            row.notes = _build_segment_meta_notes(city=next_city, zone=next_zone, note=next_note)

        db.session.commit()

        item = _segment_to_payload(row)
        return jsonify({
            "success": True,
            "message": "Traffic segment updated",
            "segment": item
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Failed to update traffic segment: {str(e)}"
        }), 500


@admin_bp.route('/traffic-segments/<int:segment_id>', methods=['DELETE'])
@admin_required()
def delete_traffic_segment(segment_id):
    """Delete a traffic segment (admin only)."""
    try:
        row = TrafficSegment.query.get(segment_id)
        if not row:
            return jsonify({"success": False, "message": "Traffic segment not found"}), 404

        db.session.delete(row)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Traffic segment deleted",
            "segment_id": segment_id
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Failed to delete traffic segment: {str(e)}"
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

def _render_direct_approval_page(success, title, message, user=None, login_url=None, status_code=200):
    """Render a browser-friendly direct approval result page."""
    page_template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{{ title }}</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f7fb; margin: 0; padding: 24px; color: #1f2937; }
        .card { max-width: 680px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
        .badge { display: inline-block; padding: 8px 12px; border-radius: 999px; font-weight: 700; font-size: 13px; }
        .ok { background: #e8f7ee; color: #166534; }
        .err { background: #feecec; color: #991b1b; }
        h1 { margin-top: 14px; margin-bottom: 10px; font-size: 28px; }
        p { line-height: 1.5; }
        .details { margin-top: 14px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .btn { display: inline-block; margin-top: 18px; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge {{ 'ok' if success else 'err' }}">
          {{ 'APPROVED' if success else 'ACTION FAILED' }}
        </span>
        <h1>{{ title }}</h1>
        <p>{{ message }}</p>
        {% if user %}
        <div class="details">
          <p><strong>User:</strong> {{ user.get('name', '-') }}</p>
          <p><strong>Email:</strong> {{ user.get('email', '-') }}</p>
          <p><strong>Role:</strong> {{ user.get('role', '-') }}</p>
          <p><strong>Organization:</strong> {{ user.get('organization', '-') }}</p>
        </div>
        {% endif %}
        {% if login_url %}
        <a class="btn" href="{{ login_url }}">Open Admin/Login Page</a>
        {% endif %}
      </div>
    </body>
    </html>
    """
    return render_template_string(
        page_template,
        success=success,
        title=title,
        message=message,
        user=user,
        login_url=login_url,
    ), status_code

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
        login_url = f"{os.getenv('FRONTEND_BASE_URL', 'http://localhost:3000').rstrip('/')}/login"

        # Find user by approval token
        user = User.find_by_approval_token(token)
        
        if not user:
            return _render_direct_approval_page(
                False,
                "Invalid Approval Link",
                "This approval link is invalid or expired.",
                login_url=login_url,
                status_code=400
            )
        
        # Check if token is expired
        from datetime import datetime
        if user.approval_expires_at and datetime.utcnow() > user.approval_expires_at:
            return _render_direct_approval_page(
                False,
                "Approval Link Expired",
                "This approval link has expired. Ask the user to request verification again.",
                user={
                    'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
                    'email': user.email,
                    'role': user.role,
                    'organization': user.organization or 'N/A',
                },
                login_url=login_url,
                status_code=400
            )
        
        # Check if user is already approved
        if user.is_approved:
            return _render_direct_approval_page(
                True,
                "User Already Approved",
                "This user was already approved earlier. No further action is needed.",
                user={
                    'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
                    'email': user.email,
                    'role': user.role,
                    'organization': user.organization or 'N/A',
                },
                login_url=login_url,
                status_code=200
            )
        
        # Check if user is verified (must verify email first)
        if not user.is_verified:
            return _render_direct_approval_page(
                False,
                "User Not Verified Yet",
                "Cannot approve this account because the user has not verified their email yet.",
                user={
                    'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
                    'email': user.email,
                    'role': user.role,
                    'organization': user.organization or 'N/A',
                },
                login_url=login_url,
                status_code=400
            )
        
        # Approve user using direct token
        success, message = user.approve_via_direct_token(token)
        
        if not success:
            return _render_direct_approval_page(
                False,
                "Approval Failed",
                message,
                user={
                    'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
                    'email': user.email,
                    'role': user.role,
                    'organization': user.organization or 'N/A',
                },
                login_url=login_url,
                status_code=400
            )
        
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
        
        return _render_direct_approval_page(
            True,
            "User Approved Successfully",
            "The account has been approved. The user can now log in to EROS.",
            user={
                'name': user_data['user_name'],
                'email': user_data['user_email'],
                'role': user_data['user_role'],
                'organization': user_data['organization'] or 'N/A',
            },
            login_url=login_url,
            status_code=200
        )
        
    except Exception as e:
        return _render_direct_approval_page(
            False,
            "Server Error",
            f"Failed to approve user: {str(e)}",
            login_url=f"{os.getenv('FRONTEND_BASE_URL', 'http://localhost:3000').rstrip('/')}/login",
            status_code=500
        )

# Error handlers
@admin_bp.errorhandler(403)
def handle_forbidden(error):
    """Handle forbidden access"""
    return jsonify({
        'success': False,
        'message': 'Admin access required',
        'error': 'ADMIN_REQUIRED'
    }), 403
