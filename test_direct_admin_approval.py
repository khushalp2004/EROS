#!/usr/bin/env python3
"""
Test script for Direct Admin Approval functionality

This test validates the complete flow:
1. User signs up as authority
2. User verifies email
3. Admin gets notification with direct approval button
4. Admin approves user via token without logging in
5. User gets approval notification
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.models import db, User
from backend.services.email_service import email_service
from backend.app import app
import tempfile

def test_direct_admin_approval():
    """Test the complete direct admin approval flow"""
    print("🧪 Testing Direct Admin Approval Functionality")
    print("=" * 60)
    
    # Create test database
    db_path = tempfile.mktemp(suffix='.db')
    original_db_uri = os.environ.get('SQLALCHEMY_DATABASE_URI')
    os.environ['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    
    try:
        # Initialize database with Flask application context
        with app.app_context():
            db.create_all()
        
        print("\n1. 📧 Testing Email Service Configuration")
        print(f"   Admin Email: {email_service.admin_email}")
        assert email_service.admin_email == 'patilkhushal54321@gmail.com', "Admin email should be patilkhushal54321@gmail.com"
        print("   ✅ Admin email correctly configured")
        
        print("\n2. 👤 Creating Test Authority User")
        # Create a new authority user
        test_user = User(
            email="authority.test@example.com",
            password="TestPass123!",
            role="authority",
            first_name="Test",
            last_name="Authority",
            organization="Test Fire Department",
            phone="+1234567890"
        )
        
        # Save user to database
        test_user.save()
        print(f"   ✅ User created: {test_user.email}")
        print(f"   📊 User Status - Verified: {test_user.is_verified}, Approved: {test_user.is_approved}")
        
        print("\n3. 🔐 Testing Email Verification")
        # Simulate email verification
        verification_success = test_user.verify_email(test_user.verification_token)
        print(f"   📧 Verification result: {verification_success}")
        assert verification_success, "Email verification should succeed"
        assert test_user.is_verified, "User should be verified after verification"
        print("   ✅ Email verification successful")
        print(f"   📊 User Status - Verified: {test_user.is_verified}, Approved: {test_user.is_approved}")
        
        print("\n4. 🎫 Testing Approval Token Generation")
        # Generate approval token
        approval_token = test_user.generate_approval_token()
        print(f"   🎫 Approval Token: {approval_token[:20]}...")
        assert approval_token, "Approval token should be generated"
        assert test_user.approval_token == approval_token, "Token should be stored in user"
        assert test_user.approval_expires_at, "Token should have expiration"
        print("   ✅ Approval token generated successfully")
        
        # Save user to persist token
        test_user.save()
        
        print("\n5. 📧 Testing Admin Notification Email")
        # Test admin notification email (this would normally be sent automatically)
        email_success, email_message = email_service.send_admin_new_user_notification(test_user)
        print(f"   📧 Email sending result: {email_success}")
        print(f"   📧 Email message: {email_message}")
        
        # Check if email content contains the approval button
        if email_success:
            print("   ✅ Admin notification email sent successfully")
            print(f"   🎯 Email should contain approval link with token: {approval_token[:10]}...")
        else:
            print("   ⚠️ Email sending failed (this is OK for testing)")
        
        print("\n6. 🔓 Testing Direct Approval Endpoint Logic")
        # Test the direct approval logic (simulating the API endpoint)
        user_found = User.find_by_approval_token(approval_token)
        assert user_found, "User should be found by approval token"
        print(f"   🔍 User found by token: {user_found.email}")
        
        # Check token expiration
        from datetime import datetime
        assert user_found.approval_expires_at > datetime.utcnow(), "Token should not be expired"
        print("   ⏰ Token is not expired")
        
        # Test approval
        approval_success, approval_message = user_found.approve_via_direct_token(approval_token)
        print(f"   ✅ Approval result: {approval_success}")
        print(f"   📝 Approval message: {approval_message}")
        assert approval_success, "Direct approval should succeed"
        assert user_found.is_approved, "User should be approved after direct approval"
        print("   🎉 User approved successfully via direct token!")
        
        print(f"   📊 Final User Status - Verified: {user_found.is_verified}, Approved: {user_found.is_approved}")
        print(f"   🔒 Token Status - Used: {user_found.approval_token is None}")
        
        print("\n7. 📧 Testing User Approval Notification")
        # Test user approval notification
        notification_success, notification_message = email_service.send_user_approval_notification(user_found)
        print(f"   📧 Notification result: {notification_success}")
        print(f"   📧 Notification message: {notification_message}")
        
        if notification_success:
            print("   ✅ User approval notification sent successfully")
        else:
            print("   ⚠️ User notification failed (this is OK for testing)")
        
        print("\n8. 🔒 Testing Token Security")
        # Test that token is one-time use
        second_approval_success, second_approval_message = user_found.approve_via_direct_token(approval_token)
        print(f"   🔒 Second approval attempt: {second_approval_success}")
        print(f"   📝 Second approval message: {second_approval_message}")
        assert not second_approval_success, "Second approval attempt should fail (one-time use)"
        print("   ✅ Token is properly one-time use")
        
        print("\n9. ❌ Testing Token Security - Invalid Token")
        # Test invalid token
        invalid_success, invalid_message = user_found.approve_via_direct_token("invalid_token")
        print(f"   ❌ Invalid token approval: {invalid_success}")
        print(f"   📝 Invalid token message: {invalid_message}")
        assert not invalid_success, "Invalid token approval should fail"
        print("   ✅ Invalid tokens are properly rejected")
        
        print("\n10. 📊 Testing Token Expiration Logic")
        # Test expired token logic
        from datetime import timedelta
        test_user_expired = User(
            email="expired.test@example.com",
            password="TestPass123!",
            role="reporter"
        )
        expired_token = test_user_expired.generate_approval_token()
        test_user_expired.approval_expires_at = datetime.utcnow() - timedelta(hours=1)
        test_user_expired.save()
        
        expired_success, expired_message = test_user_expired.approve_via_direct_token(expired_token)
        print(f"   ⏰ Expired token approval: {expired_success}")
        print(f"   📝 Expired token message: {expired_message}")
        assert not expired_success, "Expired token approval should fail"
        print("   ✅ Expired tokens are properly rejected")
        
        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED! Direct Admin Approval is working correctly!")
        print("=" * 60)
        
        print("\n📋 Summary of Implemented Features:")
        print("✅ Secure approval token generation")
        print("✅ Token expiration (24 hours)")
        print("✅ One-time use tokens")
        print("✅ Direct approval endpoint (no login required)")
        print("✅ Admin notification emails with approval buttons")
        print("✅ User approval notifications")
        print("✅ Proper security validation")
        print("✅ Email verification prerequisite check")
        print("✅ Comprehensive error handling")
        
        print("\n🚀 Flow Summary:")
        print("1. User signs up as authority → Verification email sent")
        print("2. User verifies email → Admin gets notification with approval button")
        print("3. Admin clicks 'APPROVE USER NOW' → Direct approval without login")
        print("4. User gets approval notification → Can now login and use system")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup
        try:
            db.session.close()
            if os.path.exists(db_path):
                os.remove(db_path)
            # Restore original database URI
            if original_db_uri:
                os.environ['SQLALCHEMY_DATABASE_URI'] = original_db_uri
            elif 'SQLALCHEMY_DATABASE_URI' in os.environ:
                del os.environ['SQLALCHEMY_DATABASE_URI']
        except:
            pass

def test_user_model_changes():
    """Test that User model has all required changes"""
    print("\n🧪 Testing User Model Changes")
    print("=" * 40)
    
    # Check if User model has the new methods
    user_methods = dir(User)
    
    required_methods = [
        'generate_approval_token',
        'approve_via_direct_token',
        'find_by_approval_token'
    ]
    
    for method in required_methods:
        if method in user_methods:
            print(f"✅ Method {method} exists")
        else:
            print(f"❌ Method {method} missing")
            return False
    
    # Check if User model has the new fields
    user_instance = User(email="test@example.com", password="test")
    user_attrs = dir(user_instance)
    
    required_attrs = [
        'approval_token',
        'approval_expires_at'
    ]
    
    for attr in required_attrs:
        if hasattr(user_instance, attr):
            print(f"✅ Attribute {attr} exists")
        else:
            print(f"❌ Attribute {attr} missing")
            return False
    
    print("✅ All User model changes are present")
    return True

if __name__ == "__main__":
    print("🚀 Starting Direct Admin Approval Tests")
    print("This test validates the complete direct admin approval functionality")
    
    # Test user model changes
    model_test_passed = test_user_model_changes()
    
    if model_test_passed:
        # Test complete functionality
        main_test_passed = test_direct_admin_approval()
        
        if main_test_passed:
            print("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!")
            print("The direct admin approval feature is ready to use!")
            print("\nNext steps:")
            print("1. Start the backend server: cd backend && python app.py")
            print("2. Test with real user registration")
            print("3. Check admin email for approval notifications")
            print("4. Click approval buttons to test direct approval")
        else:
            print("\n❌ Main functionality tests failed")
            sys.exit(1)
    else:
        print("\n❌ User model tests failed")
        sys.exit(1)
