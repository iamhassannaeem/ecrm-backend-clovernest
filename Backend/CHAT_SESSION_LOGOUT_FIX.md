# Chat Session Logout Fix

## Problem Description

When users logged out and logged back in, they were still seeing the same chat sessions. This happened because:

1. **Chat sessions persisted in the database** - Sessions remained active even after logout
2. **Session reuse logic** - The `startSession` function would reuse existing active sessions between the same participants
3. **No session cleanup on logout** - The logout function only revoked refresh tokens but didn't end chat sessions
4. **Socket connections remained active** - Socket connections weren't properly disconnected on logout

## Root Cause

The issue was in the logout functionality in `authController.js`. The original logout function only handled refresh token revocation:

```javascript
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};
```

This meant that:
- Active chat sessions remained in the database with `isActive: true`
- Socket connections weren't disconnected
- When users logged back in, the `startSession` function would find existing active sessions and reuse them

## Solution Implemented

### 1. Enhanced Logout Function

Modified `authController.js` to properly clean up chat sessions and socket connections:

```javascript
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user?.id;
    
    // Revoke refresh token if provided
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    
    // End all active chat sessions for this user
    if (userId) {
      try {
        // Find all active chat sessions where this user is a participant
        const activeSessions = await prisma.chatSession.findMany({
          where: {
            isActive: true,
            participants: {
              some: { userId }
            }
          },
          include: { participants: true }
        });
        
        // End each active session
        for (const session of activeSessions) {
          await prisma.chatSession.update({
            where: { id: session.id },
            data: { 
              isActive: false, 
              endedAt: new Date(),
              expiresAt: new Date() // Mark as expired
            }
          });
          
          // Emit socket event to notify other participants that session has ended
          if (global.io) {
            global.io.to(`session_${session.id}`).emit('sessionEnded', {
              sessionId: session.id,
              reason: 'user_logout',
              endedBy: userId
            });
          }
        }
        
        // Disconnect user's socket connections
        if (global.io) {
          const userSockets = await global.io.in(`user_${userId}`).fetchSockets();
          userSockets.forEach(socket => {
            socket.emit('forceDisconnect', { reason: 'user_logout' });
            socket.disconnect();
          });
        }
        
        console.log(`[Logout] Ended ${activeSessions.length} active chat sessions for user ${userId}`);
      } catch (sessionError) {
        console.error('[Logout] Error ending chat sessions:', sessionError);
        // Don't fail logout if session cleanup fails
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};
```

### 2. Global Socket.IO Access

Made the socket.io instance globally available in `app.js`:

```javascript
// Make socket.io instance globally available for logout functionality
global.io = io;
```

### 3. Enhanced Session Validation

Updated `chatController.js` to check for both expired and inactive sessions:

```javascript
// In startSession function
if (session && (isSessionExpired(session) || !session.isActive)) {
  // End the session and create a new one
}

// In getMessages and sendMessage functions
if (isSessionExpired(session) || !session.isActive) {
  return res.status(410).json({ 
    error: 'Chat session has expired or ended',
    code: 'SESSION_EXPIRED'
  });
}
```

### 4. Socket Event Handling

Added new socket events in `socket.js` to handle session ending and force disconnect:

```javascript
// Handle session ended event (when another user logs out)
socket.on('sessionEnded', (data) => {
  console.log(`[Socket.IO] Session ended: ${data.sessionId}, reason: ${data.reason}`);
  socket.emit('sessionEnded', data);
});

// Handle force disconnect (when user logs out)
socket.on('forceDisconnect', (data) => {
  console.log(`[Socket.IO] Force disconnect for user ${userId}: ${data.reason}`);
  socket.emit('forceDisconnect', data);
  socket.disconnect();
});
```

## Testing

Created a test script `test-logout-chat-sessions.js` that verifies:

1. Users can start a chat session
2. Session remains active during normal usage
3. Logout properly ends the session
4. New sessions are created after logout
5. Old sessions are no longer accessible

## Benefits

- **Proper session cleanup**: Chat sessions are properly ended when users logout
- **Fresh sessions**: New chat sessions are created after logout instead of reusing old ones
- **Socket cleanup**: Socket connections are properly disconnected
- **Real-time notifications**: Other participants are notified when a user logs out
- **Better security**: Prevents session hijacking and ensures clean state

## Files Modified

1. `Backend/src/controllers/authController.js` - Enhanced logout function
2. `Backend/src/app.js` - Made socket.io globally available
3. `Backend/src/controllers/chatController.js` - Enhanced session validation
4. `Backend/src/socket.js` - Added new socket event handlers
5. `Backend/test-logout-chat-sessions.js` - Test script for verification

## Usage

After implementing this fix:

1. When a user logs out, all their active chat sessions are automatically ended
2. Socket connections are properly disconnected
3. Other participants in the chat are notified that the session has ended
4. When the user logs back in, new chat sessions will be created instead of reusing old ones
5. Old sessions are no longer accessible and will return a 410 status code 