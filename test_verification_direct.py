#!/usr/bin/env python3
"""
Direct test of email verification process using database queries
"""
import sys
import os

# Add backend to Python path
sys.path.append('/Users/khushalpatil/Desktop/EROS/backend')

from app import app
from models import db, User
from services.email_service import email_service

def test_verification_directly():
    """Test verification process directly"""
    print("=== Testing Email Verification Directly ===")
    
    # Create Flask app and set up context
    with app.app_context():
        # Email service is already initialized globally
        # No need to initialize email_service locally
        
        try:
            # Create database tables if they don't exist
            db.create_all()
            print("✅ Database tables ready")
            
            # Create a test user in database
            print("\n1. Creating test user...")
            test_email = "direct.test@example.com"
            
            # Check if user already exists and delete
            existing_user = User.find_by_email(test_email)
            if existing_user:
                print("Deleting existing test user...")
                existing_user.delete()
            
            # Create new user
            user = User(
                email=test_email,
                password="TestPass123!",
                first_name="Direct",
                last_name="Test",
                role="reporter"
            )
            
            user.save()
            print(f"✅ User created with ID: {user.id}")
            print(f"   Email: {user.email}")
            print(f"   Verification token: {user.verification_token[:20]}...")
            print(f"   Verification expires: {user.verification_expires_at}")
            print(f"   Is verified (before): {user.is_verified}")
            
            # Test verification with the token
            print("\n2. Testing email verification...")
            verification_success = user.verify_email(user.verification_token)
            print(f"   Verification result: {verification_success}")
            print(f"   Is verified (after verify_email): {user.is_verified}")
            
            # Save to database
            user.save()
            print(f"   Saved to database")
            
            # Reload from database to check
            print("\n3. Reloading user from database...")
            reloaded_user = User.find_by_email(test_email)
            print(f"   User reloaded from DB")
            print(f"   Is verified (after reload): {reloaded_user.is_verified}")
            
            if reloaded_user.is_verified:
                print("✅ Email verification is working correctly!")
            else:
                print("❌ Email verification failed - is_verified is still False")
                
            # Test email sending
            print("\n4. Testing email sending...")
            test_user = User(
                email="email.test@example.com",
                password="TestPass123!",
                first_name="Email",
                last_name="Test"
            )
            test_user.save()
            
            email_success, email_message = email_service.send_verification_email(
                test_user, test_user.verification_token
            )
            
            if email_success:
                print("✅ Email sending works!")
            else:
                print(f"❌ Email sending failed: {email_message}")
                
            # Cleanup
            print("\n5. Cleaning up test users...")
            reloaded_user.delete()
            test_user.delete()
            print("✅ Test users deleted")
            
        except Exception as e:
            print(f"❌ Exception occurred: {str(e)}")
            import traceback
            traceback.print_exc()

def main():
    """Main test function"""
    print("EROS Email Verification Direct Test")
    print("=" * 50)
    
    test_verification_directly()
    
    print("\n" + "=" * 50)
    print("Direct test completed!")

if __name__ == "__main__":
    main()
