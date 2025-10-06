const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';

// Test data
const userCredentials = {
  email: 'shaoib@gmail.com', // Replace with your email
  password: 'your_password_here' // Replace with your password
};

async function debugCallPermissions() {
  try {
    console.log('🔍 Debugging Call History Permissions');
    console.log('====================================');

    // Step 1: Login to get authentication token
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, userCredentials);
    authToken = loginResponse.data.tokens.accessToken;
    console.log('✅ Login successful');
    console.log('User ID:', loginResponse.data.user.id);
    console.log('Organization ID:', loginResponse.data.user.organizationId);

    // Step 2: Check user details and permissions
    console.log('\n2. Checking user details...');
    console.log('User roles:', loginResponse.data.user.roles);
    console.log('User permissions:', loginResponse.data.user.permissions);

    // Step 3: Check if user has CALL_HISTORY permission
    console.log('\n3. Checking CALL_HISTORY permission...');
    const hasCallHistoryPermission = loginResponse.data.user.permissions && 
      loginResponse.data.user.permissions.some(perm => 
        perm.resource === 'CALL_HISTORY' && 
        (perm.action === 'READ' || perm.action === 'MANAGE')
      );
    
    console.log('Has CALL_HISTORY permission:', hasCallHistoryPermission);
    
    if (loginResponse.data.user.permissions) {
      const callHistoryPerms = loginResponse.data.user.permissions.filter(perm => 
        perm.resource === 'CALL_HISTORY'
      );
      console.log('CALL_HISTORY permissions found:', callHistoryPerms);
    }

    // Step 4: Check user roles
    console.log('\n4. Checking user roles...');
    const roles = loginResponse.data.user.roles || [];
    console.log('Total roles:', roles.length);
    
    roles.forEach((role, index) => {
      console.log(`Role ${index + 1}:`, {
        id: role.id,
        name: role.name,
        isAgent: role.isAgent,
        organizationId: role.organizationId
      });
    });

    // Step 5: Try to access call history
    console.log('\n5. Testing call history access...');
    try {
      const callsResponse = await axios.get(`${BASE_URL}/calls`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Call history access successful!');
      console.log('Total calls:', callsResponse.data.summary?.totalCalls || 0);
      
    } catch (error) {
      console.log('❌ Call history access failed');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data);
      
      if (error.response?.status === 403) {
        console.log('\n🔍 403 Error Analysis:');
        console.log('- User has organization access:', !!loginResponse.data.user.organizationId);
        console.log('- User has roles:', roles.length > 0);
        console.log('- User has CALL_HISTORY permission:', hasCallHistoryPermission);
        
        // Check if it's a permission issue or organization access issue
        if (hasCallHistoryPermission) {
          console.log('💡 User has CALL_HISTORY permission but still getting 403');
          console.log('💡 This might be an organization access issue');
        } else {
          console.log('💡 User does not have CALL_HISTORY permission');
          console.log('💡 Need to assign CALL_HISTORY permission to user role');
        }
      }
    }

    // Step 6: Check organization details
    console.log('\n6. Checking organization details...');
    try {
      const orgResponse = await axios.get(`${BASE_URL}/organizations/${loginResponse.data.user.organizationId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Organization access successful');
      console.log('Organization name:', orgResponse.data.organization.name);
      
    } catch (error) {
      console.log('❌ Organization access failed');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data);
    }

    console.log('\n🎯 Debug Summary:');
    console.log('================');
    console.log('User ID:', loginResponse.data.user.id);
    console.log('Organization ID:', loginResponse.data.user.organizationId);
    console.log('Roles count:', roles.length);
    console.log('Has CALL_HISTORY permission:', hasCallHistoryPermission);
    console.log('Organization access:', !!loginResponse.data.user.organizationId);

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Authentication failed - check your credentials');
    }
  }
}

// Run the debug
debugCallPermissions(); 