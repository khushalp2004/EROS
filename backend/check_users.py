#!/usr/bin/env python3
"""
Check existing users in the database
"""

from flask import Flask
from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
from models import db, User

def check_users():
    """Check existing users in the database"""
    print("🔍 Checking existing users in database...")

    try:
        # Create Flask app context
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

        # Initialize database
        db.init_app(app)

        with app.app_context():
            users = User.query.all()
            print(f"📊 Total users: {len(users)}")

            if users:
                print("\n👥 Existing users:")
                for user in users:
                    print(f"  ID: {user.id}")
                    print(f"  Email: {user.email}")
                    print(f"  Role: {user.role}")
                    print(f"  Verified: {user.is_verified}")
                    print(f"  Approved: {user.is_approved}")
                    print(f"  Active: {user.is_active}")
                    print(f"  Created: {user.created_at}")
                    print("  ---")
            else:
                print("📭 No users found in database")

    except Exception as e:
        print(f"❌ Error checking users: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_users()
