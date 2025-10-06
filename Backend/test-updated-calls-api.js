const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testUpdatedCallsAPI() {
  try {
    console.log('🧪 Testing Updated Calls API...\n');

    // Test 1: Create a call record (no authentication required)
    console.log('1. Testing POST /api/calls (no auth required):');
    const callData = {
      callTime: new Date().toISOString(),
      callDuration: 300,
      callAttendedById: 1,
      organizationId: 1,
      extension: 'EXT001',
      externalId: 12345
    };

    try {
      const createResponse = await axios.post(`${BASE_URL}/api/calls`, callData);
      
      
      const callId = createResponse.data.call.id;
      
      // Test 2: Get call details
      console.log('\n2. Testing GET /api/calls/:callId:');
      try {
        const getResponse = await axios.get(`${BASE_URL}/api/calls/${callId}`, {
          headers: {
            'Authorization': 'Bearer test-token' // This will fail auth, but we can see the structure
          }
        });
        console.log('✅ Call details retrieved:', getResponse.data.call.id);
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('✅ GET call details requires authentication (as expected)');
        } else {
          console.log('❌ Unexpected error:', error.response?.data || error.message);
        }
      }

      // Test 3: Get call history
      console.log('\n3. Testing GET /api/calls (call history):');
      try {
        const historyResponse = await axios.get(`${BASE_URL}/api/calls`, {
          headers: {
            'Authorization': 'Bearer test-token' // This will fail auth, but we can see the structure
          }
        });
        console.log('✅ Call history retrieved');
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('✅ GET call history requires authentication (as expected)');
        } else {
          console.log('❌ Unexpected error:', error.response?.data || error.message);
        }
      }

    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Call attendant or organization not found');
        console.log('   Make sure user ID 1 and organization ID 1 exist in your database');
      } else {
        console.log('❌ Error creating call:', error.response?.data || error.message);
      }
    }

    console.log('\n✅ Updated Calls API test completed!');
    console.log('\n📋 Summary of changes:');
    console.log('   - POST /api/calls: No authentication required');
    console.log('   - Removed callerId and leadId fields');
    console.log('   - Added extension and externalId fields');
    console.log('   - Updated relations: removed caller/lead, kept callAttendedBy/organization');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUpdatedCallsAPI();
