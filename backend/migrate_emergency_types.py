# Emergency Type Migration Script
# Updates all existing emergency records to use uppercase service types

import sys
import os
sys.path.append('/Users/khushalpatil/Desktop/EROS/backend')

from app import app
from models import Emergency, db

def migrate_emergency_types():
    """Migrate emergency types to uppercase format"""
    
    with app.app_context():
        print("🔧 Starting emergency type migration...")
        
        # Define type mapping
        type_mapping = {
            'Ambulance': 'AMBULANCE',
            'Fire': 'FIRE_TRUCK', 
            'Police': 'POLICE',
            'ambulance': 'AMBULANCE',
            'fire': 'FIRE_TRUCK',
            'police': 'POLICE'
        }
        
        # Get all emergencies
        emergencies = Emergency.query.all()
        updated_count = 0
        
        print(f"📊 Found {len(emergencies)} emergency records")
        
        for emergency in emergencies:
            original_type = emergency.emergency_type
            normalized_type = type_mapping.get(original_type, original_type.upper())
            
            if original_type != normalized_type:
                emergency.emergency_type = normalized_type
                print(f"  🔄 Updated Emergency #{emergency.request_id}: '{original_type}' → '{normalized_type}'")
                updated_count += 1
        
        if updated_count > 0:
            db.session.commit()
            print(f"✅ Successfully updated {updated_count} emergency records")
        else:
            print("✅ No emergency records needed updating")
        
        # Show final statistics
        print("\n📈 Final emergency type distribution:")
        from sqlalchemy import func
        type_counts = db.session.query(
            Emergency.emergency_type, 
            func.count(Emergency.request_id)
        ).group_by(Emergency.emergency_type).all()
        
        for emergency_type, count in type_counts:
            print(f"  - {emergency_type}: {count} emergencies")

if __name__ == "__main__":
    migrate_emergency_types()
