// CORS Test Script - Run in browser console to test CORS connectivity

console.log('🧪 Starting CORS connectivity tests...\n');

// Test 1: Basic API connectivity
async function testBasicAPI() {
  console.log('📡 Test 1: Basic API Connectivity');
  try {
    const response = await fetch('http://127.0.0.1:5001/api/units');
    const data = await response.json();
    console.log('✅ API Connected:', data);
    return true;
  } catch (error) {
    console.error('❌ API Failed:', error);
    return false;
  }
}

// Test 2: Axios API (same as frontend uses)
async function testAxiosAPI() {
  console.log('📡 Test 2: Axios API Connectivity');
  try {
    // Dynamic import for testing
    const axios = await import('axios');
    const response = await axios.default.get('http://127.0.0.1:5001/api/units');
    console.log('✅ Axios API Connected:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Axios API Failed:', error);
    return false;
  }
}

// Test 3: Socket.IO Connection
async function testSocketIO() {
  console.log('🔌 Test 3: Socket.IO Connectivity');
  return new Promise((resolve) => {
    try {
      // Dynamic import for testing
      import('socket.io-client').then(({ io }) => {
        const socket = io('http://127.0.0.1:5001');
        
        socket.on('connect', () => {
          console.log('✅ Socket.IO Connected');
          socket.emit('join_tracking_room');
          socket.disconnect();
          resolve(true);
        });
        
        socket.on('connect_error', (error) => {
          console.error('❌ Socket.IO Failed:', error);
          resolve(false);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          console.log('❌ Socket.IO Timeout');
          socket.disconnect();
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      console.error('❌ Socket.IO Import Failed:', error);
      resolve(false);
    }
  });
}

// Test 4: CORS Preflight
async function testCORSOptions() {
  console.log('🌐 Test 4: CORS Preflight Test');
  try {
    const response = await fetch('http://127.0.0.1:5001/api/units', {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    if (response.ok) {
      console.log('✅ CORS Preflight OK:', response.status);
      return true;
    } else {
      console.error('❌ CORS Preflight Failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ CORS Preflight Error:', error);
    return false;
  }
}

// Test 5: Different endpoints
async function testMultipleEndpoints() {
  console.log('📡 Test 5: Multiple Endpoints Test');
  const endpoints = [
    '/api/units',
    '/api/emergencies',
    '/api/authority/units'
  ];
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://127.0.0.1:5001${endpoint}`);
      if (response.ok) {
        console.log(`✅ ${endpoint}: OK`);
      } else {
        console.log(`⚠️ ${endpoint}: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${endpoint}:`, error);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running CORS Tests...\n');
  
  const results = {
    basicAPI: await testBasicAPI(),
    axiosAPI: await testAxiosAPI(),
    socketIO: await testSocketIO(),
    corsOptions: await testCORSOptions(),
    multipleEndpoints: await testMultipleEndpoints()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('================================');
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${test.padEnd(20)}: ${status}`);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  
  console.log('\n🎯 Overall Result:');
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All CORS tests passed! Your setup is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the console for details.');
  }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  runAllTests();
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests };
}
