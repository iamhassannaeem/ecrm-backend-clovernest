const axios = require('axios');

// Test profile access with authentication
async function testProfileAccess() {
  try {
    console.log('🧪 Testing Profile Access with Authentication...\n');
    
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
    
    // Now test profile access with the token
    console.log('\n2. Testing profile access with token...');
    const profileResponse = await axios.get('http://localhost:3001/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Profile access successful');
    console.log('Response status:', profileResponse.status);
    console.log('User data:', profileResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error response:');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.data.code === 'AUTH_ERROR') {
        console.log('\n🔧 AUTH_ERROR detected - this indicates an issue in the authentication middleware');
        console.log('Check the server logs for more details about the error');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Test lead creation with authentication
async function testLeadCreation() {
  try {
    console.log('\n🧪 Testing Lead Creation with Authentication...\n');
    
    // First, let's try to login to get a valid token
    console.log('1. Attempting to login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'superadmin@system.com',
      password: 'SuperAdmin123!'
    });
    
    console.log('✅ Login successful');
    
    const token = loginResponse.data.accessToken;
    
    // Now test lead creation with the token
    console.log('\n2. Testing lead creation with token...');
    const leadResponse = await axios.post('http://localhost:3001/api/leads', {
      title: 'Test Lead',
      description: 'This is a test lead',
      status: 'NEW'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Lead creation successful');
    console.log('Response status:', leadResponse.status);
    console.log('Lead data:', leadResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error response:');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  await testProfileAccess();
  await testLeadCreation();
  console.log('\n🏁 Tests completed');
}

runTests(); 