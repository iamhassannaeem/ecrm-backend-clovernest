const axios = require('axios');

// Test users access with authentication
async function testUsersAccess() {
  try {
    console.log('🧪 Testing Users Access with Authentication...\n');
    
    // First, let's try to login to get a valid token
    console.log('1. Attempting to login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'meharsahil94@gmail.com', // Using the actual user from database
      password: 'password123' // You'll need to provide the correct password
    });
    
    console.log('✅ Login successful');
    console.log('Response status:', loginResponse.status);
    
    const token = loginResponse.data.accessToken;
    console.log('Token received:', token ? 'Yes' : 'No');
    
    // Now test users access with the token
    console.log('\n2. Testing users access with token...');
    const usersResponse = await axios.get('http://localhost:3001/api/users/non-agents', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Users access successful');
    console.log('Response status:', usersResponse.status);
    console.log('Users data:', usersResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error response:');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.data.code === 'PERMISSION_DENIED') {
        console.log('\n🔧 PERMISSION_DENIED detected - users route should not require specific permissions');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Test users access without authentication (should fail)
async function testUsersAccessWithoutAuth() {
  try {
    console.log('\n🧪 Testing Users Access Without Authentication...\n');
    
    // Test users access without token (should fail)
    const usersResponse = await axios.get('http://localhost:3001/api/users/non-agents');
    
    console.log('❌ Users access should have failed without authentication');
    console.log('Response status:', usersResponse.status);
    
  } catch (error) {
    if (error.response) {
      console.log('✅ Users access correctly requires authentication');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.data.code === 'TOKEN_REQUIRED') {
        console.log('✅ Correctly returning TOKEN_REQUIRED for users route');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  await testUsersAccess();
  await testUsersAccessWithoutAuth();
  console.log('\n🏁 Tests completed');
}

runTests(); 