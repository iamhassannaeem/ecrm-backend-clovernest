# WhatsApp-like Chat API Documentation

## Overview
This API provides a complete WhatsApp-like real-time messaging system with persistent conversations, online/offline status, and push notifications.

## Authentication
All API endpoints require authentication using JWT tokens in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Socket.IO Events

### Connection
Connect to Socket.IO with authentication:
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Socket Events

#### Client to Server Events

1. **joinOrganization**
   - Join organization room for status broadcasts
   ```javascript
   socket.emit('joinOrganization', organizationId);
   ```

2. **getOrCreateConversation**
   - Get or create conversation with another user
   ```javascript
   socket.emit('getOrCreateConversation', { targetUserId: 123 });
   ```

3. **sendMessage**
   - Send a message in a conversation
   ```javascript
   socket.emit('sendMessage', { 
     conversationId: 456, 
     content: 'Hello world!' 
   });
   ```

4. **markMessagesAsRead**
   - Mark messages as read in a conversation
   ```javascript
   socket.emit('markMessagesAsRead', { conversationId: 456 });
   ```

5. **typing**
   - Send typing indicator
   ```javascript
   socket.emit('typing', { 
     conversationId: 456, 
     isTyping: true 
   });
   ```

6. **getConversations**
   - Get user's conversations list
   ```javascript
   socket.emit('getConversations');
   ```

#### Server to Client Events

1. **conversationLoaded**
   - Emitted when conversation is loaded
   ```javascript
   socket.on('conversationLoaded', (data) => {
     console.log('Conversation loaded:', data);
     // data: {
     //   conversationId: 456,
     //   participants: [...],
     //   messages: [...]
     // }
   });
   ```

2. **newMessage**
   - Emitted when new message is received
   ```javascript
   socket.on('newMessage', (message) => {
     console.log('New message:', message);
     // message: {
     //   id: 789,
     //   conversationId: 456,
     //   senderId: 123,
     //   senderName: 'John Doe',
     //   content: 'Hello!',
     //   createdAt: '2024-01-01T00:00:00Z',
     //   isRead: false
     // }
   });
   ```

3. **messageDelivered**
   - Emitted when message is delivered
   ```javascript
   socket.on('messageDelivered', (data) => {
     console.log('Message delivered:', data);
   });
   ```

4. **messagesRead**
   - Emitted when messages are read by other user
   ```javascript
   socket.on('messagesRead', (data) => {
     console.log('Messages read:', data);
   });
   ```

5. **userTyping**
   - Emitted when user is typing
   ```javascript
   socket.on('userTyping', (data) => {
     console.log('User typing:', data);
   });
   ```

6. **conversationsList**
   - Emitted when conversations list is loaded
   ```javascript
   socket.on('conversationsList', (data) => {
     console.log('Conversations list:', data);
   });
   ```

7. **userStatusChanged**
   - Emitted when user online status changes
   ```javascript
   socket.on('userStatusChanged', (data) => {
     console.log('User status changed:', data);
   });
   ```

8. **newNotification**
   - Emitted when new notification is received
   ```javascript
   socket.on('newNotification', (data) => {
     console.log('New notification:', data);
   });
   ```

9. **error**
   - Emitted when error occurs
   ```javascript
   socket.on('error', (error) => {
     console.error('Socket error:', error);
   });
   ```

## REST API Endpoints

### Contacts

#### GET /api/chat/contacts
Get all contacts in the organization.

**Response:**
```json
{
  "teamLeads": [
    {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "avatar-url",
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00Z"
    }
  ],
  "agents": [
    {
      "id": 456,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "avatar": "avatar-url",
      "isOnline": false,
      "lastSeen": "2024-01-01T00:00:00Z"
    }
  ],
  "permissions": {
    "canChatWithAgents": true,
    "canChatWithTeamLeads": true,
    "canChatWithAll": true,
    "hasDefaultTeamLeadAccess": true,
    "isAgent": false,
    "isTeamLead": true
  }
}
```

### Conversations

#### POST /api/chat/conversations
Get or create conversation between two users.

**Request Body:**
```json
{
  "targetUserId": 123
}
```

