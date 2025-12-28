#!/usr/bin/env python3
"""
Test script for EROS Authentication System
Tests all authentication endpoints and functionality
"""

import requests
import json
import time
import sys
import os
from datetime import datetime

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Configuration
BASE_URL = "http://localhost:5000/api"
TEST_USER_EMAIL = "testuser@eros-system.com"
TEST_USER_PASSWORD = "TestPass123!"
ADMIN_EMAIL = "admin@eros-system.com"
ADMIN_PASSWORD = "AdminPass123!"

class AuthenticationTester:
    def __init__(self):
        self.access_token = None
        self.refresh_token = None
        self.user_id = None
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{status}] {message}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request and return response"""
        url = f"{BASE_URL}{endpoint}"
        
        if headers is None:
            headers = {"Content-Type": "application/json"}
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
            
        except requests.exceptions.ConnectionError:
            self.log("Cannot connect to backend server. Make sure it's running on port 5001", "ERROR")
            sys.exit(1)
        except Exception as e:
            self.log(f"Request failed: {str(e)}", "ERROR")
            return None
    
    def test_health_check(self):
        """Test basic health check endpoint"""
        self.log("Testing health check...")
        
        response = self.make_request("GET", "/auth/status")
        if response and response.status_code == 200:
            self.log("✅ Health check passed")
            return True
        else:
            self.log("❌ Health check failed", "ERROR")
            return False
    
    def test_user_signup(self):
        """Test user registration"""
        self.log("Testing user registration...")
        
        signup_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": "Test",
            "last_name": "User",
            "phone": "+1234567890",
            "organization": "Test Organization",
            "role": "reporter"
        }
        
        response = self.make_request("POST", "/auth/signup", signup_data)
        
        if response and response.status_code == 201:
            data = response.json()
            self.log(f"✅ User registration successful: {data.get('message')}")
            self.user_id = data.get('user_id')
            return True
        else:
            self.log(f"❌ User registration failed: {response.text if response else 'No response'}", "ERROR")
            return False
    
    def test_duplicate_email(self):
        """Test duplicate email registration"""
        self.log("Testing duplicate email registration...")
        
        signup_data = {
            "email": TEST_USER_EMAIL,
            "password": "DifferentPass123!",
            "first_name": "Duplicate",
            "last_name": "User"
        }
        
        response = self.make_request("POST", "/auth/signup", signup_data)
        
        if response and response.status_code == 400:
            data = response.json()
            self.log(f"✅ Duplicate email properly rejected: {data.get('message')}")
            return True
        else:
            self.log("❌ Duplicate email was not rejected", "ERROR")
            return False
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        self.log("Testing invalid login...")
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": "WrongPassword123!"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 401:
            self.log("✅ Invalid login properly rejected")
            return True
        else:
            self.log("❌ Invalid login was not rejected", "ERROR")
            return False
    
    def test_valid_login(self):
        """Test valid user login"""
        self.log("Testing valid user login...")
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 401:  # Should fail because user is not verified/approved
            data = response.json()
            self.log(f"✅ Login correctly rejected for unverified user: {data.get('message')}")
            return True
        else:
            self.log(f"❌ Expected login rejection but got: {response.status_code if response else 'No response'}", "ERROR")
            return False
    
    def test_profile_access_without_auth(self):
        """Test accessing profile without authentication"""
        self.log("Testing profile access without authentication...")
        
        response = self.make_request("GET", "/auth/profile")
        
        if response and response.status_code == 401:
            self.log("✅ Profile access properly rejected without auth")
            return True
        else:
            self.log("❌ Profile access was not rejected", "ERROR")
            return False
    
    def test_forgot_password(self):
        """Test forgot password functionality"""
        self.log("Testing forgot password...")
        
        forgot_data = {
            "email": TEST_USER_EMAIL
        }
        
        response = self.make_request("POST", "/auth/forgot-password", forgot_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.log(f"✅ Forgot password request processed: {data.get('message')}")
            return True
        else:
            self.log("❌ Forgot password request failed", "ERROR")
            return False
    
    def test_admin_endpoints(self):
        """Test admin endpoints (should fail without admin auth)"""
        self.log("Testing admin endpoints without authentication...")
        
        # Test pending users
        response = self.make_request("GET", "/admin/pending-users")
        
        if response and response.status_code == 401:
            self.log("✅ Admin endpoints properly protected")
            return True
        else:
            self.log("❌ Admin endpoints not properly protected", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all authentication tests"""
        self.log("🚀 Starting EROS Authentication System Tests", "INFO")
        self.log("=" * 50)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("User Registration", self.test_user_signup),
            ("Duplicate Email", self.test_duplicate_email),
            ("Invalid Login", self.test_invalid_login),
            ("Valid Login", self.test_valid_login),
            ("Profile Access", self.test_profile_access_without_auth),
            ("Forgot Password", self.test_forgot_password),
            ("Admin Protection", self.test_admin_endpoints)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"❌ {test_name} failed with exception: {str(e)}", "ERROR")
                failed += 1
            
            time.sleep(0.5)  # Small delay between tests
        
        self.log("=" * 50)
        self.log(f"📊 Test Results: {passed} passed, {failed} failed", "INFO")
        
        if failed == 0:
            self.log("🎉 All tests passed! Authentication system is working correctly.", "SUCCESS")
        else:
            self.log("⚠️  Some tests failed. Please check the backend configuration.", "WARNING")
        
        return failed == 0

def create_admin_user():
    """Create an admin user for testing"""
    from backend.models import db, User
    
    try:
        # Check if admin user already exists
        admin = User.find_by_email(ADMIN_EMAIL)
        if admin:
            print(f"Admin user {ADMIN_EMAIL} already exists")
            return True
        
        # Create admin user
        admin = User(
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            role="admin",
            first_name="System",
            last_name="Administrator"
        )
        
        # Mark as verified and approved for testing
        admin.is_verified = True
        admin.is_approved = True
        admin.is_active = True
        
        admin.save()
        print(f"✅ Admin user created: {ADMIN_EMAIL}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create admin user: {str(e)}")
        return False

if __name__ == "__main__":
    # First, try to create an admin user
    print("Setting up admin user...")
    create_admin_user()
    
    # Run authentication tests
    tester = AuthenticationTester()
    tester.run_all_tests()

