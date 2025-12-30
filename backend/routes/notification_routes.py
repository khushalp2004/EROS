from flask import Blueprint, request, jsonify
from flask_socketio import emit
from models import db, Notification, NotificationPreference
from events import socketio  # Import the shared socketio instance
from datetime import datetime, timedelta
import json

notification_bp = Blueprint('notifications', __name__)

def send_notification(notification_data, user_id=None, broadcast=False, target_user_ids=None):
    """Helper function to send notifications via WebSocket and save to database with role-based filtering"""
    try:
        # If target_user_ids is specified, only send to those users
        if target_user_ids is not None:
            notifications_created = []
            for target_user_id in target_user_ids:
                notification = Notification(**notification_data)
                notification.user_id = target_user_id
                db.session.add(notification)
                notifications_created.append(notification)
            
            db.session.commit()
            
            # Send via WebSocket to each target user
            for notification in notifications_created:
                socketio.emit('notification', notification.to_dict())
            
            return [n.to_dict() for n in notifications_created]
        
        # Original logic for broadcast or single user
        notification = Notification(**notification_data)
        if user_id:
            notification.user_id = user_id
        
        db.session.add(notification)
        db.session.commit()
        
        # Send via WebSocket
        socketio.emit('notification', notification.to_dict())
        
        return notification.to_dict()
    except Exception as e:
        print(f"Error sending notification: {str(e)}")
        return None

