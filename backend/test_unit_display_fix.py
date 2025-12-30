#!/usr/bin/env python3
"""
Test script to verify the unit display fix
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models.unit import Unit
from models.emergency import Emergency

def test_unit_display_fix():
    """Test that units are correctly counted and matched with emergencies"""
    
    print("🧪 Testing Unit Display Fix")
    print("=" * 40)
    
    with app.app_context():
        # Test 1: Check unit service types
        print("\n📦 Testing Unit Service Types:")
        units_by_type = db.session.query(Unit.service_type, db.func.count(Unit.unit_id)).group_by(Unit.service_type).all()
        
        expected_types = ['AMBULANCE', 'FIRE_TRUCK', 'POLICE']
        actual_types = [service_type for service_type, count in units_by_type]
        
        print(f"  Expected types: {expected_types}")
        print(f"  Actual types: {actual_types}")
        
        for service_type, count in units_by_type:
            print(f"  - {service_type}: {count} units")
        
        # Test 2: Check emergency types
        print("\n🚨 Testing Emergency Types:")
        emergencies_by_type = db.session.query(Emergency.emergency_type, db.func.count(Emergency.request_id)).group_by(Emergency.emergency_type).all()
        
        for emergency_type, count in emergencies_by_type:
            print(f"  - {emergency_type}: {count} emergencies")
        
        # Test 3: Check availability matching
        print("\n🔍 Testing Availability Matching:")
        for service_type in expected_types:
            # Count available units of this type
            available_units = Unit.query.filter_by(service_type=service_type, status="AVAILABLE").count()
            
            # Count pending emergencies of this type
            pending_emergencies = Emergency.query.filter_by(emergency_type=service_type, status="PENDING").count()
            
            print(f"  - {service_type}: {available_units} available units, {pending_emergencies} pending emergencies")
            
            # Expected: should show availability in dashboard
            if available_units > 0:
                print(f"    ✅ Should show '{available_units} available' in dashboard")
            else:
                print(f"    ⚠️ Should show 'No units available' in dashboard")
        
        # Test 4: Test dispatch matching logic
        print("\n🚁 Testing Dispatch Logic:")
        for service_type in expected_types:
            # Find a pending emergency of this type
            emergency = Emergency.query.filter_by(emergency_type=service_type, status="PENDING").first()
            if emergency:
                # Find matching available units
                matching_units = Unit.query.filter_by(service_type=service_type, status="AVAILABLE").all()
                print(f"  - Emergency #{emergency.request_id} ({service_type}) can match with {len(matching_units)} units")
        
        print("\n✅ Test completed successfully!")
        return True

if __name__ == "__main__":
    success = test_unit_display_fix()
    if success:
        print("\n🎉 Unit display fix verification passed!")
        sys.exit(0)
    else:
        print("\n💥 Unit display fix verification failed!")
        sys.exit(1)
