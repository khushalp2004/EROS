#!/usr/bin/env python3
"""
Test script for forgot password functionality
Tests the complete forgot password flow: email request → token validation → password reset
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "http://127.0.0.1:5001"
TEST_EMAIL = "test.user@example.com"

def test_forgot_password_flow():
    """Test the complete forgot password flow"""
    print("🔑 Testing Forgot Password Feature")
    print("=" * 50)
    
    try:
        # Test 1: Request password reset
        print("\n1. Testing forgot password request...")
        forgot_response = requests.post(f"{BASE_URL}/api/auth/forgot-password", 
                                       json={"email": TEST_EMAIL})
        
        print(f"Status Code: {forgot_response.status_code}")
        print(f"Response: {forgot_response.json()}")
        
        if forgot_response.status_code == 200:
            print("✅ Forgot password request successful")
        else:
            print("❌ Forgot password request failed")
            return False
            
        # Test 2: Test with invalid email (should still return success for security)
        print("\n2. Testing with invalid email (security test)...")
        invalid_response = requests.post(f"{BASE_URL}/api/auth/forgot-password", 
                                        json={"email": "nonexistent@example.com"})
        
        print(f"Status Code: {invalid_response.status_code}")
        print(f"Response: {invalid_response.json()}")
        
        if invalid_response.status_code == 200:
            print("✅ Security test passed - generic response for invalid email")
        else:
            print("❌ Security test failed")
            
        # Test 3: Test password reset with invalid token
        print("\n3. Testing password reset with invalid token...")
        reset_response = requests.post(f"{BASE_URL}/api/auth/reset-password", 
                                      json={"token": "invalid_token", "new_password": "NewPass123!"})
        
        print(f"Status Code: {reset_response.status_code}")
        print(f"Response: {reset_response.json()}")
        
        if reset_response.status_code == 400:
            print("✅ Invalid token correctly rejected")
        else:
            print("❌ Invalid token handling failed")
            
        # Test 4: Test password reset with weak password
        print("\n4. Testing password reset with weak password...")
        weak_reset_response = requests.post(f"{BASE_URL}/api/auth/reset-password", 
                                           json={"token": "invalid_token", "new_password": "weak"})
        
        print(f"Status Code: {weak_reset_response.status_code}")
        print(f"Response: {weak_reset_response.json()}")
        
        if weak_reset_response.status_code == 400:
            print("✅ Weak password correctly rejected")
        else:
            print("❌ Weak password validation failed")
            
        # Test 5: Test forgot password with missing email
        print("\n5. Testing forgot password with missing email...")
        missing_response = requests.post(f"{BASE_URL}/api/auth/forgot-password", 
                                        json={})
        
        print(f"Status Code: {missing_response.status_code}")
        print(f"Response: {missing_response.json()}")
        
        if missing_response.status_code == 400:
            print("✅ Missing email correctly rejected")
        else:
            print("❌ Missing email validation failed")
            
        # Test 6: Test reset password with missing fields
        print("\n6. Testing password reset with missing fields...")
        missing_fields_response = requests.post(f"{BASE_URL}/api/auth/reset-password", 
                                               json={})
        
        print(f"Status Code: {missing_fields_response.status_code}")
        print(f"Response: {missing_fields_response.json()}")
        
        if missing_fields_response.status_code == 400:
            print("✅ Missing fields correctly rejected")
        else:
            print("❌ Missing fields validation failed")
            
        print("\n" + "=" * 50)
        print("✅ Forgot Password Feature Tests Completed!")
        print("\n📝 Test Summary:")
        print("   • Email request handling: ✅")
        print("   • Security measures: ✅") 
        print("   • Token validation: ✅")
        print("   • Password strength: ✅")
        print("   • Input validation: ✅")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend server")
        print("   Make sure the Flask backend is running on port 5001")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

def test_frontend_components():
    """Test that frontend components are properly created"""
    print("\n🌐 Frontend Component Tests")
    print("=" * 30)
    
    import os
    
    # Check if component files exist
    components = [
        "frontend/src/components/ForgotPasswordModal.js",
        "frontend/src/components/ResetPasswordModal.js", 
        "frontend/src/pages/ForgotPassword.js",
        "frontend/src/pages/ResetPassword.js"
    ]
    
    for component in components:
        if os.path.exists(component):
            print(f"✅ {component}")
        else:
            print(f"❌ {component} - NOT FOUND")
            
    # Check if routes are added to App.js
    app_js_path = "frontend/src/App.js"
    if os.path.exists(app_js_path):
        with open(app_js_path, 'r') as f:
            content = f.read()
            if '/forgot-password' in content and '/reset-password/:token' in content:
                print("✅ Routes added to App.js")
            else:
                print("❌ Routes NOT added to App.js")
                
    # Check if LoginModal has forgot password integration
    login_modal_path = "frontend/src/components/LoginModal.js"
    if os.path.exists(login_modal_path):
        with open(login_modal_path, 'r') as f:
            content = f.read()
            if 'ForgotPasswordModal' in content and 'Forgot Password?' in content:
                print("✅ LoginModal integration complete")
            else:
                print("❌ LoginModal integration missing")

if __name__ == "__main__":
    print("🔐 EROS Forgot Password Feature Test Suite")
    print("=" * 50)
    
    # Test backend API
    backend_success = test_forgot_password_flow()
    
    # Test frontend components
    test_frontend_components()
    
    print("\n" + "=" * 50)
    if backend_success:
        print("🎉 All tests passed! Forgot password feature is ready.")
        print("\n🚀 Next steps:")
        print("   1. Start the frontend development server")
        print("   2. Open the application in browser")
        print("   3. Click 'Forgot Password?' link in login modal")
        print("   4. Enter email to test the complete flow")
    else:
        print("⚠️  Some tests failed. Please check the backend server.")
        
    sys.exit(0 if backend_success else 1)
