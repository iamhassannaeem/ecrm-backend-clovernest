const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
let accessToken = '';

// Test credentials - using agent user
const testCredentials = {
  email: 'sahil@gmail.com',
  password: 'Sahil@123'
};

async function login() {
  try {
    console.log('🔐 Attempting to login...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, testCredentials);
    
    if (response.data.tokens?.accessToken) {
      accessToken = response.data.tokens.accessToken;
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ Login failed - no access token received');
      return false;
    }
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetContacts() {
  try {
    console.log('\n📞 Testing Get Chat Contacts with New Permission System...');
    const response = await axios.get(`${BASE_URL}/api/chat/contacts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Get Contacts successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Check if the new permission structure is present
    if (response.data.permissions) {
      console.log('✅ New permission structure detected:');
      console.log('  - canChatWithAgents:', response.data.permissions.canChatWithAgents);
      console.log('  - canChatWithTeamLeads:', response.data.permissions.canChatWithTeamLeads);
      console.log('  - canChatWithAll:', response.data.permissions.canChatWithAll);
      console.log('  - hasDefaultTeamLeadAccess:', response.data.permissions.hasDefaultTeamLeadAccess);
      console.log('  - isAgent:', response.data.permissions.isAgent);
      console.log('  - isTeamLead:', response.data.permissions.isTeamLead);
      
      // Test default permission logic
      if (response.data.permissions.isAgent && response.data.permissions.hasDefaultTeamLeadAccess) {
        console.log('✅ Default agent-to-team-lead access working correctly');
      } else if (response.data.permissions.isTeamLead) {
        console.log('✅ Team lead has full access as expected');
      }
    } else {
      console.log('❌ New permission structure not found');
    }
    
    return response.data;
  } catch (error) {
    console.log('❌ Get Contacts failed:', error.response?.data || error.message);
    return null;
  }
}

async function testStartSession(targetUserId) {
  try {
    console.log('\n💬 Testing Start Chat Session with Permission Check...');
    const response = await axios.post(`${BASE_URL}/api/chat/session`, 
      { targetUserId },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Start Session successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data.sessionId;
  } catch (error) {
    console.log('❌ Start Session failed:', error.response?.data || error.message);
    if (error.response?.status === 403) {
      console.log('🔒 Permission denied - this is expected if user lacks chat permissions');
    }
    return null;
  }
}

async function testPermissionDenied() {
  try {
    console.log('\n🚫 Testing Permission Denied Scenario...');
    
    // Try to start a session with a non-existent user to test permission validation
    const response = await axios.post(`${BASE_URL}/api/chat/session`, 
      { targetUserId: 99999 }, // Non-existent user
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('❌ Expected permission denied but got success');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Permission validation working - user not found');
      console.log('Response:', error.response.data);
      return true;
    } else if (error.response?.status === 403) {
      console.log('✅ Permission denied as expected');
      console.log('Response:', error.response.data);
      return true;
    } else {
      console.log('❌ Unexpected error:', error.response?.data || error.message);
      return false;
    }
  }
}

async function runChatPermissionTests() {
  console.log('🧪 Starting Chat Permission Tests...\n');
  
  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without login');
    return;
  }
  
  // Step 2: Get contacts and check new permission structure
  const contacts = await testGetContacts();
  if (!contacts) {
    console.log('❌ Cannot proceed without contacts');
    return;
  }
  
  // Step 3: Test permission denied scenario
  await testPermissionDenied();
  
  // Step 4: Test starting a session (if contacts are available)
  if (contacts.teamLeads && contacts.teamLeads.length > 0) {
    const targetUserId = contacts.teamLeads[0].id;
    await testStartSession(targetUserId);
  } else if (contacts.agents && contacts.agents.length > 0) {
    const targetUserId = contacts.agents[0].id;
    await testStartSession(targetUserId);
  } else {
    console.log('⚠️  No contacts available for session testing');
  }
  
  console.log('\n🏁 Chat Permission Tests completed!');
}

// Run the tests
runChatPermissionTests().catch(console.error); 