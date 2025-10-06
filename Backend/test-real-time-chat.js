const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const TEST_TOKEN = 'your-jwt-token-here'; // Replace with actual JWT token

// Test users (replace with actual user IDs from your database)
const USER1_ID = 1;
const USER2_ID = 2;
const ORGANIZATION_ID = 1;

console.log('🚀 Testing Real-Time Chat System');
console.log('================================');

// Create two socket connections to simulate two users
const user1Socket = io(SERVER_URL, {
  auth: { token: TEST_TOKEN }
});

const user2Socket = io(SERVER_URL, {
  auth: { token: TEST_TOKEN }
});

// User 1 event handlers
user1Socket.on('connect', () => {
  console.log('✅ User 1 connected');
  
  // Join organization
  user1Socket.emit('joinOrganization', { organizationId: ORGANIZATION_ID });
  
  // Get conversations
  user1Socket.emit('getConversations');
});

user1Socket.on('conversationsList', (data) => {
  console.log('📋 User 1 conversations:', data.conversations.length);
  
  // Start conversation with User 2
  user1Socket.emit('getOrCreateConversation', { targetUserId: USER2_ID });
});

user1Socket.on('conversationLoaded', (data) => {
  console.log('💬 User 1: Conversation loaded');
  console.log('   - Conversation ID:', data.conversationId);
  console.log('   - Participants:', data.participants.length);
  console.log('   - Messages:', data.messages.length);
  console.log('   - Unread count:', data.unreadCount);
  
  // Send a message
  setTimeout(() => {
    user1Socket.emit('sendMessage', {
      conversationId: data.conversationId,
      content: "Hello from User 1! 👋",
      messageType: "text"
    });
  }, 1000);
});

user1Socket.on('messageDelivered', (data) => {
  console.log('✅ User 1: Message delivered');
  console.log('   - Message ID:', data.messageId);
  console.log('   - Timestamp:', data.timestamp);
});

user1Socket.on('newMessage', (message) => {
  console.log('📨 User 1: New message received');
  console.log('   - From:', message.senderName);
  console.log('   - Content:', message.content);
  console.log('   - Timestamp:', message.createdAt);
  
  // Mark messages as read
  setTimeout(() => {
    user1Socket.emit('markMessagesAsRead', { conversationId: message.conversationId });
  }, 500);
});

user1Socket.on('messagesRead', (data) => {
  console.log('👀 User 1: Messages marked as read by User 2');
});

user1Socket.on('userTyping', (data) => {
  console.log('⌨️  User 1: User 2 is typing...');
});

user1Socket.on('newMessageNotification', (data) => {
  console.log('🔔 User 1: New message notification');
  console.log('   - From:', data.senderName);
  console.log('   - Preview:', data.content);
});

user1Socket.on('userStatusChanged', (data) => {
  console.log('🟢 User 1: User status changed');
  console.log('   - User ID:', data.userId);
  console.log('   - Online:', data.isOnline);
});

user1Socket.on('error', (error) => {
  console.error('❌ User 1 Error:', error);
});

// User 2 event handlers
user2Socket.on('connect', () => {
  console.log('✅ User 2 connected');
  
  // Join organization
  user2Socket.emit('joinOrganization', { organizationId: ORGANIZATION_ID });
  
  // Get conversations
  user2Socket.emit('getConversations');
});

user2Socket.on('conversationsList', (data) => {
  console.log('📋 User 2 conversations:', data.conversations.length);
});

user2Socket.on('conversationLoaded', (data) => {
  console.log('💬 User 2: Conversation loaded');
  console.log('   - Conversation ID:', data.conversationId);
  console.log('   - Participants:', data.participants.length);
  console.log('   - Messages:', data.messages.length);
  console.log('   - Unread count:', data.unreadCount);
});

user2Socket.on('newMessage', (message) => {
  console.log('📨 User 2: New message received');
  console.log('   - From:', message.senderName);
  console.log('   - Content:', message.content);
  console.log('   - Timestamp:', message.createdAt);
  
  // Send typing indicator
  user2Socket.emit('typing', { 
    conversationId: message.conversationId, 
    isTyping: true 
  });
  
  // Send reply after a delay
  setTimeout(() => {
    user2Socket.emit('typing', { 
      conversationId: message.conversationId, 
      isTyping: false 
    });
    
    user2Socket.emit('sendMessage', {
      conversationId: message.conversationId,
      content: "Hi User 1! Thanks for the message! 😊",
      messageType: "text"
    });
  }, 2000);
});

user2Socket.on('messageDelivered', (data) => {
  console.log('✅ User 2: Message delivered');
  console.log('   - Message ID:', data.messageId);
  console.log('   - Timestamp:', data.timestamp);
});

user2Socket.on('messagesRead', (data) => {
  console.log('👀 User 2: Messages marked as read by User 1');
});

user2Socket.on('userTyping', (data) => {
  console.log('⌨️  User 2: User 1 is typing...');
});

user2Socket.on('newMessageNotification', (data) => {
  console.log('🔔 User 2: New message notification');
  console.log('   - From:', data.senderName);
  console.log('   - Preview:', data.content);
});

user2Socket.on('userStatusChanged', (data) => {
  console.log('🟢 User 2: User status changed');
  console.log('   - User ID:', data.userId);
  console.log('   - Online:', data.isOnline);
});

user2Socket.on('error', (error) => {
  console.error('❌ User 2 Error:', error);
});

// Test message deletion
setTimeout(() => {
  console.log('\n🗑️  Testing message deletion...');
  // This would require a message ID from a previous message
  // user1Socket.emit('deleteMessage', { messageId: 123 });
}, 10000);

// Test pagination
setTimeout(() => {
  console.log('\n📄 Testing message pagination...');
  // This would require a conversation ID
  // user1Socket.emit('getMessages', { conversationId: 1, page: 1, limit: 10 });
}, 12000);

// Cleanup after 15 seconds
setTimeout(() => {
  console.log('\n🛑 Test completed. Disconnecting...');
  user1Socket.disconnect();
  user2Socket.disconnect();
  process.exit(0);
}, 15000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted. Disconnecting...');
  user1Socket.disconnect();
  user2Socket.disconnect();
  process.exit(0);
});

console.log('\n⏳ Test running for 15 seconds...');
console.log('Press Ctrl+C to stop early\n'); 