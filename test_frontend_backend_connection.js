// Simple test to verify frontend can communicate with backend
const axios = require('axios');

async function testConnection() {
  console.log('🔍 Testing Frontend to Backend Connection...');
  
  try {
    // Test units endpoint
    console.log('📡 Testing /api/units endpoint...');
    const unitsResponse = await axios.get('http://127.0.0.1:5001/api/units', {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Units API Response Status:', unitsResponse.status);
    console.log('✅ Units API Response Data:', unitsResponse.data);
    console.log('✅ Units Count:', unitsResponse.data?.length || 0);
    
    if (unitsResponse.data && unitsResponse.data.length > 0) {
      console.log('📊 Unit Details:');
      unitsResponse.data.forEach((unit, index) => {
        console.log(`  ${index + 1}. ${unit.service_type} - ${unit.status} - ${unit.unit_vehicle_number}`);
      });
      
      const availableUnits = unitsResponse.data.filter(u => u.status === 'AVAILABLE');
      console.log(`✅ Available Units: ${availableUnits.length}`);
    }
    
  } catch (error) {
    console.error('❌ Connection Failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

testConnection();
