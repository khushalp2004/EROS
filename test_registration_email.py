#!/usr/bin/env python3
"""
Test script to verify email sending during user registration
"""
import sys
import os
import json
import requests

# Test the actual API endpoint
def test_email_registration():
    """Test registration with email sending enabled"""
    print("=== Testing Registration with Email Sending ===")
    
    # API endpoint
    url = "http://localhost:5000/api/auth/signup"
    
    # Test user data
    test_data = {
        "email": "testuser@example.com",
        "password": "TestPass123!",
        "first_name": "Test",
        "last_name": "User",
        "phone": "+1234567890",
        "organization": "Test Organization",
        "role": "reporter"
    }
    
    try:
        print(f"Sending POST request to: {url}")
        print(f"Data: {json.dumps(test_data, indent=2)}")
        
        response = requests.post(url, json=test_data, headers={
            'Content-Type': 'application/json'
        })
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 201:
            print("✅ Registration successful!")
            data = response.json()
            print(f"Email sent: {data.get('email_sent', 'Unknown')}")
            print(f"Admin notified: {data.get('admin_notified', 'Unknown')}")
        else:
            print("❌ Registration failed!")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Make sure Flask app is running on port 5000")
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")

if __name__ == "__main__":
    test_email_registration()
