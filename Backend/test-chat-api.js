const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
let accessToken = '';

// Test credentials
const testCredentials = {
  email: 'meharsahil94@gmail.com',
  password: 'SuperAdmin123!'
};

async function login() {
  try {
    console.log('🔐 Attempting to login...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, testCredentials);
    
    if (response.data.accessToken) {
      accessToken = response.data.accessToken;
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ Login failed - no access token received');
      return false;
    }
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
    console.log('Full error response:', error.response?.data);
    console.log('Status:', error.response?.status);
    return false;
  }
}

async function testGetContacts() {
  try {
    console.log('\n📞 Testing Get Chat Contacts...');
    const response = await axios.get(`${BASE_URL}/api/chat/contacts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Get Contacts successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log('❌ Get Contacts failed:', error.response?.data || error.message);
    return null;
  }
}

async function testStartSession(targetUserId) {
  try {
    console.log('\n💬 Testing Start Chat Session...');
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
    return null;
  }
}

async function testSendMessage(sessionId, content) {
  try {
    console.log('\n📝 Testing Send Message...');
    const response = await axios.post(`${BASE_URL}/api/chat/session/${sessionId}/message`, 
      { content },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Send Message successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data.messageId;
  } catch (error) {
    console.log('❌ Send Message failed:', error.response?.data || error.message);
    return null;
  }
}

async function testGetMessages(sessionId) {
  try {
    console.log('\n📋 Testing Get Messages...');
    const response = await axios.get(`${BASE_URL}/api/chat/session/${sessionId}/messages`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Get Messages successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log('❌ Get Messages failed:', error.response?.data || error.message);
    return null;
  }
}

async function testEndSession(sessionId) {
  try {
    console.log('\n🔚 Testing End Session...');
    const response = await axios.delete(`${BASE_URL}/api/chat/session/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ End Session successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ End Session failed:', error.response?.data || error.message);
    return false;
  }
}

async function runChatTests() {
  console.log('🧪 Starting Chat API Tests...\n');
  
  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without login');
    return;
  }
  
  // Step 2: Get contacts
  const contacts = await testGetContacts();
  if (!contacts) {
    console.log('❌ Cannot proceed without contacts');
    return;
  }
  
  // Step 3: Start a session (use first available contact)
  let targetUserId = null;
  if (contacts.teamLeads && contacts.teamLeads.length > 0) {
    targetUserId = contacts.teamLeads[0].id;
  } else if (contacts.agents && contacts.agents.length > 0) {
    targetUserId = contacts.agents[0].id;
  }
  
  if (!targetUserId) {
    console.log('❌ No contacts available for testing');
    return;
  }
  
  const sessionId = await testStartSession(targetUserId);
  if (!sessionId) {
    console.log('❌ Cannot proceed without session');
    return;
  }
  
  // Step 4: Send a message
  await testSendMessage(sessionId, 'Hello! This is a test message.');
  
  // Step 5: Get messages
  await testGetMessages(sessionId);
  
  // Step 6: End session
  await testEndSession(sessionId);
  
  console.log('\n🏁 Chat API Tests completed!');
}

// Run the tests
runChatTests().catch(console.error); 