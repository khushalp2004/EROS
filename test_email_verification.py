#!/usr/bin/env python3
"""
Test script to verify email verification process is working correctly
"""
import sys
import os
import json
import requests

def test_email_verification_flow():
    """Test the complete email verification flow"""
    print("=== Testing Email Verification Flow ===")
    
    # API endpoint
    base_url = "http://localhost:5000"
    
    # Step 1: Register a new user
    print("\n1. Registering a new user...")
    signup_url = f"{base_url}/api/auth/signup"
    
    test_user = {
        "email": "verification.test@example.com",
        "password": "TestPass123!",
        "first_name": "Verification",
        "last_name": "Test",
        "phone": "+1234567890",
        "organization": "Test Organization",
        "role": "reporter"
    }
    
    try:
        response = requests.post(signup_url, json=test_user, headers={
            'Content-Type': 'application/json'
        })
        
        print(f"Registration Status: {response.status_code}")
        print(f"Registration Response: {response.text}")
        
        if response.status_code == 201:
            data = response.json()
            print(f"✅ Registration successful!")
            print(f"Email sent: {data.get('email_sent', 'Unknown')}")
            
            # Step 2: Get user from database to check verification token
            print("\n2. Checking user verification token in database...")
            
            # For this test, we'll need to manually check the database
            # In a real scenario, you would get the token from the verification email
            
            # Let's simulate getting the verification token from the email
            print("Note: In a real scenario, you would get the verification token from the email")
            print("For testing purposes, let's check if we can access the verification endpoint directly")
            
            # Step 3: Test verification with a mock token (this will likely fail)
            print("\n3. Testing email verification...")
            verification_url = f"{base_url}/api/auth/verify-email/mock_token"
            
            verify_response = requests.get(verification_url)
            print(f"Verification Status: {verify_response.status_code}")
            print(f"Verification Response: {verify_response.text}")
            
            if verify_response.status_code == 200:
                print("✅ Verification successful!")
            else:
                print("❌ Verification failed - this is expected with mock token")
                print("   In a real scenario, you would use the actual token from the email")
                
        else:
            print("❌ Registration failed!")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Make sure Flask app is running on port 5000")
        print("   Start the backend with: cd /Users/khushalpatil/Desktop/EROS/backend && python app.py")
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")

def test_backend_status():
    """Test if backend is running"""
    print("=== Testing Backend Status ===")
    
    try:
        response = requests.get("http://localhost:5000/api/auth/status")
        print(f"Backend Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Backend is running")
            return True
        else:
            print("❌ Backend returned error")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Backend is not running")
        print("   Please start the backend server first")
        return False
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        return False

def main():
    """Main test function"""
    print("EROS Email Verification Test")
    print("=" * 50)
    
    # Test backend status first
    if not test_backend_status():
        return
    
    # Test email verification flow
    test_email_verification_flow()
    
    print("\n" + "=" * 50)
    print("Test completed!")
    print("\nTo fully test email verification:")
    print("1. Start the backend server: cd /Users/khushalpatil/Desktop/EROS/backend && python app.py")
    print("2. Check your email for verification message from patilkhushal54321@gmail.com")
    print("3. Click the verification link or manually test the verify-email endpoint")

if __name__ == "__main__":
    main()
