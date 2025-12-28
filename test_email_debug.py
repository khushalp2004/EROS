#!/usr/bin/env python3
"""
Test script to debug email sending issues
"""
import sys
import os

# Add backend to Python path
sys.path.append('/Users/khushalpatil/Desktop/EROS/backend')

from services.email_service import EmailService
from models import db, User

def test_email_service():
    """Test email service functionality"""
    print("=== Testing Email Service ===")
    
    # Initialize email service
    email_service = EmailService()
    
    print(f"SMTP Server: {email_service.smtp_server}")
    print(f"SMTP Port: {email_service.smtp_port}")
    print(f"SMTP Username: {email_service.smtp_username}")
    print(f"From Email: {email_service.from_email}")
    print(f"From Name: {email_service.from_name}")
    print()
    
    # Test with a simple email
    test_email = "test@example.com"
    subject = "Test Email from EROS"
    html_content = "<h1>Test Email</h1><p>This is a test email from EROS system.</p>"
    text_content = "Test Email - This is a test email from EROS system."
    
    try:
        print(f"Sending test email to: {test_email}")
        success, message = email_service.send_email(test_email, subject, html_content, text_content)
        
        if success:
            print("✅ Email sent successfully!")
            print(f"Message: {message}")
        else:
            print("❌ Email sending failed!")
            print(f"Error: {message}")
            
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        
    print()

def test_email_verification():
    """Test email verification functionality"""
    print("=== Testing Email Verification ===")
    
    # Initialize email service
    email_service = EmailService()
    
    # Create a mock user object
    class MockUser:
        def __init__(self):
            self.email = "test@example.com"
            self.first_name = "Test"
            self.verification_token = "mock_token_12345"
    
    user = MockUser()
    
    try:
        print(f"Sending verification email to: {user.email}")
        success, message = email_service.send_verification_email(user, user.verification_token)
        
        if success:
            print("✅ Verification email sent successfully!")
            print(f"Message: {message}")
        else:
            print("❌ Verification email sending failed!")
            print(f"Error: {message}")
            
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")

if __name__ == "__main__":
    test_email_service()
    test_email_verification()
