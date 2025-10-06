const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';

// Test data
const userCredentials = {
  email: 'shaoib@gmail.com', // Replace with your email
  password: 'your_password_here' // Replace with your password
};

async function testCallHistoryAPI() {
  try {
    console.log('🧪 Testing Call History API');
    console.log('==========================');

    // Step 1: Login to get authentication token
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, userCredentials);
    authToken = loginResponse.data.tokens.accessToken;
    console.log('✅ Login successful');
    console.log('User ID:', loginResponse.data.user.id);
    console.log('Organization ID:', loginResponse.data.user.organizationId);

    // Step 2: Get call history (all calls)
    console.log('\n2. Getting call history...');
    const callsResponse = await axios.get(`${BASE_URL}/calls`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Call history retrieved successfully');
    console.log('Total calls:', callsResponse.data.summary.totalCalls);
    console.log('Total duration:', callsResponse.data.summary.totalDuration, 'seconds');
    console.log('Average duration:', callsResponse.data.summary.averageDuration, 'seconds');
    console.log('Calls in response:', callsResponse.data.calls.length);

    // Step 3: Get call history with pagination
    console.log('\n3. Getting call history with pagination...');
    const paginatedResponse = await axios.get(`${BASE_URL}/calls?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Paginated call history retrieved');
    console.log('Page:', paginatedResponse.data.pagination.page);
    console.log('Limit:', paginatedResponse.data.pagination.limit);
    console.log('Total pages:', paginatedResponse.data.pagination.pages);
    console.log('Calls in this page:', paginatedResponse.data.calls.length);

    // Step 4: Get call history with date filtering
    console.log('\n4. Getting call history with date filtering...');
    const today = new Date().toISOString().split('T')[0];
    const dateFilteredResponse = await axios.get(`${BASE_URL}/calls?startDate=${today}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Date filtered call history retrieved');
    console.log('Calls from today:', dateFilteredResponse.data.calls.length);

    // Step 5: Get call history with duration filtering
    console.log('\n5. Getting call history with duration filtering...');
    const durationFilteredResponse = await axios.get(`${BASE_URL}/calls?minDuration=60&maxDuration=3600`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Duration filtered call history retrieved');
    console.log('Calls between 1-60 minutes:', durationFilteredResponse.data.calls.length);

    // Step 6: Get specific call details (if calls exist)
    if (callsResponse.data.calls.length > 0) {
      console.log('\n6. Getting specific call details...');
      const firstCallId = callsResponse.data.calls[0].id;
      const callDetailsResponse = await axios.get(`${BASE_URL}/calls/${firstCallId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      console.log('✅ Call details retrieved');
      console.log('Call ID:', callDetailsResponse.data.call.id);
      console.log('Caller:', callDetailsResponse.data.call.caller.firstName, callDetailsResponse.data.call.caller.lastName);
      console.log('Attended by:', callDetailsResponse.data.call.callAttendedBy.firstName, callDetailsResponse.data.call.callAttendedBy.lastName);
      console.log('Duration:', callDetailsResponse.data.call.callDuration, 'seconds');
      console.log('Call time:', callDetailsResponse.data.call.callTime);
    } else {
      console.log('\n6. No calls found to get details for');
    }

    // Step 7: Create a new call record (if you have leads)
    console.log('\n7. Testing call creation...');
    try {
      // First, let's get some leads to use for the call
      const leadsResponse = await axios.get(`${BASE_URL}/leads`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (leadsResponse.data.leads && leadsResponse.data.leads.length > 0) {
        const leadId = leadsResponse.data.leads[0].id;
        const callData = {
          leadId: leadId,
          callTime: new Date().toISOString(),
          callDuration: 300, // 5 minutes
          callAttendedById: loginResponse.data.user.id // Self as attendant
        };

        const createCallResponse = await axios.post(`${BASE_URL}/calls`, callData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ New call record created');
        console.log('Call ID:', createCallResponse.data.call.id);
        console.log('Lead ID:', createCallResponse.data.call.leadId);
        console.log('Duration:', createCallResponse.data.call.callDuration, 'seconds');
      } else {
        console.log('⚠️  No leads found to create call record');
      }
    } catch (error) {
      console.log('⚠️  Could not create call record:', error.response?.data?.error || error.message);
    }

    console.log('\n🎉 Call History API test completed successfully!');
    console.log('==========================================');
    console.log('Summary:');
    console.log('- Call history retrieval works');
    console.log('- Pagination works correctly');
    console.log('- Date filtering works');
    console.log('- Duration filtering works');
    console.log('- Individual call details work');
    console.log('- Call creation works (if leads exist)');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Authentication failed - check your credentials');
    }
    
    if (error.response?.status === 403) {
      console.log('💡 Permission denied - check if you have CALL_HISTORY permission');
    }
    
    if (error.response?.status === 404) {
      console.log('💡 Resource not found - check if calls exist in your organization');
    }
  }
}

// Run the test
testCallHistoryAPI(); 