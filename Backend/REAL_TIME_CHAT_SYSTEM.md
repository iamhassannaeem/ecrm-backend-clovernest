# Real-Time Chat System - WhatsApp-like Features

## Overview

The Telecom Sales CRM now features a complete WhatsApp-like real-time chatting system with persistent messages, enhanced notifications, and comprehensive real-time features. Messages are no longer deleted on session end and the system provides a complete messaging experience.

## Key Features

### 🚀 Real-Time Messaging
- **Persistent Messages**: All messages are stored permanently in the database
- **Real-Time Delivery**: Instant message delivery using Socket.IO
- **Read Receipts**: Track when messages are read by recipients
- **Typing Indicators**: Show when users are typing
- **Online Status**: Real-time online/offline status updates
- **Message Deletion**: Users can delete their own messages (soft delete)

### 📱 Enhanced Notifications
- **Push Notifications**: Real-time notifications for new messages
- **Lead Notifications**: Notifications for lead assignments and status changes
- **Unread Counts**: Track unread messages per conversation
- **Notification Management**: Mark as read, delete, and manage notifications

### 💬 Chat Features
- **Conversation Management**: Create and manage conversations between users
- **Message History**: Load message history with pagination
- **Organization-Based**: Users can only chat within their organization
- **Message Types**: Support for different message types (text, etc.)
- **Conversation List**: View all conversations with unread counts

## Database Schema

### ChatSession
```sql
- id: Primary key
- organizationId: Organization the chat belongs to
- isActive: Whether the conversation is active
- lastMessageAt: Timestamp of last message
- unreadCount: JSON object storing unread counts per user
- createdAt, updatedAt: Timestamps
```

### Message
```sql
- id: Primary key
- chatSessionId: Reference to chat session
- senderId: User who sent the message
- content: Message content
- isRead: Whether message has been read
- readAt: When message was read
- organizationId: Organization context
- createdAt, updatedAt: Timestamps
```

### ChatParticipant
```sql
- id: Primary key
- userId: User in the conversation
- chatSessionId: Reference to chat session
- organizationId: Organization context
- Unique constraint on (userId, chatSessionId)
```

## Socket.IO Events

### Client to Server Events

#### `joinOrganization`
Join organization room for status broadcasts
```javascript
socket.emit('joinOrganization', { organizationId: 123 });
```

#### `getOrCreateConversation`
Get or create a conversation with another user
```javascript
socket.emit('getOrCreateConversation', { targetUserId: 456 });
```

#### `sendMessage`
Send a message in a conversation
```javascript
socket.emit('sendMessage', {
  conversationId: 789,
  content: "Hello!",
  messageType: "text"
});
```

#### `markMessagesAsRead`
Mark messages as read in a conversation
```javascript
socket.emit('markMessagesAsRead', { conversationId: 789 });
```

#### `typing`
Send typing indicator
```javascript
socket.emit('typing', { conversationId: 789, isTyping: true });
```

#### `getConversations`
Get list of user's conversations
```javascript
socket.emit('getConversations');
```

#### `getMessages`
Get messages for a conversation with pagination
```javascript
socket.emit('getMessages', {
  conversationId: 789,
  page: 1,
  limit: 50
});
```

#### `deleteMessage`
Delete a message (only sender can delete)
```javascript
socket.emit('deleteMessage', { messageId: 123 });
```

### Server to Client Events

#### `conversationLoaded`
Conversation data loaded
```javascript
socket.on('conversationLoaded', (data) => {
  // data.conversationId
  // data.participants[]
  // data.messages[]
  // data.unreadCount
});
```

#### `newMessage`
New message received
```javascript
socket.on('newMessage', (message) => {
  // message.id, message.content, message.senderId, etc.
});
```

#### `messageDelivered`
Message delivery confirmation
```javascript
socket.on('messageDelivered', (data) => {
  // data.messageId, data.conversationId, data.timestamp
});
```

#### `messagesRead`
Messages marked as read
```javascript
socket.on('messagesRead', (data) => {
  // data.conversationId, data.readBy, data.timestamp
});
```

#### `userTyping`
User typing indicator
```javascript
socket.on('userTyping', (data) => {
  // data.conversationId, data.userId, data.isTyping
});
```

#### `conversationsList`
List of conversations
```javascript
socket.on('conversationsList', (data) => {
  // data.conversations[]
});
```

#### `messagesLoaded`
Messages loaded with pagination
```javascript
socket.on('messagesLoaded', (data) => {
  // data.conversationId, data.messages[], data.hasMore, data.page
});
```

