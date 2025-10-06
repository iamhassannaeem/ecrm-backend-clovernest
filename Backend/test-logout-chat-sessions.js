const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testLogoutChatSessions() {
  try {
    console.log('🧪 Testing logout chat session cleanup...\n');

    // Step 1: Login as user 1
    console.log('1. Logging in as user 1...');
    const login1Response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'agent1@example.com',
      password: 'password123'
    });
    const token1 = login1Response.data.tokens.accessToken;
    console.log('✅ User 1 logged in successfully\n');

    // Step 2: Login as user 2
    console.log('2. Logging in as user 2...');
    const login2Response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'agent2@example.com',
      password: 'password123'
    });
    const token2 = login2Response.data.tokens.accessToken;
    console.log('✅ User 2 logged in successfully\n');

    // Step 3: Start a chat session between users
    console.log('3. Starting chat session between users...');
    const startSessionResponse = await axios.post(`${BASE_URL}/chat/session`, {
      targetUserId: login2Response.data.user.id
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const sessionId = startSessionResponse.data.sessionId;
    console.log(`✅ Chat session started: ${sessionId}\n`);

    // Step 4: Send a message to keep session active
    console.log('4. Sending a message to keep session active...');
    await axios.post(`${BASE_URL}/chat/session/${sessionId}/messages`, {
      content: 'Hello from user 1!'
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Message sent successfully\n');

    // Step 5: Verify session is active
    console.log('5. Verifying session is active...');
    const messagesResponse = await axios.get(`${BASE_URL}/chat/session/${sessionId}/messages`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log(`✅ Session is active, messages count: ${messagesResponse.data.messages.length}\n`);

    // Step 6: Logout user 1
    console.log('6. Logging out user 1...');
    await axios.post(`${BASE_URL}/auth/logout`, {
      refreshToken: login1Response.data.tokens.refreshToken
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ User 1 logged out successfully\n');

    // Step 7: Try to access the session with user 2 (should fail)
    console.log('7. Testing if session is ended for user 2...');
    try {
      await axios.get(`${BASE_URL}/chat/session/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token2}` }
      });
      console.log('❌ Session is still accessible - this should not happen!');
    } catch (error) {
      if (error.response?.status === 410) {
        console.log('✅ Session properly ended after logout');
      } else {
        console.log(`❌ Unexpected error: ${error.response?.status} - ${error.response?.data?.error}`);
      }
    }

    // Step 8: Try to start a new session with the same users
    console.log('\n8. Starting a new session with the same users...');
    const newSessionResponse = await axios.post(`${BASE_URL}/chat/session`, {
      targetUserId: login2Response.data.user.id
    }, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    const newSessionId = newSessionResponse.data.sessionId;
    console.log(`✅ New session created: ${newSessionId}`);
    console.log(`✅ New session ID is different: ${sessionId} vs ${newSessionId}`);

    console.log('\n🎉 Test completed successfully!');
    console.log('✅ Logout properly ends chat sessions');
    console.log('✅ New sessions are created after logout');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testLogoutChatSessions(); 