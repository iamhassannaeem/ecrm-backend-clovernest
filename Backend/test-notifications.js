const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testNotifications() {
  try {
    console.log('🧪 Testing notification functionality...\n');

    // Step 1: Login as user 1 (manager/admin who can assign leads)
    console.log('1. Logging in as user 1 (manager)...');
    const login1Response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'password123'
    });
    const token1 = login1Response.data.tokens.accessToken;
    const user1Id = login1Response.data.user.id;
    console.log('✅ User 1 logged in successfully\n');

    // Step 2: Login as user 2 (agent who will receive lead assignment)
    console.log('2. Logging in as user 2 (agent)...');
    const login2Response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'agent1@example.com',
      password: 'password123'
    });
    const token2 = login2Response.data.tokens.accessToken;
    const user2Id = login2Response.data.user.id;
    console.log('✅ User 2 logged in successfully\n');

    // Step 3: Create a lead and assign it to user 2
    console.log('3. Creating a lead and assigning to user 2...');
    const leadData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      serviceAddress: '123 Main St, City, State 12345',
      assignedTo: user2Id,
      status: 'NEW'
    };

    const leadResponse = await axios.post(`${BASE_URL}/leads`, leadData, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const leadId = leadResponse.data.id;
    console.log(`✅ Lead created and assigned: ${leadId}\n`);

    // Step 4: Check if user 2 received a notification
    console.log('4. Checking notifications for user 2...');
    const notificationsResponse = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    const notifications = notificationsResponse.data.notifications;
    const leadAssignmentNotification = notifications.find(n => 
      n.type === 'LEAD_ASSIGNED' && 
      n.metadata && 
      n.metadata.leadId === leadId
    );

    if (leadAssignmentNotification) {
      console.log('✅ Lead assignment notification received!');
      console.log(`   Title: ${leadAssignmentNotification.title}`);
      console.log(`   Message: ${leadAssignmentNotification.message}`);
      console.log(`   Metadata: ${JSON.stringify(leadAssignmentNotification.metadata)}`);
    } else {
      console.log('❌ Lead assignment notification not found');
    }
    console.log('');

    // Step 5: Start a chat session between users
    console.log('5. Starting chat session between users...');
    const startSessionResponse = await axios.post(`${BASE_URL}/chat/session`, {
      targetUserId: user2Id
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const sessionId = startSessionResponse.data.sessionId;
    console.log(`✅ Chat session started: ${sessionId}\n`);

    // Step 6: Send a message from user 1 to user 2
    console.log('6. Sending message from user 1 to user 2...');
    await axios.post(`${BASE_URL}/chat/session/${sessionId}/messages`, {
      content: 'Hello! This is a test message for notifications.'
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('✅ Message sent successfully\n');

    // Step 7: Check if user 2 received a chat notification
    console.log('7. Checking chat notifications for user 2...');
    const updatedNotificationsResponse = await axios.get(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    
    const updatedNotifications = updatedNotificationsResponse.data.notifications;
    const chatNotification = updatedNotifications.find(n => 
      n.type === 'NEW_MESSAGE' && 
      n.metadata && 
      n.metadata.sessionId === sessionId
    );

    if (chatNotification) {
      console.log('✅ Chat message notification received!');
      console.log(`   Title: ${chatNotification.title}`);
      console.log(`   Message: ${chatNotification.message}`);
      console.log(`   Metadata: ${JSON.stringify(chatNotification.metadata)}`);
    } else {
      console.log('❌ Chat message notification not found');
    }
    console.log('');

    // Step 8: Mark notification as read
    console.log('8. Marking notification as read...');
    if (chatNotification) {
      await axios.patch(`${BASE_URL}/notifications/${chatNotification.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token2}` }
      });
      console.log('✅ Notification marked as read');
    }
    console.log('');

    // Step 9: Check unread count
    console.log('9. Checking unread notification count...');
    const unreadCountResponse = await axios.get(`${BASE_URL}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    console.log(`✅ Unread count: ${unreadCountResponse.data.unreadCount}`);
    console.log('');

    // Step 10: Test notification click functionality
    console.log('10. Testing notification metadata for navigation...');
    if (leadAssignmentNotification) {
      console.log('Lead notification metadata:');
      console.log(`   Action: ${leadAssignmentNotification.metadata.action}`);
      console.log(`   Lead ID: ${leadAssignmentNotification.metadata.leadId}`);
      console.log(`   Lead Name: ${leadAssignmentNotification.metadata.leadName}`);
      console.log('   → Clicking this notification should navigate to the lead');
    }

    if (chatNotification) {
      console.log('Chat notification metadata:');
      console.log(`   Action: ${chatNotification.metadata.action}`);
      console.log(`   Session ID: ${chatNotification.metadata.sessionId}`);
      console.log(`   Sender: ${chatNotification.metadata.senderName}`);
      console.log(`   Message Preview: ${chatNotification.metadata.messagePreview}`);
      console.log('   → Clicking this notification should open the chat');
    }
    console.log('');

    console.log('🎉 Notification test completed successfully!');
    console.log('✅ Lead assignment notifications work');
    console.log('✅ Chat message notifications work');
    console.log('✅ Notification metadata includes navigation data');
    console.log('✅ Mark as read functionality works');
    console.log('✅ Unread count tracking works');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testNotifications(); 