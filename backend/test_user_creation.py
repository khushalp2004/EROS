#!/usr/bin/env python3
"""
Test user creation to isolate recursion issue
"""

from flask import Flask
from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
from models import db, User

def test_user_creation():
    """Test user creation in isolation"""
    print("🔍 Testing user creation...")

    try:
        # Create Flask app context
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

        # Initialize database
        db.init_app(app)

        with app.app_context():
            print("📡 Creating user...")

            # Try to create user
            user = User(
                email="testuser@example.com",
                password="TestPass123!",
                role="reporter",
                first_name="Test",
                last_name="User"
            )

            print("✅ User object created")

            # Try to save
            print("💾 Saving user...")
            user.save()
            print("✅ User saved successfully")

            # Clean up
            user.delete()
            print("🧹 Test user cleaned up")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_user_creation()
