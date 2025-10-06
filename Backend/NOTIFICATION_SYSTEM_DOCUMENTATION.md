# Notification System Documentation

## Overview

The notification system provides real-time notifications for various events in the CRM system, including lead assignments and chat messages. It includes both database storage and real-time socket.io notifications.

## Database Schema

### Notification Model

```prisma
model Notification {
  id              Int               @id @default(autoincrement())
  type            NotificationType
  title           String
  message         String
  isRead          Boolean           @default(false)
  isDeleted       Boolean           @default(false)
  metadata        Json?             // Store additional data like leadId, chatSessionId, etc.
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  recipientId     Int
  recipient       User              @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  organizationId  Int
  organization    Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@map("notifications")
}

enum NotificationType {
  LEAD_ASSIGNED
  LEAD_UPDATED
  LEAD_STATUS_CHANGED
  NEW_MESSAGE
  MESSAGE_READ
  SYSTEM_ALERT
  TASK_ASSIGNED
  REMINDER
}
```

## API Endpoints

### Base URL: `/api/notifications`

All endpoints require authentication via Bearer token.

### 1. Get User Notifications

**GET** `/api/notifications`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `unreadOnly` (optional): Filter unread only (default: false)

**Response:**
```json
{
  "notifications": [
    {
      "id": 1,
      "type": "LEAD_ASSIGNED",
      "title": "New Lead Assigned",
      "message": "John Smith has assigned you a new lead: John Doe",
      "isRead": false,
      "isDeleted": false,
      "metadata": {
        "leadId": 123,
        "leadName": "John Doe",
        "assignedById": 456,
        "assignedBy": "John Smith",
        "action": "view_lead"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "recipient": {
        "id": 789,
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane@example.com",
        "avatar": "avatar.jpg"
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

### 2. Get Unread Count

**GET** `/api/notifications/unread-count`

**Response:**
```json
{
  "success": true,
  "unreadCount": 5
}
```

### 3. Mark Notification as Read

**PATCH** `/api/notifications/:id/read`

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### 4. Mark All Notifications as Read

**PATCH** `/api/notifications/mark-all-read`

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

### 5. Delete Notification

**DELETE** `/api/notifications/:id`

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

### 6. Mark Chat Messages as Read

**PATCH** `/api/notifications/chat/:sessionId/read`

**Response:**
```json
{
  "success": true,
  "message": "Chat messages marked as read"
}
```

## Real-time Notifications

### Socket.IO Events

The system emits real-time notifications via Socket.IO when new notifications are created.

**Event:** `newNotification`

**Data:**
```json
{
  "notification": {
    "id": 1,
    "type": "NEW_MESSAGE",
    "title": "New Message",
    "message": "John Smith sent you a message",
    "createdAt": "2024-01-15T10:30:00Z",
    "metadata": {
      "senderId": 456,
      "senderName": "John Smith",
      "sessionId": 789,
      "messagePreview": "Hello! How are you doing?",
      "action": "open_chat"
    }
  }
}
```

## Notification Types and Metadata

### 1. Lead Assignment Notifications

**Type:** `LEAD_ASSIGNED`

**Metadata:**
```json
{
  "leadId": 123,
  "leadName": "John Doe",
  "assignedById": 456,
  "assignedBy": "John Smith",
  "action": "view_lead"
}
```

**Usage:** When a lead is assigned to a user, a notification is automatically created.

### 2. Chat Message Notifications

**Type:** `NEW_MESSAGE`

**Metadata:**
```json
{
  "senderId": 456,
  "senderName": "John Smith",
  "sessionId": 789,
  "messagePreview": "Hello! How are you doing?",
  "action": "open_chat"
}
```

**Usage:** When a user receives a chat message, a notification is automatically created.

## Frontend Integration

### 1. Connect to Socket.IO

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: localStorage.getItem('accessToken')
  }
});

// Listen for new notifications
socket.on('newNotification', (data) => {
  const { notification } = data;
  console.log('New notification:', notification);
  
  // Update notification count
  updateNotificationCount();
  
  // Show notification toast
  showNotificationToast(notification);
});
```

