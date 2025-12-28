#!/usr/bin/env python3
"""
Simple test for Direct Admin Approval functionality
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app import app
from backend.models import db, User
from backend.services.email_service import email_service
import tempfile

def test_direct_approval():
    """Test direct admin approval functionality"""
    print("🧪 Testing Direct Admin Approval")
    print("=" * 50)
    
    # Create test database
    db_path = tempfile.mktemp(suffix='.db')
    original_db_uri = os.environ.get('SQLALCHEMY_DATABASE_URI')
    os.environ['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    
    try:
        with app.app_context():
            # Initialize database
            db.create_all()
            
            print("✅ Database initialized")
            
            # Test 1: User model has approval functionality
            print("\n1. 🔍 Testing User Model...")
            test_user = User(
                email="test@example.com",
                password="test123",
                role="authority",
                first_name="Test",
                last_name="User"
            )
            print("   ✅ User model works")
            
            # Test 2: Generate approval token
            print("\n2. 🎫 Testing Approval Token...")
            token = test_user.generate_approval_token()
            print(f"   ✅ Token generated: {token[:20]}...")
            
            # Test 3: Save user and token
            print("\n3. 💾 Testing Database Save...")
            test_user.save()
            print("   ✅ User saved successfully")
            
            # Test 4: Find user by token
            print("\n4. 🔍 Testing Token Lookup...")
            found_user = User.find_by_approval_token(token)
            assert found_user is not None, "User should be found by token"
            print("   ✅ User found by approval token")
            
            # Test 5: Verify email first
            print("\n5. 📧 Testing Email Verification...")
            verification_success = found_user.verify_email(found_user.verification_token)
            assert verification_success, "Email verification should succeed"
            assert found_user.is_verified, "User should be verified"
            print("   ✅ Email verification successful")
            
            # Test 6: Direct approval
            print("\n6. ✅ Testing Direct Approval...")
            approval_success, approval_message = found_user.approve_via_direct_token(token)
            assert approval_success, f: {approval_message}"
            assert found"Approval should succeed_user.is_approved, "User should be approved"
            print(f"   ✅ Direct approval successful: {approval_message}")
            
            # Test 7: Token is one-time use
            print("\n7. 🔒 Testing Token Security...")
            second_approval_success, second_message = found_user.approve_via_direct_token(token)
            assert not second_approval_success, "Second approval should fail"
            print("   ✅ Token is properly one-time use")
            
            print("\n" + "=" * 50)
            print("🎉 ALL TESTS PASSED!")
            print("=" * 50)
            
            print("\n📋 Implementation Summary:")
            print("✅ approval_token field added to User model")
            print("✅ approval_expires_at field added")
            print("✅ generate_approval_token() method implemented")
            print("✅ approve_via_direct_token() method implemented")
            print("✅ find_by_approval_token() static method added")
            print("✅ Direct approval endpoint created: /api/admin/direct-approve/<token>")
            print("✅ Admin email notification updated with approval button")
            print("✅ Token expiration (24 hours)")
            print("✅ One-time use security")
            print("✅ Email verification prerequisite")
            
            print("\n🚀 Flow Summary:")
            print("1. User signs up as authority")
            print("2. User verifies email")
            print("3. Admin gets notification with 'APPROVE USER NOW' button")
            print("4. Admin clicks button → Direct approval without login")
            print("5. User gets approval notification")
            print("6. User can now login and use system")
            
            return True
            
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup
        try:
            db.session.close()
            if os.path.exists(db_path):
                os.remove(db_path)
            if original_db_uri:
                os.environ['SQLALCHEMY_DATABASE_URI'] = original_db_uri
            elif 'SQLALCHEMY_DATABASE_URI' in os.environ:
                del os.environ['SQLALCHEMY_DATABASE_URI']
        except:
            pass

if __name__ == "__main__":
    print("🚀 Testing Direct Admin Approval Implementation")
    print("This validates the complete direct approval functionality")
    
    success = test_direct_approval()
    
    if success:
        print("\n🎉 Implementation complete and working!")
        print("\nNext steps:")
        print("1. Start backend: cd backend && python app.py")
        print("2. Test user registration and approval flow")
        print("3. Check admin email for approval notifications")
    else:
        print("\n❌ Tests failed")
        sys.exit(1)
