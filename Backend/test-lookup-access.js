const axios = require('axios');

// Test lookup access with authentication
async function testLookupAccess() {
  try {
    console.log('🧪 Testing Lookup Access with Authentication...\n');
    
    // First, let's try to login to get a valid token
    console.log('1. Attempting to login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'superadmin@system.com',
      password: 'SuperAdmin123!'
    });
    
    console.log('✅ Login successful');
    console.log('Response status:', loginResponse.status);
    
    const token = loginResponse.data.accessToken;
    console.log('Token received:', token ? 'Yes' : 'No');
    
    // Now test lookup access with the token
    console.log('\n2. Testing lookup access with token...');
    const lookupResponse = await axios.get('http://localhost:3001/api/lookup', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Lookup access successful');
    console.log('Response status:', lookupResponse.status);
    console.log('Lookup data:', lookupResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error response:');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.data.code === 'PERMISSION_DENIED') {
        console.log('\n🔧 PERMISSION_DENIED detected - lookup routes should not require specific permissions');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Test lookup access without authentication (should fail)
async function testLookupAccessWithoutAuth() {
  try {
    console.log('\n🧪 Testing Lookup Access Without Authentication...\n');
    
    // Test lookup access without token (should fail)
    const lookupResponse = await axios.get('http://localhost:3001/api/lookup');
    
    console.log('❌ Lookup access should have failed without authentication');
    console.log('Response status:', lookupResponse.status);
    
  } catch (error) {
    if (error.response) {
      console.log('✅ Lookup access correctly requires authentication');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.data.code === 'TOKEN_REQUIRED') {
        console.log('✅ Correctly returning TOKEN_REQUIRED for lookup route');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  await testLookupAccess();
  await testLookupAccessWithoutAuth();
  console.log('\n🏁 Tests completed');
}

runTests(); 