### 2. Handle Notification Clicks

```javascript
function handleNotificationClick(notification) {
  const { type, metadata } = notification;
  
  switch (type) {
    case 'LEAD_ASSIGNED':
      if (metadata.action === 'view_lead') {
        // Navigate to lead details
        navigate(`/leads/${metadata.leadId}`);
      }
      break;
      
    case 'NEW_MESSAGE':
      if (metadata.action === 'open_chat') {
        // Open chat session
        openChatSession(metadata.sessionId);
      }
      break;
  }
  
  // Mark notification as read
  markNotificationAsRead(notification.id);
}
```

### 3. Notification Component Example

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function NotificationDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);
  
  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };
  
  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  return (
    <div className="notification-dropdown">
      <div className="notification-header">
        <h3>Notifications</h3>
        <span className="unread-badge">{unreadCount}</span>
      </div>
      
      <div className="notification-list">
        {notifications.map(notification => (
          <div 
            key={notification.id} 
            className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="notification-title">{notification.title}</div>
            <div className="notification-message">{notification.message}</div>
            <div className="notification-time">
              {new Date(notification.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Automatic Notification Creation

### 1. Lead Assignment Notifications

Notifications are automatically created when:
- A lead is created and assigned to a user
- A lead is reassigned to a different user

**Location:** `leadsController.js` - `createLead` function

```javascript
// Create notification if lead is assigned to someone
if (data.assignedToId && data.assignedToId !== req.user.id) {
  try {
    await createLeadAssignmentNotification(
      lead.id,
      data.assignedToId,
      req.user.id,
      req.user.organizationId
    );
  } catch (notificationError) {
    console.error('Error creating lead assignment notification:', notificationError);
  }
}
```

### 2. Chat Message Notifications

Notifications are automatically created when:
- A message is sent via REST API
- A message is sent via Socket.IO

**Location:** 
- `chatController.js` - `sendMessage` function
- `socket.js` - `sendMessage` event handler

```javascript
// Create notification for other participants in the session
const otherParticipants = session.participants.filter(p => p.userId !== userId);
for (const participant of otherParticipants) {
  await createChatMessageNotification(
    userId,
    participant.userId,
    sessionId,
    content,
    session.organizationId
  );
}
```

## Testing

### Run the Test Script

```bash
cd Backend
node test-notifications.js
```

The test script will:
1. Create test users and authenticate them
2. Create a lead and assign it to a user
3. Verify lead assignment notification is created
4. Start a chat session and send a message
5. Verify chat message notification is created
6. Test notification marking as read
7. Test unread count functionality

## Configuration

### Environment Variables

No additional environment variables are required for the notification system.

### Database Migration

After adding the notification models to the schema, run:

```bash
npx prisma migrate dev --name add_notifications
npx prisma generate
```

## Best Practices

1. **Error Handling:** Notification creation errors should not fail the main operation
2. **Performance:** Use pagination for notification lists
3. **Real-time Updates:** Use Socket.IO for immediate notification delivery
4. **Metadata:** Store relevant data in metadata for navigation
5. **Cleanup:** Implement notification cleanup for old/deleted notifications

## Troubleshooting

### Common Issues

1. **Notifications not appearing:**
   - Check if Socket.IO connection is established
   - Verify user authentication
   - Check database connection

2. **Real-time notifications not working:**
   - Ensure Socket.IO is properly configured
   - Check if `global.io` is available
   - Verify socket authentication

3. **Notification clicks not working:**
   - Check metadata structure
   - Verify frontend navigation logic
   - Ensure proper error handling

### Debug Logs

The system includes comprehensive logging for debugging:

```javascript
console.log('[Notification] Creating lead assignment notification:', {
  leadId,
  assignedToId,
  assignedById,
  organizationId
});
```

## Future Enhancements

1. **Email Notifications:** Send email notifications for important events
2. **Push Notifications:** Implement browser push notifications
3. **Notification Preferences:** Allow users to configure notification settings
4. **Bulk Operations:** Support bulk marking notifications as read
5. **Notification Templates:** Create customizable notification templates 