@notification_bp.route('/notifications', methods=['GET'])
def get_notifications():
    """Get notifications for current user"""
    try:
        user_id = request.args.get('user_id', type=int)
        status = request.args.get('status', 'all')  # 'all', 'unread', 'read'
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        query = Notification.query
        
        # Filter by user if specified
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        # Filter by status
        if status == 'unread':
            query = query.filter_by(is_read=False, is_archived=False)
        elif status == 'read':
            query = query.filter_by(is_read=True, is_archived=False)
        elif status == 'all':
            query = query.filter_by(is_archived=False)
        
        # Order by creation date (newest first)
        query = query.order_by(Notification.created_at.desc())
        
        # Apply pagination
        notifications = query.offset(offset).limit(limit).all()
        
        return jsonify({
            'success': True,
            'data': [n.to_dict() for n in notifications],
            'total': query.count()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@notification_bp.route('/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    try:
        notification = Notification.query.get_or_404(notification_id)
        notification.mark_as_read()
        db.session.commit()
        
        # Emit update via WebSocket
        socketio.emit('notification_updated', {
            'notification_id': notification_id,
            'is_read': True,
            'read_at': notification.read_at.isoformat()
        })
        
        return jsonify({'success': True, 'message': 'Notification marked as read'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@notification_bp.route('/notifications/<int:notification_id>/dismiss', methods=['POST'])
def dismiss_notification(notification_id):
    """Dismiss a notification"""
    try:
        notification = Notification.query.get_or_404(notification_id)
        notification.mark_as_dismissed()
        db.session.commit()
        
        # Emit update via WebSocket
        socketio.emit('notification_updated', {
            'notification_id': notification_id,
            'is_dismissed': True,
            'dismissed_at': notification.dismissed_at.isoformat()
        })
        
        return jsonify({'success': True, 'message': 'Notification dismissed'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@notification_bp.route('/notifications/mark-all-read', methods=['POST'])
def mark_all_read():
    """Mark all notifications as read for a user"""
    try:
        user_id = request.json.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        notifications = Notification.query.filter_by(
            user_id=user_id, 
            is_read=False, 
            is_archived=False
        ).all()
        
        for notification in notifications:
            notification.mark_as_read()
        
        db.session.commit()
        
        # Emit update via WebSocket
        socketio.emit('all_notifications_read', {'user_id': user_id})
        
        return jsonify({
            'success': True, 
            'message': f'Marked {len(notifications)} notifications as read'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@notification_bp.route('/notifications/count', methods=['GET'])
def get_unread_count():
    """Get unread notification count for a user"""
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        count = Notification.query.filter_by(
            user_id=user_id,
            is_read=False,
            is_archived=False
        ).count()
        
        return jsonify({
            'success': True,
            'unread_count': count
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@notification_bp.route('/notifications/preferences', methods=['GET'])
def get_notification_preferences():
    """Get notification preferences for a user"""
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        preferences = NotificationPreference.query.filter_by(user_id=user_id).first()
        
        if not preferences:
            # Create default preferences
            preferences = NotificationPreference(user_id=user_id)
            db.session.add(preferences)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'data': preferences.to_dict()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@notification_bp.route('/notifications/preferences', methods=['POST'])
def update_notification_preferences():
    """Update notification preferences for a user"""
    try:
        user_id = request.json.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        preferences = NotificationPreference.query.filter_by(user_id=user_id).first()
        
        if not preferences:
            preferences = NotificationPreference(user_id=user_id)
            db.session.add(preferences)
        
        # Update preferences
        fields_to_update = [
            'emergency_alerts', 'unit_updates', 'system_notifications', 'general_notifications',
            'in_app_notifications', 'email_notifications', 'sound_notifications',
            'show_urgent_only', 'show_high_priority_only', 'batch_notifications',
            'notification_frequency'
        ]
        
        for field in fields_to_update:
            if field in request.json:
                setattr(preferences, field, request.json[field])
        
        preferences.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Notification preferences updated',
            'data': preferences.to_dict()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Emergency-related notification helpers
def create_emergency_notification(emergency, action, user_id=None, target_roles=None):
    """Create notifications for emergency events with role-based filtering"""
    # Get target users based on roles if specified
    target_user_ids = None
    if target_roles:
        from models import User
        target_users = User.query.filter(User.role.in_(target_roles)).all()
        target_user_ids = [user.id for user in target_users]
    
    title_map = {
        'created': f'New {emergency.emergency_type} Emergency',
        'approved': f'{emergency.emergency_type} Emergency Approved',
        'assigned': f'Unit Assigned to {emergency.emergency_type} Emergency',
        'enroute': f'Unit Enroute to {emergency.emergency_type} Emergency',
        'arrived': f'Unit Arrived at {emergency.emergency_type} Emergency',
        'completed': f'{emergency.emergency_type} Emergency Completed'
    }
    
    message_map = {
        'created': f'A new {emergency.emergency_type} emergency has been reported and requires attention.',
        'approved': f'The {emergency.emergency_type} emergency has been approved for dispatch.',
        'assigned': f'Unit {emergency.assigned_unit} has been assigned to this emergency.',
        'enroute': f'Assigned unit is now enroute to the emergency location.',
        'arrived': f'Unit has arrived at the emergency location.',
        'completed': f'The {emergency.emergency_type} emergency has been successfully completed.'
    }
    
    title = title_map.get(action, f'Emergency Update')
    message = message_map.get(action, f'Emergency status updated: {action}')
    
    return send_notification({
        'type': 'emergency',
        'title': title,
        'message': message,
        'priority': 'high' if action in ['created', 'approved', 'assigned'] else 'normal',
        'category': f'status_update_{action}',
        'emergency_id': emergency.request_id,
        'action_url': f'/dashboard?emergency={emergency.request_id}'
    }, user_id=user_id, broadcast=True, target_user_ids=target_user_ids)

def create_unit_notification(unit, action, user_id=None, emergency=None, target_roles=None):
    """Create notifications for unit events with role-based filtering"""
    # Get target users based on roles if specified
    target_user_ids = None
    if target_roles:
        from models import User
        target_users = User.query.filter(User.role.in_(target_roles)).all()
        target_user_ids = [user.id for user in target_users]
    
    title_map = {
        'dispatched': f'Unit {unit.unit_id} Dispatched',
        'arrived': f'Unit {unit.unit_id} Arrived',
        'completed': f'Unit {unit.unit_id} Completed Assignment',
        'status_changed': f'Unit {unit.unit_id} Status Updated'
    }
    
    message_map = {
        'dispatched': f'Unit {unit.unit_id} has been dispatched to an emergency.',
        'arrived': f'Unit {unit.unit_id} has arrived at the emergency location.',
        'completed': f'Unit {unit.unit_id} has completed their assignment and is now available.',
        'status_changed': f'Unit {unit.unit_id} status changed to {unit.status}.'
    }
    
    title = title_map.get(action, f'Unit Update')
    message = message_map.get(action, f'Unit {unit.unit_id} status updated.')
    
    notification_data = {
        'type': 'unit',
        'title': title,
        'message': message,
        'priority': 'normal',
        'category': f'status_update_{action}',
        'unit_id': unit.unit_id
    }
    
    if emergency:
        notification_data['emergency_id'] = emergency.request_id
        notification_data['action_url'] = f'/dashboard?emergency={emergency.request_id}'
    else:
        notification_data['action_url'] = '/dashboard'
    
    return send_notification(notification_data, user_id=user_id, broadcast=True, target_user_ids=target_user_ids)

def create_system_notification(title, message, priority='normal', user_id=None, action_url=None, target_roles=None):
    """Create system-wide notifications with role-based filtering"""
    # Get target users based on roles if specified
    target_user_ids = None
    if target_roles:
        from models import User
        target_users = User.query.filter(User.role.in_(target_roles)).all()
        target_user_ids = [user.id for user in target_users]
    
    return send_notification({
        'type': 'system',
        'title': title,
        'message': message,
        'priority': priority,
        'category': 'system_alert',
        'action_url': action_url or '/dashboard'
    }, user_id=user_id, broadcast=True, target_user_ids=target_user_ids)
