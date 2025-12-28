#!/usr/bin/env python3
"""
Database connection and table creation test script
"""

from flask import Flask
from config import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
from models import db, User

def test_database():
    """Test database connection and table creation"""
    print("🔍 Testing database connection and table creation...")

    try:
        # Create Flask app context
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

        # Initialize database
        db.init_app(app)

        with app.app_context():
            print("📡 Connecting to database...")
            print(f"Database URI: {SQLALCHEMY_DATABASE_URI}")

            # Test connection
            with db.engine.connect() as conn:
                conn.execute(db.text('SELECT 1'))
            print("✅ Database connection successful")

            # Create all tables
            print("🏗️  Creating tables...")
            db.create_all()
            print("✅ Tables created successfully")

            # Check if users table exists
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"📋 Available tables: {tables}")

            if 'users' in tables:
                print("✅ Users table exists")

                # Check table structure
                columns = inspector.get_columns('users')
                column_names = [col['name'] for col in columns]
                print(f"📊 Users table columns: {column_names}")

                # Test user creation
                print("👤 Testing user creation...")
                test_user = User(
                    email="test@example.com",
                    password="TestPass123!",
                    role="reporter",
                    first_name="Test",
                    last_name="User"
                )

                test_user.save()
                print("✅ Test user created successfully")

                # Check if user exists
                found_user = User.find_by_email("test@example.com")
                if found_user:
                    print(f"✅ User found in database: {found_user.email}")
                    # Clean up test user
                    found_user.delete()
                    print("🧹 Test user cleaned up")
                else:
                    print("❌ User not found after creation")

            else:
                print("❌ Users table does not exist")

    except Exception as e:
        print(f"❌ Database test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

    print("🎉 Database test completed successfully!")
    return True

if __name__ == "__main__":
    test_database()
