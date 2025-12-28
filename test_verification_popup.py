#!/usr/bin/env python3
"""
Test script for the enhanced email verification popup functionality
"""

import requests
import json
import time

# Backend configuration
BASE_URL = "http://127.0.0.1:5001"
API_URL = f"{BASE_URL}/api"

def test_resend_verification_unauth():
    """Test the new unauthenticated resend verification endpoint"""
    print("🔄 Testing unauthenticated resend verification endpoint...")
    
    # Test with valid email
    test_email = "test.user@example.com"
    
    response = requests.post(
        f"{API_URL}/auth/resend-verification-unauth",
        json={"email": test_email},
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        print("✅ Resend verification endpoint working correctly")
        return True
    else:
        print("❌ Resend verification endpoint failed")
        return False

def test_backend_health():
    """Test if backend is running"""
    print("🏥 Testing backend health...")
    
    try:
        response = requests.get(f"{API_URL}/auth/health")
        if response.status_code == 200:
            print("✅ Backend is running")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure it's running on port 5001")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Email Verification Popup Tests")
    print("=" * 50)
    
    # Test backend health
    if not test_backend_health():
        print("\n❌ Backend is not accessible. Please start the backend first.")
        print("Run: cd backend && python app.py")
        return
    
    print("\n" + "=" * 50)
    
    # Test resend verification endpoint
    test_resend_verification_unauth()
    
    print("\n" + "=" * 50)
    print("✅ All tests completed!")
    print("\nNext steps:")
    print("1. Start the frontend: cd frontend && npm start")
    print("2. Open browser to http://localhost:3000")
    print("3. Click 'Sign Up' to test the new verification popup")
    print("4. The popup should stay open with resend option")

if __name__ == "__main__":
    main()
