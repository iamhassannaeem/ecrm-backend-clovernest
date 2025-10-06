const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testServer() {
  try {
    console.log('🔍 Testing server connection...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running');
    console.log('Health check response:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Server not running or health check failed:', error.message);
    return false;
  }
}

async function testLogin(email, password) {
  try {
    console.log(`🔐 Testing login with ${email}...`);
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email,
      password
    });
    
    if (response.data.tokens?.accessToken) {
      console.log('✅ Login successful');
      console.log('User info:', {
        id: response.data.user?.id,
        email: response.data.user?.email,
        role: response.data.user?.role
      });
      return response.data.tokens.accessToken;
    } else {
      console.log('❌ Login failed - no access token');
      return null;
    }
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Starting Simple Login Tests...\n');
  
  // Test 1: Check if server is running
  const serverRunning = await testServer();
  if (!serverRunning) {
    console.log('❌ Cannot proceed without server');
    return;
  }
  
  // Test 2: Try different login credentials
  const testCredentials = [
    { email: 'sahil@gmail.com', password: 'Sahil@123' },
    { email: 'sahil@gmail.com', password: 'SuperAdmin123!' },
    { email: 'sahil@gmail.com', password: 'password' },
    { email: 'sahil@gmail.com', password: '123456' },
    { email: 'manager@gmail.com', password: 'SuperAdmin123!' },
    { email: 'shaoib@gmail.com', password: 'SuperAdmin123!' }
  ];
  
  for (const cred of testCredentials) {
    const token = await testLogin(cred.email, cred.password);
    if (token) {
      console.log(`✅ Found working credentials: ${cred.email}`);
      break;
    }
  }
  
  console.log('\n🏁 Login tests completed!');
}

runTests().catch(console.error); 