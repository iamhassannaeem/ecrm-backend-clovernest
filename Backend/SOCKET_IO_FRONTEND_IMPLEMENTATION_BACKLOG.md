
This comprehensive backlog file provides your frontend team with:

1. **Complete implementation details** for all Socket.IO events
2. **Actual response structures** from the backend
3. **Step-by-step implementation guide** with code examples
4. **Unread count system** explanation and implementation
5. **Error handling strategies** for all scenarios
6. **Performance optimization techniques**
7. **Testing checklist** to ensure quality
8. **Implementation phases** for organized development

Your frontend team can use this as their primary reference document for implementing the real-time chat system.

# Socket.IO Frontend Implementation Backlog
## Complete Implementation Guide with Response Structures

### Table of Contents
1. [Connection Setup](#connection-setup)
2. [Event Handlers](#event-handlers)
3. [Response Structures](#response-structures)
4. [Unread Count System](#unread-count-system)
5. [Error Handling](#error-handling)
6. [Performance Optimization](#performance-optimization)
7. [Testing Checklist](#testing-checklist)

---

## Connection Setup

### 1.1 Initialize Socket Connection
```javascript
import { io } from 'socket.io-client';

class ChatSocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.token = null;
    this.organizationId = null;
  }

  connect(token, organizationId) {
    this.token = token;
    this.organizationId = organizationId;
    
    this.socket = io('YOUR_BACKEND_URL', {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.setupEventListeners();
    this.setupConnectionHandlers();
    
    // Auto-join organization after connection
    this.socket.on('connect', () => {
      this.joinOrganization(organizationId);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}
```

### 1.2 Connection Event Handlers
```javascript
setupConnectionHandlers() {
  this.socket.on('connect', () => {
    console.log('✅ Connected to chat server');
    this.isConnected = true;
    this.dispatch({ type: 'SOCKET_CONNECTED' });
  });

  this.socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from chat server:', reason);
    this.isConnected = false;
    this.dispatch({ type: 'SOCKET_DISCONNECTED', payload: { reason } });
  });

  this.socket.on('connect_error', (error) => {
    console.error('🔴 Connection error:', error);
    this.dispatch({ type: 'SOCKET_CONNECTION_ERROR', payload: { error } });
  });

  this.socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Reconnected after', attemptNumber, 'attempts');
    this.dispatch({ type: 'SOCKET_RECONNECTED', payload: { attemptNumber } });
  });
}
```

---

## Event Handlers

### 2.1 Setup All Event Listeners
```javascript
setupEventListeners() {
  // Connection Events
  this.socket.on('connect', this.handleConnect.bind(this));
  this.socket.on('disconnect', this.handleDisconnect.bind(this));
  this.socket.on('error', this.handleError.bind(this));

  // Chat Events
  this.socket.on('newMessage', this.handleNewMessage.bind(this));
  this.socket.on('messageDelivered', this.handleMessageDelivered.bind(this));
  this.socket.on('messagesRead', this.handleMessagesRead.bind(this));
  this.socket.on('userTyping', this.handleUserTyping.bind(this));
  this.socket.on('conversationLoaded', this.handleConversationLoaded.bind(this));
  this.socket.on('conversationsList', this.handleConversationsList.bind(this));
  this.socket.on('messagesLoaded', this.handleMessagesLoaded.bind(this));
  this.socket.on('messageDeleted', this.handleMessageDeleted.bind(this));

  // Group Chat Events
  this.socket.on('newGroupMessage', this.handleNewGroupMessage.bind(this));
  this.socket.on('groupMessageDelivered', this.handleGroupMessageDelivered.bind(this));
  this.socket.on('groupChatLoaded', this.handleGroupChatLoaded.bind(this));
  this.socket.on('groupUserTyping', this.handleGroupUserTyping.bind(this));

  // Notification Events
  this.socket.on('newMessageNotification', this.handleNewMessageNotification.bind(this));
  this.socket.on('newGroupMessageNotification', this.handleNewGroupMessageNotification.bind(this));

  // Status Events
  this.socket.on('userStatusChanged', this.handleUserStatusChanged.bind(this));
}
```

---

## Response Structures

### 3.1 Chat Event Responses

#### 3.1.1 New Message Event
**Event:** `newMessage`
**Triggered when:** Someone sends a message in a conversation you're part of

**Response Structure:**
```json
{
  "id": 12345,
  "conversationId": "67890",
  "senderId": 111,
  "senderName": "John Doe",
  "content": "Hello, how are you?",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "isRead": false,
  "messageType": "text"
}
```

**Frontend Handler:**
```javascript
handleNewMessage(messageData) {
  console.log('📨 New message received:', messageData);
  
  // Update chat state
  this.dispatch({
    type: 'CHAT_ADD_MESSAGE',
    payload: {
      conversationId: messageData.conversationId,
      message: {
        id: messageData.id,
        senderId: messageData.senderId,
        senderName: messageData.senderName,
        content: messageData.content,
        createdAt: new Date(messageData.createdAt),
        isRead: false,
        messageType: messageData.messageType
      }
    }
  });

  // Send confirmation to server
  this.socket.emit('messageReceived', {
    messageId: messageData.id,
    conversationId: messageData.conversationId
  });

  // Update unread count
  this.unreadManager.incrementUnreadCount(messageData.conversationId);
  
  // Show notification if not in conversation
  if (!this.isInConversation(messageData.conversationId)) {
    this.showMessageNotification(messageData);
  }
}
```

#### 3.1.2 Message Delivered Event
**Event:** `messageDelivered`
**Triggered when:** Your message is delivered to the server

**Response Structure:**
```json
{
  "messageId": 12345,
  "conversationId": "67890",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Frontend Handler:**
```javascript
handleMessageDelivered(data) {
  console.log('✅ Message delivered:', data);
  
  this.dispatch({
    type: 'CHAT_MESSAGE_DELIVERED',
    payload: {
      messageId: data.messageId,
      conversationId: data.conversationId,
      timestamp: new Date(data.timestamp)
    }
  });
}
```

#### 3.1.3 Messages Read Event
**Event:** `messagesRead`
**Triggered when:** Someone reads messages in a conversation

**Response Structure:**
```json
{
  "conversationId": "67890",
  "readBy": 222,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Frontend Handler:**
```javascript
handleMessagesRead(data) {
  console.log('👁️ Messages read by:', data.readBy);
  
  this.dispatch({
    type: 'CHAT_MESSAGES_READ',
    payload: {
      conversationId: data.conversationId,
      readBy: data.readBy,
      timestamp: new Date(data.timestamp)
    }
  });
}
```

#### 3.1.4 User Typing Event
**Event:** `userTyping`
**Triggered when:** Someone starts/stops typing

**Response Structure:**
```json
{
  "conversationId": "67890",
  "userId": 111,
  "isTyping": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Frontend Handler:**
```javascript
handleUserTyping(data) {
  console.log('⌨️ User typing:', data);
  
  this.dispatch({
    type: 'CHAT_USER_TYPING',
    payload: {
      conversationId: data.conversationId,
      userId: data.userId,
      isTyping: data.isTyping,
      timestamp: new Date(data.timestamp)
    }
  });
}
```

### 3.2 Conversation Management Responses

#### 3.2.1 Conversation Loaded Event
**Event:** `conversationLoaded`
**Triggered when:** You join a conversation

**Response Structure:**
```json
{
  "conversationId": "67890",
  "participants": [
    {
      "id": 111,
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "avatar1.jpg",
      "isOnline": true,
      "lastSeen": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 222,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "avatar": "avatar2.jpg",
      "isOnline": false,
      "lastSeen": "2024-01-15T09:15:00.000Z"
    }
  ],
  "messages": [
    {
      "id": 12345,
      "senderId": 111,
      "senderName": "John Doe",
      "content": "Hello!",
      "createdAt": "2024-01-15T10:25:00.000Z",
      "isRead": true,
      "readAt": "2024-01-15T10:26:00.000Z"
    }
  ],
  "unreadCount": 0
}
```

**Frontend Handler:**
```javascript
handleConversationLoaded(data) {
  console.log('💬 Conversation loaded:', data);
  
  this.dispatch({
    type: 'CHAT_CONVERSATION_LOADED',
    payload: {
      conversationId: data.conversationId,
      participants: data.participants,
      messages: data.messages,
      unreadCount: data.unreadCount
    }
  });

  // Mark conversation as read
  this.unreadManager.markConversationAsRead(data.conversationId);
}
```

#### 3.2.2 Conversations List Event
**Event:** `conversationsList`
**Triggered when:** You request conversations list

**Response Structure:**
```json
{
  "conversations": [
    {
      "id": "67890",
      "otherUser": {
        "id": 222,
        "name": "Jane Smith",
        "email": "jane@example.com",
        "avatar": "avatar2.jpg",
        "isOnline": false,
        "lastSeen": "2024-01-15T09:15:00.000Z"
      },
      "lastMessage": {
        "id": 12345,
        "content": "Hello!",
        "senderId": 111,
        "senderName": "John Doe",
        "createdAt": "2024-01-15T10:25:00.000Z",
        "isRead": false
      },
      "lastMessageAt": "2024-01-15T10:25:00.000Z",
      "createdAt": "2024-01-15T08:00:00.000Z",
      "updatedAt": "2024-01-15T10:25:00.000Z",
      "unreadCount": 2
    }
  ]
}
```

**Frontend Handler:**
```javascript
handleConversationsList(data) {
  console.log(' Conversations list loaded:', data);
  
  this.dispatch({
    type: 'CHAT_CONVERSATIONS_LIST_LOADED',
    payload: { conversations: data.conversations }
  });

  // Update unread counts for all conversations
  data.conversations.forEach(conv => {
    this.unreadManager.setUnreadCount(conv.id, conv.unreadCount);
  });
}
```

### 3.3 Group Chat Responses

#### 3.3.1 New Group Message Event
**Event:** `newGroupMessage`
**Triggered when:** Someone sends a message in a group chat

**Response Structure:**
```json
{
  "id": 12345,
  "groupId": "99999",
  "senderId": 111,
  "senderName": "John Doe",
  "content": "Hello everyone!",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "messageType": "text"
}
```

**Frontend Handler:**
```javascript
handleNewGroupMessage(messageData) {
  console.log('👥 New group message:', messageData);
  
  this.dispatch({
    type: 'GROUP_CHAT_ADD_MESSAGE',
    payload: {
      groupId: messageData.groupId,
      message: {
        id: messageData.id,
        senderId: messageData.senderId,
        senderName: messageData.senderName,
        content: messageData.content,
        createdAt: new Date(messageData.createdAt),
        messageType: messageData.messageType
      }
    }
  });

  // Update group unread count
  this.unreadManager.incrementGroupUnreadCount(messageData.groupId);
  
  // Show notification if not in group
  if (!this.isInGroupChat(messageData.groupId)) {
    this.showGroupMessageNotification(messageData);
  }
}
```

#### 3.3.2 Group Chat Loaded Event
**Event:** `groupChatLoaded`
**Triggered when:** You join a group chat

**Response Structure:**
```json
{
  "groupId": "99999",
  "group": {
    "id": "99999",
    "name": "Team Chat",
    "description": "General team discussion",
    "admin": {
      "id": 111,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "avatar": "avatar1.jpg"
    },
    "participants": [
      {
        "id": 111,
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "avatar1.jpg",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:30:00.000Z"
      }
    ]
  },
  "messages": [
    {
      "id": 12345,
      "senderId": 111,
      "senderName": "John Doe",
      "content": "Hello everyone!",
      "createdAt": "2024-01-15T10:25:00.000Z"
    }
  ]
}
```

### 3.4 Status and Notification Responses

#### 3.4.1 User Status Changed Event
**Event:** `userStatusChanged`
**Triggered when:** User's online status changes

**Response Structure:**
```json
{
  "userId": 222,
  "isOnline": true,
  "lastSeen": "2024-01-15T10:30:00.000Z",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 3.4.2 New Message Notification Event
**Event:** `newMessageNotification`
**Triggered when:** You receive a message notification (when not in conversation)

**Response Structure:**
```json
{
  "conversationId": "67890",
  "senderId": 111,
  "senderName": "John Doe",
  "content": "Hello, how are you?",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Unread Count System

### 4.1 How It Works
The unread count system automatically tracks unread messages for each user in each conversation:

1. **Backend Calculation**: Server calculates unread counts for each participant
2. **Real-time Updates**: Counts update when messages are sent/read
3. **Persistent Storage**: Counts stored in database and synced across devices

### 4.2 Frontend Implementation
```javascript
class UnreadCountManager {
  constructor() {
    this.unreadCounts = new Map(); // conversationId -> count
    this.groupUnreadCounts = new Map(); // groupId -> count
    this.totalUnreadCount = 0;
  }

  // Update conversation unread count
  updateUnreadCount(conversationId, increment = 0) {
    const currentCount = this.unreadCounts.get(conversationId) || 0;
    const newCount = Math.max(0, currentCount + increment);
    
    this.unreadCounts.set(conversationId, newCount);
    this.updateTotalUnreadCount();
    this.updateUI(conversationId, newCount);
  }

  // Update group unread count
  updateGroupUnreadCount(groupId, increment = 0) {
    const currentCount = this.groupUnreadCounts.get(groupId) || 0;
    const newCount = Math.max(0, currentCount + increment);
    
    this.groupUnreadCounts.set(groupId, newCount);
    this.updateTotalUnreadCount();
    this.updateGroupUI(groupId, newCount);
  }

  // Mark conversation as read
  markConversationAsRead(conversationId) {
    this.unreadCounts.set(conversationId, 0);
    this.updateTotalUnreadCount();
    this.updateUI(conversationId, 0);
  }

  // Mark group as read
  markGroupAsRead(groupId) {
    this.groupUnreadCounts.set(groupId, 0);
    this.updateTotalUnreadCount();
    this.updateGroupUI(groupId, 0);
  }

  // Update total unread count
  updateTotalUnreadCount() {
    const conversationTotal = Array.from(this.unreadCounts.values())
      .reduce((sum, count) => sum + count, 0);
    const groupTotal = Array.from(this.groupUnreadCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    this.totalUnreadCount = conversationTotal + groupTotal;
    this.updateMainBadge();
  }

  // Update UI badges
  updateUI(conversationId, count) {
    const badge = document.querySelector(`[data-conversation-id="${conversationId}"] .unread-badge`);
    if (badge) {
      badge.textContent = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'block' : 'none';
    }
  }

  updateGroupUI(groupId, count) {
    const badge = document.querySelector(`[data-group-id="${groupId}"] .unread-badge`);
    if (badge) {
      badge.textContent = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'block' : 'none';
    }
  }

  updateMainBadge() {
    const mainBadge = document.querySelector('.main-unread-badge');
    if (mainBadge) {
      mainBadge.textContent = this.totalUnreadCount > 0 ? this.totalUnreadCount : '';
      mainBadge.style.display = this.totalUnreadCount > 0 ? 'block' : 'none';
    }
  }
}
```

---

## Error Handling

### 5.1 Socket Error Events
**Event:** `error`
**Response Structure:**
```json
{
  "message": "Error description"
}
```

**Common Error Messages:**
- `"Authentication failed"` - Invalid/expired token
- `"Conversation ID is required"` - Missing required parameter
- `"Not a participant in this conversation"` - Access denied
- `"Users not in same organization"` - Organization mismatch
- `"Failed to send message"` - General failure

### 5.2 Frontend Error Handler
```javascript
handleError(error) {
  console.error('🔴 Socket error:', error);
  
  switch (error.message) {
    case 'Authentication failed':
      this.handleAuthError();
      break;
    case 'Not a participant in this conversation':
      this.handleAccessDenied();
      break;
    case 'Users not in same organization':
      this.handleOrganizationMismatch();
      break;
    default:
      this.handleGenericError(error);
  }
}

handleAuthError() {
  // Redirect to login
  this.dispatch({ type: 'AUTH_TOKEN_EXPIRED' });
  this.redirectToLogin();
}

handleAccessDenied() {
  this.dispatch({ 
    type: 'SHOW_ERROR', 
    payload: { message: 'You do not have access to this conversation' }
  });
}

handleOrganizationMismatch() {
  this.dispatch({ 
    type: 'SHOW_ERROR', 
    payload: { message: 'Users must be in the same organization' }
  });
}
```

---

## Performance Optimization

### 6.1 Debounced Typing Indicators
```javascript
import { debounce } from 'lodash';

class TypingManager {
  constructor() {
    this.typingTimeouts = new Map();
    this.debouncedTyping = debounce(this.sendTypingIndicator.bind(this), 300);
  }

  startTyping(conversationId) {
    this.debouncedTyping(conversationId, true);
    
    // Clear existing timeout
    if (this.typingTimeouts.has(conversationId)) {
      clearTimeout(this.typingTimeouts.get(conversationId));
    }
    
    // Set timeout to stop typing
    const timeout = setTimeout(() => {
      this.stopTyping(conversationId);
    }, 2000);
    
    this.typingTimeouts.set(conversationId, timeout);
  }

  stopTyping(conversationId) {
    this.sendTypingIndicator(conversationId, false);
    this.typingTimeouts.delete(conversationId);
  }

  sendTypingIndicator(conversationId, isTyping) {
    this.socket.emit('typing', { conversationId, isTyping });
  }
}
```

### 6.2 Batched Unread Updates
```javascript
class BatchedUnreadUpdater {
  constructor() {
    this.pendingUpdates = new Map();
    this.updateTimeout = null;
    this.batchDelay = 100;
  }

  scheduleUpdate(conversationId, increment) {
    const current = this.pendingUpdates.get(conversationId) || 0;
    this.pendingUpdates.set(conversationId, current + increment);
    
    if (!this.updateTimeout) {
      this.updateTimeout = setTimeout(() => {
        this.processUpdates();
      }, this.batchDelay);
    }
  }

  processUpdates() {
    this.pendingUpdates.forEach((increment, conversationId) => {
      this.unreadManager.updateUnreadCount(conversationId, increment);
    });
    
    this.pendingUpdates.clear();
    this.updateTimeout = null;
  }
}
```

---

## Testing Checklist

### 7.1 Connection Testing
- [ ] Socket connects with valid token
- [ ] Socket rejects invalid token
- [ ] Auto-reconnection works
- [ ] Connection errors are handled

### 7.2 Chat Functionality Testing
- [ ] Send message works
- [ ] Receive message works
- [ ] Message delivery confirmation
- [ ] Typing indicators work
- [ ] Messages marked as read

### 7.3 Group Chat Testing
- [ ] Join group chat
- [ ] Send group message
- [ ] Receive group message
- [ ] Group typing indicators

### 7.4 Unread Count Testing
- [ ] Unread count increments on new message
- [ ] Unread count resets when conversation opened
- [ ] Total unread count updates correctly
- [ ] Unread badges display correctly

### 7.5 Error Handling Testing
- [ ] Authentication errors handled
- [ ] Access denied errors handled
- [ ] Network errors handled
- [ ] Invalid data errors handled

### 7.6 Performance Testing
- [ ] Typing indicators debounced
- [ ] Unread updates batched
- [ ] Memory leaks prevented
- [ ] Smooth scrolling with many messages

---

## Implementation Priority

### Phase 1 (Week 1): Core Connection
- [ ] Socket connection setup
- [ ] Basic event listeners
- [ ] Error handling
- [ ] Connection status management

### Phase 2 (Week 2): Basic Chat
- [ ] Send/receive messages
- [ ] Join conversations
- [ ] Basic UI integration
- [ ] Message display

### Phase 3 (Week 3): Advanced Features
- [ ] Typing indicators
- [ ] Message read status
- [ ] Unread count system
- [ ] Notifications

### Phase 4 (Week 4): Group Chat
- [ ] Group chat functionality
- [ ] Group message handling
- [ ] Group typing indicators
- [ ] Group unread counts

### Phase 5 (Week 5): Polish & Testing
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Comprehensive testing
- [ ] Documentation

---

## Notes for Frontend Team

1. **Always handle errors gracefully** - Never let socket errors crash the app
2. **Implement proper loading states** - Show loading indicators during socket operations
3. **Use Redux/state management** - Keep socket state synchronized with app state
4. **Implement offline handling** - Queue messages when offline, sync when reconnected
5. **Test on different networks** - Ensure reliability on slow/unstable connections
6. **Monitor performance** - Watch for memory leaks and excessive re-renders
7. **Follow security best practices** - Validate all incoming data, never trust client input

---

## Support & Resources

- **Backend Team Contact**: [Your Contact Info]
- **API Documentation**: [Link to your API docs]
- **Socket.IO Documentation**: https://socket.io/docs/
- **Testing Tools**: Jest, React Testing Library
- **Performance Monitoring**: React DevTools, Chrome DevTools

---

*Last Updated: [Current Date]*
*Version: 1.0*
*Maintained by: [Your Name/Team]*

