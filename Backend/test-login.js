const axios = require('axios');

// Test the login route without authentication
async function testLoginRoute() {
  try {
    console.log('🧪 Testing Login Route Access...\n');
    
    // Test login route without token (should work)
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    console.log('✅ Login route is accessible without authentication');
    console.log('Response status:', response.status);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Login route error:');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.data.code === 'TOKEN_REQUIRED') {
        console.log('\n🔧 Issue: Login route still requires authentication');
        console.log('This means the global permission middleware is still being applied to auth routes');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Test a protected route with authentication (should fail without token)
async function testProtectedRoute() {
  try {
    console.log('\n🧪 Testing Protected Route...\n');
    
    // Test a protected route without token (should fail)
    const response = await axios.get('http://localhost:3001/api/users/profile');
    
    console.log('❌ Protected route should have failed without authentication');
    console.log('Response status:', response.status);
    
  } catch (error) {
    if (error.response) {
      console.log('✅ Protected route correctly requires authentication');
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.data.code === 'TOKEN_REQUIRED') {
        console.log('✅ Correctly returning TOKEN_REQUIRED for protected route');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  await testLoginRoute();
  await testProtectedRoute();
  console.log('\n🏁 Tests completed');
}

runTests(); 