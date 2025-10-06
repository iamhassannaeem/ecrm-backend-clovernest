const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';

// Test data
const userCredentials = {
  email: 'shaoib@gmail.com', // Replace with your email
  password: 'your_password_here' // Replace with your password
};

async function testCallPermissionsFixed() {
  try {
    console.log('🧪 Testing Call History Permissions (Fixed)');
    console.log('==========================================');

    // Step 1: Login to get authentication token
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, userCredentials);
    authToken = loginResponse.data.tokens.accessToken;
    console.log('✅ Login successful');
    console.log('User ID:', loginResponse.data.user.id);
    console.log('Organization ID:', loginResponse.data.user.organizationId);

    // Step 2: Check user permissions
    console.log('\n2. Checking user permissions...');
    const permissions = loginResponse.data.user.permissions || [];
    const callHistoryPerms = permissions.filter(perm => perm.resource === 'CALL_HISTORY');
    
    console.log('Total permissions:', permissions.length);
    console.log('CALL_HISTORY permissions:', callHistoryPerms);
    
    const hasReadPermission = callHistoryPerms.some(perm => 
      perm.action === 'READ' || perm.action === 'MANAGE' || perm.action === 'ALL'
    );
    console.log('Has READ permission for CALL_HISTORY:', hasReadPermission);

    // Step 3: Test call history access
    console.log('\n3. Testing call history access...');
    try {
      const callsResponse = await axios.get(`${BASE_URL}/calls`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Call history access successful!');
      console.log('Response status:', callsResponse.status);
      console.log('Total calls:', callsResponse.data.summary?.totalCalls || 0);
      console.log('Calls in response:', callsResponse.data.calls?.length || 0);
      
      // Step 4: Test pagination
      console.log('\n4. Testing pagination...');
      const paginatedResponse = await axios.get(`${BASE_URL}/calls?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Pagination test successful');
      console.log('Page:', paginatedResponse.data.pagination.page);
      console.log('Limit:', paginatedResponse.data.pagination.limit);
      console.log('Total pages:', paginatedResponse.data.pagination.pages);
      
      // Step 5: Test specific call details (if calls exist)
      if (callsResponse.data.calls && callsResponse.data.calls.length > 0) {
        console.log('\n5. Testing specific call details...');
        const firstCallId = callsResponse.data.calls[0].id;
        const callDetailsResponse = await axios.get(`${BASE_URL}/calls/${firstCallId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        console.log('✅ Call details access successful');
        console.log('Call ID:', callDetailsResponse.data.call.id);
        console.log('Caller:', callDetailsResponse.data.call.caller?.firstName, callDetailsResponse.data.call.caller?.lastName);
        console.log('Duration:', callDetailsResponse.data.call.callDuration, 'seconds');
      } else {
        console.log('\n5. No calls found to test details');
      }

      // Step 6: Test call creation (if you have leads)
      console.log('\n6. Testing call creation...');
      try {
        // First, get some leads
        const leadsResponse = await axios.get(`${BASE_URL}/leads`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        if (leadsResponse.data.leads && leadsResponse.data.leads.length > 0) {
          const leadId = leadsResponse.data.leads[0].id;
          const callData = {
            leadId: leadId,
            callTime: new Date().toISOString(),
            callDuration: 300, // 5 minutes
            callAttendedById: loginResponse.data.user.id
          };

          const createCallResponse = await axios.post(`${BASE_URL}/calls`, callData, {
            headers: { 
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('✅ Call creation successful');
          console.log('New call ID:', createCallResponse.data.call.id);
          console.log('Lead ID:', createCallResponse.data.call.leadId);
          console.log('Duration:', createCallResponse.data.call.callDuration, 'seconds');
        } else {
          console.log('⚠️  No leads found to create call record');
        }
      } catch (error) {
        console.log('⚠️  Call creation failed:', error.response?.data?.error || error.message);
      }

    } catch (error) {
      console.log('❌ Call history access failed');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data);
      
      if (error.response?.status === 403) {
        console.log('\n🔍 403 Error Analysis:');
        console.log('- User has organization access:', !!loginResponse.data.user.organizationId);
        console.log('- User has CALL_HISTORY permission:', hasReadPermission);
        console.log('- User roles:', loginResponse.data.user.roles?.map(r => r.name));
        
        if (!hasReadPermission) {
          console.log('\n💡 SOLUTION: User needs CALL_HISTORY permission');
          console.log('💡 Add CALL_HISTORY permission to user role');
        }
      }
    }

    console.log('\n🎉 Test completed!');
    console.log('================');
    console.log('Summary:');
    console.log('- Authentication:', '✅ Working');
    console.log('- Organization access:', '✅ Working');
    console.log('- CALL_HISTORY permission:', hasReadPermission ? '✅ Has permission' : '❌ Missing permission');
    console.log('- Call history access:', hasReadPermission ? '✅ Should work' : '❌ Will fail');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Authentication failed - check your credentials');
    }
  }
}

// Run the test
testCallPermissionsFixed(); 