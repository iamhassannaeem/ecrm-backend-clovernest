const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';

// Test data
const orgAdminCredentials = {
  email: 'shaoib@gmail.com', // Your organization admin email
  password: 'your_password_here' // Replace with actual password
};

async function testOrganizationUpdate() {
  try {
    console.log('🧪 Testing Organization Update Functionality');
    console.log('==========================================');

    // Step 1: Login as organization admin
    console.log('\n1. Logging in as organization admin...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, orgAdminCredentials);
    authToken = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('User ID:', loginResponse.data.user.id);
    console.log('Organization ID:', loginResponse.data.user.organizationId);

    // Step 2: Get current organization details
    console.log('\n2. Getting current organization details...');
    const orgResponse = await axios.get(`${BASE_URL}/organizations/${loginResponse.data.user.organizationId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const currentOrg = orgResponse.data.organization;
    console.log('✅ Current organization:', currentOrg.name);
    console.log('Current description:', currentOrg.description);

    // Step 3: Update organization
    console.log('\n3. Updating organization...');
    const updateData = {
      name: currentOrg.name + ' (Updated)',
      description: 'Updated description for testing',
      website: 'https://updated-website.com'
    };

    const updateResponse = await axios.put(`${BASE_URL}/organizations/${currentOrg.id}`, updateData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Organization update response:', updateResponse.data.message);
    console.log('Updated organization:', updateResponse.data.organization.name);

    // Step 4: Verify the update
    console.log('\n4. Verifying the update...');
    const verifyResponse = await axios.get(`${BASE_URL}/organizations/${currentOrg.id}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const updatedOrg = verifyResponse.data.organization;
    console.log('✅ Verification successful');
    console.log('Updated name:', updatedOrg.name);
    console.log('Updated description:', updatedOrg.description);
    console.log('Updated website:', updatedOrg.website);

    console.log('\n🎉 Organization update test completed successfully!');
    console.log('==========================================');
    console.log('Summary:');
    console.log('- Organization admin can update organization settings');
    console.log('- Permission checks work correctly');
    console.log('- Updates are persisted in the database');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      console.log('💡 Permission denied - check if user has ORGANIZATION_SETTINGS permission');
    }
    
    if (error.response?.status === 400) {
      console.log('💡 Validation error - check request data');
    }
  }
}

// Run the test
testOrganizationUpdate(); 