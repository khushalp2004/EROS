#!/usr/bin/env python3
"""
Database migration script to add approval columns
"""

import os
import sys
from datetime import datetime
from sqlalchemy import text

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app import app
from models import db, User

def migrate_database():
    """Add approval_token and approval_expires_at columns to users table"""
    print("🔄 Starting Database Migration")
    print("=" * 50)
    
    try:
        with app.app_context():
            # Check if columns already exist
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('approval_token', 'approval_expires_at')
            """))
            
            existing_columns = [row[0] for row in result.fetchall()]
            print(f"📋 Existing approval columns: {existing_columns}")
            
            # Add approval_token column if it doesn't exist
            if 'approval_token' not in existing_columns:
                print("➕ Adding approval_token column...")
                db.session.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN approval_token VARCHAR(100) UNIQUE
                """))
                print("✅ approval_token column added")
            else:
                print("✅ approval_token column already exists")
            
            # Add approval_expires_at column if it doesn't exist
            if 'approval_expires_at' not in existing_columns:
                print("➕ Adding approval_expires_at column...")
                db.session.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN approval_expires_at TIMESTAMP
                """))
                print("✅ approval_expires_at column added")
            else:
                print("✅ approval_expires_at column already exists")
            
            # Commit the changes
            db.session.commit()
            print("\n💾 Migration completed successfully!")
            
            # Verify the columns exist
            result = db.session.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('approval_token', 'approval_expires_at')
            """))
            
            print("\n🔍 Verification - New columns:")
            for row in result.fetchall():
                print(f"   ✅ {row[0]}: {row[1]}")
            
            return True
            
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🗄️ Database Migration for Direct Admin Approval")
    print("Adding approval_token and approval_expires_at columns")
    
    success = migrate_database()
    
    if success:
        print("\n🎉 Migration successful!")
        print("The direct admin approval feature is now ready.")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)