#### `messageDeleted`
Message deleted
```javascript
socket.on('messageDeleted', (data) => {
  // data.messageId, data.conversationId, data.timestamp
});
```

#### `userStatusChanged`
User online/offline status changed
```javascript
socket.on('userStatusChanged', (data) => {
  // data.userId, data.isOnline, data.lastSeen, data.timestamp
});
```

#### `newMessageNotification`
Push notification for new message
```javascript
socket.on('newMessageNotification', (data) => {
  // data.conversationId, data.senderId, data.senderName, data.content
});
```

## Notification System

### Notification Types
- `NEW_MESSAGE`: New chat message
- `LEAD_ASSIGNED`: Lead assigned to user
- `LEAD_STATUS_CHANGED`: Lead status updated
- `LEAD_UPDATED`: Lead information updated
- `SYSTEM_ALERT`: System notifications
- `TASK_ASSIGNED`: Task assigned to user
- `REMINDER`: Reminder notifications

### Notification Features
- **Real-time Delivery**: Instant notifications via Socket.IO
- **Persistent Storage**: All notifications stored in database
- **Read Status**: Track read/unread status
- **Soft Delete**: Mark notifications as deleted
- **Metadata Support**: Store additional data in JSON format

## API Endpoints

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/:id/read` - Mark notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notifications/unread-count` - Get unread count

### Chat
- `GET /api/chat/conversations` - Get user conversations
- `GET /api/chat/conversations/:id/messages` - Get conversation messages
- `POST /api/chat/conversations/:id/read` - Mark messages as read

## Implementation Details

### Connection Management
- Users connect with JWT token authentication
- Active connections tracked in memory
- User rooms tracked for efficient broadcasting
- Automatic cleanup on disconnect

### Message Persistence
- All messages stored in database permanently
- No session expiration or cleanup
- Message history available indefinitely
- Soft delete for message removal

### Real-Time Features
- Socket.IO for real-time communication
- Room-based broadcasting for efficiency
- Typing indicators and read receipts
- Online status tracking

### Security
- JWT token authentication required
- Organization-based access control
- User can only access conversations they're part of
- Message deletion restricted to sender

## Usage Examples

### Frontend Integration

```javascript
// Connect to Socket.IO
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Join organization
socket.emit('joinOrganization', { organizationId: 123 });

// Get conversations
socket.emit('getConversations');

// Listen for conversations list
socket.on('conversationsList', (data) => {
  console.log('Conversations:', data.conversations);
});

// Start conversation
socket.emit('getOrCreateConversation', { targetUserId: 456 });

// Send message
socket.emit('sendMessage', {
  conversationId: 789,
  content: "Hello! How are you?",
  messageType: "text"
});

// Listen for new messages
socket.on('newMessage', (message) => {
  console.log('New message:', message);
});

// Mark messages as read
socket.emit('markMessagesAsRead', { conversationId: 789 });
```

### Notification Integration

```javascript
// Listen for notifications
socket.on('newNotification', (data) => {
  console.log('New notification:', data.notification);
});

// Get notifications via API
fetch('/api/notifications')
  .then(response => response.json())
  .then(data => {
    console.log('Notifications:', data.notifications);
  });

// Mark notification as read
fetch('/api/notifications/123/read', { method: 'POST' })
  .then(response => response.json())
  .then(data => {
    console.log('Notification marked as read');
  });
```

## Performance Considerations

- **Connection Pooling**: Efficient Socket.IO connection management
- **Room-Based Broadcasting**: Only send events to relevant users
- **Pagination**: Load messages in chunks for better performance
- **Indexing**: Database indexes on frequently queried fields
- **Caching**: Consider Redis for high-traffic scenarios

## Monitoring and Logging

- All Socket.IO events logged with timestamps
- Error handling and logging for debugging
- Connection/disconnection tracking
- Performance metrics collection

## Future Enhancements

- **File Sharing**: Support for image, document, and file sharing
- **Voice Messages**: Audio message support
- **Group Chats**: Multi-user conversations
- **Message Reactions**: Like, heart, etc. reactions
- **Message Search**: Search through message history
- **Message Encryption**: End-to-end encryption
- **Push Notifications**: Mobile push notifications
- **Message Scheduling**: Schedule messages for later
- **Read Receipts**: Detailed read status per user
- **Message Editing**: Edit sent messages
- **Message Forwarding**: Forward messages to other conversations 