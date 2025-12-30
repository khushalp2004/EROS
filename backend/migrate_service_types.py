#!/usr/bin/env python3
"""
Service Type Migration Script

This script migrates existing units and emergencies from the old service type format
to the new uppercase format for consistency:

- 'Ambulance' → 'AMBULANCE'
- 'Fire' → 'FIRE_TRUCK'
- 'Police' → 'POLICE'

Usage:
    python migrate_service_types.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models.unit import Unit
from models.emergency import Emergency

def migrate_service_types():
    """Migrate service types from old format to new uppercase format"""
    
    # Service type mapping
    service_type_mapping = {
        'Ambulance': 'AMBULANCE',
        'Fire': 'FIRE_TRUCK', 
        'Police': 'POLICE'
    }
    
    print("🔄 Starting service type migration...")
    
    # Track migration stats
    units_updated = 0
    emergencies_updated = 0
    
    with app.app_context():
        # Migrate Units
        print("\n📦 Migrating Units...")
        for old_type, new_type in service_type_mapping.items():
            units_to_update = Unit.query.filter_by(service_type=old_type).all()
            if units_to_update:
                print(f"  - Converting {len(units_to_update)} units from '{old_type}' to '{new_type}'")
                for unit in units_to_update:
                    unit.service_type = new_type
                    units_updated += 1
            else:
                print(f"  - No units found with service_type '{old_type}'")
        
        # Migrate Emergencies  
        print("\n🚨 Migrating Emergencies...")
        for old_type, new_type in service_type_mapping.items():
            emergencies_to_update = Emergency.query.filter_by(emergency_type=old_type).all()
            if emergencies_to_update:
                print(f"  - Converting {len(emergencies_to_update)} emergencies from '{old_type}' to '{new_type}'")
                for emergency in emergencies_to_update:
                    emergency.emergency_type = new_type
                    emergencies_updated += 1
            else:
                print(f"  - No emergencies found with emergency_type '{old_type}'")
        
        # Commit changes
        if units_updated > 0 or emergencies_updated > 0:
            try:
                db.session.commit()
                print(f"\n✅ Migration completed successfully!")
                print(f"   - Units updated: {units_updated}")
                print(f"   - Emergencies updated: {emergencies_updated}")
            except Exception as e:
                db.session.rollback()
                print(f"\n❌ Migration failed: {str(e)}")
                return False
        else:
            print(f"\n✅ No migration needed - all service types already in correct format")
        
        # Verify migration
        print(f"\n🔍 Verification:")
        for new_type in service_type_mapping.values():
            unit_count = Unit.query.filter_by(service_type=new_type).count()
            emergency_count = Emergency.query.filter_by(emergency_type=new_type).count()
            print(f"  - {new_type}: {unit_count} units, {emergency_count} emergencies")
        
        return True

def check_current_state():
    """Check current service type state before migration"""
    print("📊 Current service type state:")
    
    with app.app_context():
        # Check units
        print("\n📦 Units by service_type:")
        units_by_type = db.session.query(Unit.service_type, db.func.count(Unit.unit_id)).group_by(Unit.service_type).all()
        for service_type, count in units_by_type:
            print(f"  - {service_type}: {count} units")
        
        # Check emergencies
        print("\n🚨 Emergencies by emergency_type:")
        emergencies_by_type = db.session.query(Emergency.emergency_type, db.func.count(Emergency.request_id)).group_by(Emergency.emergency_type).all()
        for emergency_type, count in emergencies_by_type:
            print(f"  - {emergency_type}: {count} emergencies")

if __name__ == "__main__":
    print("🗃️ Service Type Migration Tool")
    print("=" * 50)
    
    # Check current state
    check_current_state()
    
    # Ask for confirmation
    print("\n" + "=" * 50)
    response = input("Do you want to proceed with migration? (yes/no): ").strip().lower()
    
    if response in ['yes', 'y']:
        success = migrate_service_types()
        if success:
            print("\n🎉 Migration completed successfully!")
            sys.exit(0)
        else:
            print("\n💥 Migration failed!")
            sys.exit(1)
    else:
        print("Migration cancelled.")
        sys.exit(0)
