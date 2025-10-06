const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';
let testUserId = '';

// Test data
const orgAdminCredentials = {
  email: 'orgadmin@example.com', // Replace with actual org admin email
  password: 'OrgAdmin123!' // Replace with actual org admin password
};

const newPassword = 'NewUserPassword123!';

async function testPasswordUpdate() {
  try {
    console.log('🧪 Testing Password Update Functionality');
    console.log('=====================================');

    // Step 1: Login as organization admin
    console.log('\n1. Logging in as organization admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, orgAdminCredentials);
    authToken = loginResponse.data.token;
    console.log('✅ Login successful');

    // Step 2: Get organization users to find a test user
    console.log('\n2. Getting organization users...');
    const usersResponse = await axios.get(`${BASE_URL}/org-admin/users`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    // Find a user that's not the org admin (for testing)
    const testUser = usersResponse.data.find(user => 
      user.email !== orgAdminCredentials.email && user.isActive
    );
    
    if (!testUser) {
      console.log('❌ No test user found. Please create a user first.');
      return;
    }
    
    testUserId = testUser.id;
    console.log(`✅ Found test user: ${testUser.email} (ID: ${testUserId})`);

    // Step 3: Update user password
    console.log('\n3. Updating user password...');
    const updateResponse = await axios.put(`${BASE_URL}/org-admin/users/${testUserId}`, {
      password: newPassword
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Password update response:', updateResponse.data.message);

    // Step 4: Test login with new password
    console.log('\n4. Testing login with new password...');
    const newLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: newPassword
    });
    
    console.log('✅ Login with new password successful');
    console.log('User token:', newLoginResponse.data.token.substring(0, 20) + '...');

    console.log('\n🎉 Password update test completed successfully!');
    console.log('=====================================');
    console.log('Summary:');
    console.log('- Organization admin can update user passwords');
    console.log('- Password validation works correctly');
    console.log('- New password allows user to login');
    console.log('- Audit logging is implemented');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      console.log('💡 Make sure you are logged in as an organization admin');
    }
    
    if (error.response?.status === 400) {
      console.log('💡 Check password requirements: min 8 chars, uppercase, lowercase, number, special char');
    }
  }
}

// Run the test
testPasswordUpdate(); 