**Response:**
```json
{
  "conversationId": 456,
  "participants": [
    {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com",
      "avatar": "avatar-url",
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/chat/conversations
Get user's conversations list.

**Response:**
```json
{
  "conversations": [
    {
      "id": 456,
      "otherUser": {
        "id": 123,
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": "avatar-url",
        "isOnline": true,
        "lastSeen": "2024-01-01T00:00:00Z"
      },
      "lastMessage": {
        "id": 789,
        "content": "Hello!",
        "senderId": 123,
        "senderName": "John Doe",
        "createdAt": "2024-01-01T00:00:00Z",
        "isRead": false
      },
      "lastMessageAt": "2024-01-01T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Messages

#### GET /api/chat/conversations/:conversationId/messages
Get messages for a conversation with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50)

**Response:**
```json
{
  "messages": [
    {
      "id": 789,
      "senderId": 123,
      "senderName": "John Doe",
      "content": "Hello!",
      "createdAt": "2024-01-01T00:00:00Z",
      "isRead": true,
      "readAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 250,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### POST /api/chat/conversations/:conversationId/messages
Send a message in a conversation.

**Request Body:**
```json
{
  "content": "Hello world!"
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": 789,
    "conversationId": 456,
    "senderId": 123,
    "senderName": "John Doe",
    "content": "Hello world!",
    "createdAt": "2024-01-01T00:00:00Z",
    "isRead": false
  }
}
```

#### PATCH /api/chat/conversations/:conversationId/read
Mark messages as read in a conversation.

**Response:**
```json
{
  "success": true
}
```

### Online Status

#### GET /api/chat/online-status
Get online status of all users in organization.

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 123,
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "avatar-url",
      "isOnline": true,
      "lastSeen": "2024-01-01T00:00:00Z",
      "onlineStatusUpdatedAt": "2024-01-01T00:00:00Z",
      "fullName": "John Doe",
      "status": "online"
    }
  ]
}
```

#### GET /api/chat/online-status/:userId
Get specific user's online status.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "avatar-url",
    "isOnline": true,
    "lastSeen": "2024-01-01T00:00:00Z",
    "onlineStatusUpdatedAt": "2024-01-01T00:00:00Z",
    "fullName": "John Doe",
    "status": "online"
  }
}
```

### Notifications

#### GET /api/notifications
Get all notifications for the current user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Notifications per page (default: 20)
- `unreadOnly` (optional): Only unread notifications (default: false)

**Response:**
```json
{
  "notifications": [
    {
      "id": 123,
      "type": "NEW_MESSAGE",
      "title": "New Message",
      "message": "John Doe sent you a message",
      "isRead": false,
      "isDeleted": false,
      "metadata": {
        "senderId": 456,
        "senderName": "John Doe",
        "conversationId": 789,
        "messagePreview": "Hello!",
        "action": "open_chat"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "recipient": {
        "id": 123,
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane@example.com",
        "avatar": "avatar-url"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 100,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### GET /api/notifications/unread-count
Get unread notification count.

**Response:**
```json
{
  "success": true,
  "unreadCount": 5
}
```

#### PATCH /api/notifications/:id/read
Mark notification as read.

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

#### PATCH /api/notifications/mark-all-read
Mark all notifications as read.

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

#### DELETE /api/notifications/:id
Delete notification.

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

#### PATCH /api/notifications/chat/:conversationId/read
Mark chat messages as read for a conversation.

**Response:**
```json
{
  "success": true,
  "message": "Chat messages marked as read"
}
```

## Frontend Integration Example

```javascript
// Connect to Socket.IO
const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('jwt-token')
  }
});

// Listen for new messages
socket.on('newMessage', (message) => {
  // Add message to UI
  addMessageToChat(message);
  
  // Show notification if not focused
  if (!document.hasFocus()) {
    showNotification(message);
  }
});

// Listen for user status changes
socket.on('userStatusChanged', (data) => {
  updateUserStatus(data.userId, data.isOnline);
});

// Send message
function sendMessage(conversationId, content) {
  socket.emit('sendMessage', { conversationId, content });
}

// Load conversation
function loadConversation(targetUserId) {
  socket.emit('getOrCreateConversation', { targetUserId });
}

// Mark messages as read
function markAsRead(conversationId) {
  socket.emit('markMessagesAsRead', { conversationId });
}

// REST API calls
async function getContacts() {
  const response = await fetch('/api/chat/contacts', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('jwt-token')}`
    }
  });
  return response.json();
}

async function getConversations() {
  const response = await fetch('/api/chat/conversations', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('jwt-token')}`
    }
  });
  return response.json();
}

async function sendMessageAPI(conversationId, content) {
  const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('jwt-token')}`
    },
    body: JSON.stringify({ content })
  });
  return response.json();
}
```

## Features

### Real-time Messaging
- Instant message delivery via Socket.IO
- Message read receipts
- Typing indicators
- Online/offline status

### Persistent Conversations
- Messages stored permanently in database
- Conversation history preserved
- No session expiration

### Offline Support
- Messages saved when recipient is offline
- Push notifications for offline users
- Messages delivered when user comes online

### Notifications
- Real-time push notifications
- In-app notification system
- Mark as read functionality

### Security
- JWT authentication
- Organization-based access control
- Permission-based chat restrictions

### Performance
- Pagination for messages
- Efficient database queries
- Real-time status updates 