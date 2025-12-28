#!/usr/bin/env python3
"""
Test script for pending approval authentication system
Tests the new authentication flow for verified but unapproved users
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
API_BASE = f"{BASE_URL}/api/auth"

class PendingApprovalAuthTest:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
    def log_test(self, test_name, status, message=""):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        status_symbol = "✅" if status == "PASS" else "❌"
        print(f"[{timestamp}] {status_symbol} {test_name}: {status}")
        if message:
            print(f"    Message: {message}")
        print()

    def test_approved_user_login(self):
        """Test that approved users can still login normally"""
        print("=" * 60)
        print("TESTING APPROVED USER LOGIN")
        print("=" * 60)
        
        # Test with demo user (should be approved)
        login_data = {
            "email": "demo@eros.com",
            "password": "DemoPass123!"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('status') == 'success':
                    self.log_test("Approved User Login", "PASS", "Successfully logged in with tokens")
                    return True
                else:
                    self.log_test("Approved User Login", "FAIL", f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Approved User Login", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Approved User Login", "FAIL", f"Exception: {str(e)}")
            return False

    def test_pending_approval_user_login(self):
        """Test login with verified but unapproved user"""
        print("=" * 60)
        print("TESTING PENDING APPROVAL USER LOGIN")
        print("=" * 60)
        
        # First, create a test user that's verified but not approved
        test_email = f"test_pending_{int(time.time())}@example.com"
        test_password = "TestPass123!"
        
        # Register user
        register_data = {
            "email": test_email,
            "password": test_password,
            "first_name": "Test",
            "last_name": "User",
            "phone": "+1234567890",
            "organization": "Test Organization",
            "role": "reporter"
        }
        
        try:
            # Register the user
            register_response = self.session.post(f"{API_BASE}/signup", json=register_data)
            
            if register_response.status_code == 201:
                print(f"✅ User registered: {test_email}")
                
                # Manually verify and mark as not approved (simulating the pending state)
                # In a real test, you'd need to modify the database or use admin endpoints
                # For now, we'll test the authentication service directly
                
                # Test login - should return pending_approval status
                login_data = {
                    "email": test_email,
                    "password": test_password
                }
                
                login_response = self.session.post(f"{API_BASE}/login", json=login_data)
                
                if login_response.status_code == 200:
                    data = login_response.json()
                    if data.get('success') and data.get('status') == 'pending_approval':
                        self.log_test("Pending Approval User Login", "PASS", "Correctly returned pending_approval status")
                        return True
                    else:
                        self.log_test("Pending Approval User Login", "FAIL", f"Expected pending_approval, got: {data}")
                        return False
                else:
                    self.log_test("Pending Approval User Login", "FAIL", f"HTTP {login_response.status_code}: {login_response.text}")
                    return False
            else:
                self.log_test("User Registration", "FAIL", f"Failed to register test user: {register_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Pending Approval User Login", "FAIL", f"Exception: {str(e)}")
            return False

    def test_invalid_credentials_silent_handling(self):
        """Test that invalid credentials are handled silently (no error popup)"""
        print("=" * 60)
        print("TESTING INVALID CREDENTIALS SILENT HANDLING")
        print("=" * 60)
        
        # Test with non-existent email
        login_data = {
            "email": "nonexistent@example.com",
            "password": "WrongPassword123!"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                if data.get('success') == False and data.get('status') == 'invalid_credentials':
                    self.log_test("Invalid Credentials Handling", "PASS", "Correctly returned generic invalid_credentials status")
                    return True
                else:
                    self.log_test("Invalid Credentials Handling", "FAIL", f"Unexpected response structure: {data}")
                    return False
            else:
                self.log_test("Invalid Credentials Handling", "FAIL", f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Invalid Credentials Handling", "FAIL", f"Exception: {str(e)}")
            return False

    def test_wrong_password_silent_handling(self):
        """Test that wrong password for existing user is handled silently"""
        print("=" * 60)
        print("TESTING WRONG PASSWORD SILENT HANDLING")
        print("=" * 60)
        
        # Test with correct email but wrong password
        login_data = {
            "email": "demo@eros.com",
            "password": "WrongPassword123!"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                if data.get('success') == False and data.get('status') == 'invalid_credentials':
                    self.log_test("Wrong Password Handling", "PASS", "Correctly returned generic invalid_credentials status")
                    return True
                else:
                    self.log_test("Wrong Password Handling", "FAIL", f"Unexpected response structure: {data}")
                    return False
            else:
                self.log_test("Wrong Password Handling", "FAIL", f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Wrong Password Handling", "FAIL", f"Exception: {str(e)}")
            return False

    def test_service_status(self):
        """Test that the authentication service is running"""
        print("=" * 60)
        print("TESTING AUTHENTICATION SERVICE STATUS")
        print("=" * 60)
        
        try:
            response = self.session.get(f"{API_BASE}/status")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('authenticated') == False:
                    self.log_test("Service Status", "PASS", "Authentication service is running")
                    return True
                else:
                    self.log_test("Service Status", "FAIL", f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Service Status", "FAIL", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Service Status", "FAIL", f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests and report results"""
        print("\n" + "="*80)
        print("PENDING APPROVAL AUTHENTICATION SYSTEM TESTS")
        print("="*80)
        print(f"Testing against: {BASE_URL}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        tests = [
            ("Service Status", self.test_service_status),
            ("Approved User Login", self.test_approved_user_login),
            ("Pending Approval User Login", self.test_pending_approval_user_login),
            ("Invalid Credentials Silent Handling", self.test_invalid_credentials_silent_handling),
            ("Wrong Password Silent Handling", self.test_wrong_password_silent_handling),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name}: FAIL - Exception during test execution")
                results.append((test_name, False))
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        print()
        print(f"Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Pending approval authentication is working correctly.")
        else:
            print("⚠️  Some tests failed. Please check the implementation.")
            
        return passed == total

def main():
    """Main test execution"""
    print("Starting Pending Approval Authentication Tests...")
    print("Make sure the backend server is running on http://localhost:5000")
    print()
    
    # Wait a moment for user to read the message
    time.sleep(2)
    
    tester = PendingApprovalAuthTest()
    success = tester.run_all_tests()
    
    print("\nTest execution completed.")
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())

