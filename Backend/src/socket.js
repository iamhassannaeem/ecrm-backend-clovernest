const jwt = require('jsonwebtoken');
const { prisma } = require('./config/database');
const { createChatMessageNotification } = require('./controllers/notificationController');
const { getUserPermissions } = require('./utils/audit');

function userMayDeleteOwnDirectMessage(permissions) {
  if (!Array.isArray(permissions)) return false;
  if (permissions.some((p) => p.action === 'ALL' && p.resource === 'ALL')) return true;
  return permissions.some((p) => p.action === 'DELETE' && p.resource === 'ONE_TO_ONE_CHAT_MESSAGE');
}

function userMayDeleteOwnGroupMessage(permissions) {
  if (!Array.isArray(permissions)) return false;
  if (permissions.some((p) => p.action === 'ALL' && p.resource === 'ALL')) return true;
  return permissions.some((p) => p.action === 'DELETE' && p.resource === 'GROUP_CHAT_MESSAGE');
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (e) {
    return null;
  }
}


const activeConnections = new Map(); 
const userRooms = new Map(); 

// Periodic cleanup for stale online statuses
const cleanupStaleStatuses = async () => {
  try {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const staleUsers = await prisma.user.findMany({
      where: {
        isOnline: true,
        onlineStatusUpdatedAt: {
          lt: staleThreshold
        }
      },
      select: { id: true, organizationId: true }
    });

    if (staleUsers.length > 0) {
      console.log(`[Socket.IO] Cleaning up ${staleUsers.length} stale online statuses`);
      
      // Update stale users to offline
      await prisma.user.updateMany({
        where: {
          id: { in: staleUsers.map(u => u.id) }
        },
        data: {
          isOnline: false,
          lastSeen: new Date()
        }
      });

      // Notify organization members about status changes
      const orgGroups = {};
      staleUsers.forEach(user => {
        if (user.organizationId) {
          if (!orgGroups[user.organizationId]) {
            orgGroups[user.organizationId] = [];
          }
          orgGroups[user.organizationId].push(user.id);
        }
      });

      Object.entries(orgGroups).forEach(([orgId, userIds]) => {
        io.to(`org_${orgId}`).emit('userStatusChanged', {
          userIds,
          isOnline: false,
          lastSeen: new Date(),
          timestamp: new Date(),
          reason: 'stale_cleanup'
        });
      });
    }
  } catch (error) {
    console.error('[Socket.IO] Error cleaning up stale statuses:', error);
  }
};

// Run cleanup every 2 minutes
setInterval(cleanupStaleStatuses, 2 * 60 * 1000);

module.exports = function(io) {
  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    const userId = verifyToken(token);
    if (!userId) {
      socket.emit('error', 'Authentication failed');
      socket.disconnect();
      return;
    }
    
    socket.userId = userId;
    socket.join(`user_${userId}`);
    
    activeConnections.set(userId, socket);
    userRooms.set(userId, new Set([`user_${userId}`]));
    
    console.log(`[Socket.IO] User connected: userId=${userId}, socketId=${socket.id}`);

    
    const updateOnlineStatus = async (isOnline) => {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            isOnline,
            lastSeen: new Date(),
            onlineStatusUpdatedAt: new Date()
          }
        });

        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true }
        });

        if (user?.organizationId) {
          io.to(`org_${user.organizationId}`).emit('userStatusChanged', {
            userId,
            isOnline,
            lastSeen: new Date(),
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('[Socket.IO] Error updating online status:', error);
      }
    };

    // Get user's organization and join the organization room
    const joinUserOrganization = async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true }
        });

        if (user?.organizationId) {
          socket.join(`org_${user.organizationId}`);
          userRooms.get(userId)?.add(`org_${user.organizationId}`);
          console.log(`[Socket.IO] User ${userId} auto-joined org_${user.organizationId}`);
        }
      } catch (error) {
        console.error('[Socket.IO] Error joining organization:', error);
      }
    };

    // Join organization and update online status
    joinUserOrganization();
    updateOnlineStatus(true);
    
    // Set up heartbeat to keep status fresh
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        updateOnlineStatus(true);
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 60000); // Update every minute
    
    // Store heartbeat interval for cleanup
    socket.heartbeatInterval = heartbeatInterval;

    
    socket.on('joinOrganization', async (organizationId) => {
      socket.join(`org_${organizationId}`);
      userRooms.get(userId)?.add(`org_${organizationId}`);
      console.log(`[Socket.IO] User ${userId} joined org_${organizationId}`);
    });

    // Join all group rooms the user may access (no message load). Required so newGroupMessage reaches
    // clients who have not opened the Group UI yet (broadcasts only go to group_<id> rooms).
    socket.on('subscribeAllGroupRooms', async () => {
      try {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            organizationId: true,
            roles: { select: { name: true } }
          }
        });

        if (!currentUser?.organizationId) {
          return;
        }

        const isOrgAdmin = currentUser.roles?.some((r) => r.name === 'ORGANIZATION_ADMIN');

        let groupIds = [];
        if (isOrgAdmin) {
          const gcs = await prisma.groupChat.findMany({
            where: {
              organizationId: currentUser.organizationId,
              isActive: true
            },
            select: { id: true }
          });
          groupIds = gcs.map((g) => g.id);
        } else {
          const parts = await prisma.groupChatParticipant.findMany({
            where: {
              userId,
              organizationId: currentUser.organizationId,
              isActive: true
            },
            select: { groupChatId: true }
          });
          groupIds = parts.map((p) => p.groupChatId);
        }

        for (const rawId of groupIds) {
          const gidStr = rawId.toString();
          socket.join(`group_${gidStr}`);
          userRooms.get(userId)?.add(`group_${gidStr}`);
        }

        console.log(
          `[Socket.IO] subscribeAllGroupRooms: user ${userId} joined ${groupIds.length} group room(s)`
        );
      } catch (error) {
        console.error('[Socket.IO] Error in subscribeAllGroupRooms:', error);
      }
    });

    // Join all 1:1 conversation rooms (no message load). Same pattern as subscribeAllGroupRooms.
    socket.on('subscribeAllConversationRooms', async () => {
      try {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true }
        });

        if (!currentUser?.organizationId) {
          return;
        }

        const participations = await prisma.chatParticipant.findMany({
          where: {
            userId,
            organizationId: currentUser.organizationId
          },
          select: { chatSessionId: true }
        });

        for (const p of participations) {
          const cid = p.chatSessionId.toString();
          socket.join(`conversation_${cid}`);
          userRooms.get(userId)?.add(`conversation_${cid}`);
        }

        console.log(
          `[Socket.IO] subscribeAllConversationRooms: user ${userId} joined ${participations.length} conversation room(s)`
        );
      } catch (error) {
        console.error('[Socket.IO] Error in subscribeAllConversationRooms:', error);
      }
    });

    
    socket.on('joinSession', async (conversationId) => {
      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        
        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { 
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    isOnline: true,
                    lastSeen: true
                  }
                }
              }
            }
          }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        
        socket.join(`conversation_${conversation.id}`);
        userRooms.get(userId)?.add(`conversation_${conversation.id}`);

        // Load only 20 recent messages for performance - client fetches more on scroll
        const messages = await prisma.message.findMany({
          where: { chatSessionId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        
        await prisma.message.updateMany({
          where: {
            chatSessionId: conversation.id,
            senderId: { not: userId },
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        
        await updateUnreadCount(conversation.id);

        socket.emit('conversationLoaded', {
          conversationId: conversation.id.toString(),
          participants: conversation.participants.map(p => ({
            id: p.user.id,
            name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
            email: p.user.email,
            avatar: p.user.avatar,
            isOnline: p.user.isOnline,
            lastSeen: p.user.lastSeen
          })),
          messages: messages.reverse().map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: `${m.sender.firstName} ${m.sender.lastName || ''}`.trim(),
            content: m.content,
            createdAt: m.createdAt,
            isRead: m.isRead,
            readAt: m.readAt,
            attachments: m.attachments.map(att => ({
              id: att.id,
              fileName: att.fileName,
              fileUrl: att.filePath,
              filePath: att.filePath,
              mimeType: att.mimeType,
              size: att.size.toString(),
              createdAt: att.createdAt
            }))
          })),
          unreadCount: 0 
        });

        
        io.to(`conversation_${conversation.id}`).emit('messagesRead', {
          conversationId: conversation.id.toString(),
          readBy: userId,
          timestamp: new Date()
        });

        console.log(`[Socket.IO] User ${userId} joined conversation ${conversation.id}`);

      } catch (error) {
        console.error('[Socket.IO] Error in joinSession:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    
    socket.on('getOrCreateConversation', async ({ targetUserId }) => {
      try {
        if (!targetUserId || targetUserId === userId) {
          socket.emit('error', { message: 'Invalid target user' });
          return;
        }

        
        const [currentUser, targetUser] = await Promise.all([
          prisma.user.findUnique({
            where: { id: userId },
            select: { 
              organizationId: true,
              roles: {
                select: { name: true }
              }
            }
          }),
          prisma.user.findUnique({
            where: { id: parseInt(targetUserId) },
            select: { organizationId: true }
          })
        ]);

        if (!currentUser || !targetUser) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        const isSuperAdmin = currentUser.roles && currentUser.roles.some(role => role.name === 'SUPER_ADMIN');
        
        if (!isSuperAdmin && currentUser.organizationId !== targetUser.organizationId) {
          socket.emit('error', { message: 'Users not in same organization' });
          return;
        }

        
        let conversation = await prisma.chatSession.findFirst({
          where: {
            isActive: true,
            organizationId: currentUser.organizationId,
            participants: {
              some: { userId }
            },
            AND: {
              participants: {
                some: { userId: parseInt(targetUserId) }
              }
            }
          },
          include: { 
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    isOnline: true,
                    lastSeen: true
                  }
                }
              }
            }
          }
        });

        if (!conversation) {
          
          conversation = await prisma.chatSession.create({
            data: {
              organizationId: currentUser.organizationId,
              participants: {
                create: [
                  { userId, organizationId: currentUser.organizationId },
                  { userId: parseInt(targetUserId), organizationId: currentUser.organizationId }
                ]
              }
            },
            include: { 
              participants: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatar: true,
                      isOnline: true,
                      lastSeen: true
                    }
                  }
                }
              }
            }
          });
        }

        
        socket.join(`conversation_${conversation.id}`);
        userRooms.get(userId)?.add(`conversation_${conversation.id}`);

        console.log(`[Socket.IO] User ${userId} joining conversation ${conversation.id}`);
        
        // Load only 20 recent messages for performance - client fetches more on scroll
        const messages = await prisma.message.findMany({
          where: { chatSessionId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        console.log(`[Socket.IO] Loaded ${messages.length} messages for conversation ${conversation.id}`);
        
        // Mark messages as read
        const updateResult = await prisma.message.updateMany({
          where: {
            chatSessionId: conversation.id,
            senderId: { not: userId },
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        if (updateResult.count > 0) {
          console.log(`[Socket.IO] Marked ${updateResult.count} messages as read in conversation ${conversation.id}`);
        }

        // Update unread count
        await updateUnreadCount(conversation.id);

        socket.emit('conversationLoaded', {
          conversationId: conversation.id.toString(),
          participants: conversation.participants.map(p => ({
            id: p.user.id,
            name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
            email: p.user.email,
            avatar: p.user.avatar,
            isOnline: p.user.isOnline,
            lastSeen: p.user.lastSeen
          })),
          messages: messages.reverse().map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: `${m.sender.firstName} ${m.sender.lastName || ''}`.trim(),
            content: m.content,
            createdAt: m.createdAt,
            isRead: m.isRead,
            readAt: m.readAt,
            attachments: m.attachments.map(att => ({
              id: att.id,
              fileName: att.fileName,
              fileUrl: att.filePath,
              filePath: att.filePath,
              mimeType: att.mimeType,
              size: att.size.toString(),
              createdAt: att.createdAt
            }))
          })),
          unreadCount: 0 
        });

        
        io.to(`conversation_${conversation.id}`).emit('messagesRead', {
          conversationId: conversation.id.toString(),
          readBy: userId,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('[Socket.IO] Error in getOrCreateConversation:', error);
        socket.emit('error', { message: 'Failed to load conversation' });
      }
    });

    
    socket.on('sendMessage', async ({ conversationId, content, messageType = 'text' }) => {
      const startTime = Date.now();
    
      
      try {
        if (!conversationId || !content) {
          console.log(`[Socket.IO]  VALIDATION FAILED - Missing conversationId or content`);
          socket.emit('error', { message: 'Conversation ID and content are required' });
          return;
        }

        
        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { participants: true }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          console.log(`[Socket.IO]  PERMISSION DENIED - User ${userId} not participant in conversation ${conversationId}`);
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        console.log(`[Socket.IO]  PERMISSION VERIFIED - User ${userId} is participant in conversation ${conversationId}`);

        
        const message = await prisma.message.create({
          data: {
            chatSessionId: conversationId.toString(),
            senderId: userId,
            content,
            organizationId: conversation.organizationId
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        console.log(`[Socket.IO] 💾 MESSAGE SAVED - Message ID: ${message.id}, DB save time: ${Date.now() - startTime}ms`);

        
        await prisma.chatSession.update({
          where: { id: conversationId },
          data: { 
            lastMessageAt: new Date(),
            updatedAt: new Date()
          }
        });

        const messageData = {
          id: message.id,
          conversationId: conversationId.toString(),
          senderId: message.senderId,
          senderName: `${message.sender.firstName} ${message.sender.lastName || ''}`.trim(),
          content: message.content,
          createdAt: message.createdAt,
          isRead: false,
          messageType,
          attachments: message.attachments.map(att => ({
            id: att.id,
            fileName: att.fileName,
            fileUrl: att.filePath,
            filePath: att.filePath,
            mimeType: att.mimeType,
            size: att.size.toString(),
            createdAt: att.createdAt
          }))
        };

     

        
        // Emit to conversation room (for users who have joined the conversation)
        io.to(`conversation_${conversationId}`).emit('newMessage', messageData);
        
        const broadcastTime = Date.now() - startTime;
        console.log(`[Socket.IO]  MESSAGE BROADCASTED - Time from receive to broadcast: ${broadcastTime}ms`);

        
        socket.emit('messageDelivered', {
          messageId: message.id,
          conversationId: conversationId.toString(),
          timestamp: new Date()
        });

        console.log(`[Socket.IO]  DELIVERY CONFIRMATION SENT - To sender ${userId}, message ID: ${message.id}`);

        
        await updateUnreadCount(conversationId);

        
        // Send message and notifications only to actual participants
        const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
        console.log(`[Socket.IO] 🔗 OTHER PARTICIPANTS - Count: ${otherParticipants.length}`);
        
        for (const participant of otherParticipants) {
          const participantSocket = activeConnections.get(participant.userId);
          const isOnline = !!participantSocket;
          const isInConversation = participantSocket && participantSocket.rooms.has(`conversation_${conversationId}`);
          
          console.log(`[Socket.IO] 👤 Participant ${participant.userId} - Online: ${isOnline}, InConversation: ${isInConversation}`);
          
          if (isOnline) {
            // If user is online but not in conversation room, send message to their personal room
            if (!isInConversation) {
              // Send message to user's personal room so they receive it
              io.to(`user_${participant.userId}`).emit('newMessage', messageData);
              
              // Send notification toast
              participantSocket.emit('newMessageNotification', {
                conversationId: conversationId.toString(),
                senderId: userId,
                senderName: messageData.senderName,
                content: content.length > 50 ? content.substring(0, 50) + '...' : content,
                timestamp: new Date()
              });
              
              // Create notification record
              await createChatMessageNotification(
                userId,
                participant.userId,
                conversationId,
                content,
                conversation.organizationId
              );
              console.log(`[Socket.IO] 📱 NOTIFICATION SENT - To online user ${participant.userId} (not in conversation)`);
            }
            // If user is in conversation room, they already received the message via conversation room broadcast
            // No need to send notification
          } else {
            // User is offline - create notification for when they come back
            await createChatMessageNotification(
              userId,
              participant.userId,
              conversationId,
              content,
              conversation.organizationId
            );
            console.log(`[Socket.IO] 📱 NOTIFICATION CREATED - For offline user ${participant.userId}`);
          }
        }

        const totalTime = Date.now() - startTime;
       

      } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`[Socket.IO]  ERROR in sendMessage after ${errorTime}ms:`, error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('uploadAttachment', async ({ conversationId, fileUrl, fileName, mimeType, size, content = '' }) => {
      const startTime = Date.now();
      console.log(`[Socket.IO] 📎 ATTACHMENT UPLOAD - User ${userId} uploading file to conversation ${conversationId}`);
      console.log(`[Socket.IO] 📎 File: ${fileName} (${mimeType}, ${size} bytes)`);
      
      try {
        if (!conversationId || !fileUrl || !fileName || !mimeType || !size) {
          console.log(`[Socket.IO]  VALIDATION FAILED - Missing required attachment data`);
          socket.emit('error', { message: 'Conversation ID, file URL, file name, MIME type, and size are required' });
          return;
        }

        if (size > 10 * 1024 * 1024) {
          console.log(`[Socket.IO]  VALIDATION FAILED - File size too large: ${size} bytes`);
          socket.emit('error', { message: 'File size too large. Maximum size is 10MB' });
          return;
        }

        const allowedMimeTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedMimeTypes.includes(mimeType)) {
          console.log(`[Socket.IO]  VALIDATION FAILED - File type not allowed: ${mimeType}`);
          socket.emit('error', { message: 'File type not allowed' });
          return;
        }

        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { participants: true }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          console.log(`[Socket.IO]  PERMISSION DENIED - User ${userId} not participant in conversation ${conversationId}`);
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        console.log(`[Socket.IO]  PERMISSION VERIFIED - User ${userId} is participant in conversation ${conversationId}`);

        const message = await prisma.message.create({
          data: {
            chatSessionId: conversationId.toString(),
            senderId: userId,
            content: content || `📎 ${fileName}`,
            organizationId: conversation.organizationId
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        console.log(`[Socket.IO]  MESSAGE CREATED - Message ID: ${message.id}`);

        const attachment = await prisma.attachment.create({
          data: {
            organizationId: conversation.organizationId,
            userId: userId,
            messageId: message.id,
            fileName: fileName,
            filePath: fileUrl,
            mimeType: mimeType,
            size: BigInt(size)
          }
        });

        console.log(`[Socket.IO] 💾 ATTACHMENT SAVED - Attachment ID: ${attachment.id}`);

        // Update conversation last message time
        await prisma.chatSession.update({
          where: { id: conversationId },
          data: { 
            lastMessageAt: new Date(),
            updatedAt: new Date()
          }
        });

        const messageData = {
          id: message.id,
          conversationId: conversationId.toString(),
          senderId: message.senderId,
          senderName: `${message.sender.firstName} ${message.sender.lastName || ''}`.trim(),
          content: message.content,
          createdAt: message.createdAt,
          isRead: false,
          messageType: 'attachment',
          attachments: [{
            id: attachment.id,
            fileName: attachment.fileName,
            fileUrl: attachment.filePath,
            filePath: attachment.filePath,
            mimeType: attachment.mimeType,
            size: attachment.size.toString(),
            createdAt: attachment.createdAt
          }]
        };

        console.log(`[Socket.IO] 📤 BROADCASTING ATTACHMENT - Broadcasting to conversation ${conversationId}`);
        // Emit to conversation room (for users who have joined the conversation)
        io.to(`conversation_${conversationId}`).emit('newMessage', messageData);
        
        const broadcastTime = Date.now() - startTime;
        console.log(`[Socket.IO]  ATTACHMENT BROADCASTED - Time: ${broadcastTime}ms`);

        socket.emit('attachmentDelivered', {
          messageId: message.id,
          attachmentId: attachment.id,
          conversationId: conversationId.toString(),
          timestamp: new Date()
        });

        console.log(`[Socket.IO]  DELIVERY CONFIRMATION SENT - To sender ${userId}`);

        await updateUnreadCount(conversationId);

        // Send message and notifications only to actual participants
        const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
        
        for (const participant of otherParticipants) {
          const participantSocket = activeConnections.get(participant.userId);
          const isOnline = !!participantSocket;
          const isInConversation = participantSocket && participantSocket.rooms.has(`conversation_${conversationId}`);
          
          if (isOnline) {
            // If user is online but not in conversation room, send message to their personal room
            if (!isInConversation) {
              // Send message to user's personal room so they receive it
              io.to(`user_${participant.userId}`).emit('newMessage', messageData);
              
              // Send notification toast
              participantSocket.emit('newMessageNotification', {
                conversationId: conversationId.toString(),
                senderId: userId,
                senderName: messageData.senderName,
                content: `📎 ${fileName}`,
                timestamp: new Date()
              });
              
              // Create notification record
              await createChatMessageNotification(
                userId,
                participant.userId,
                conversationId,
                `📎 ${fileName}`,
                conversation.organizationId,
                'DIRECT',
                {
                  id: attachment.id,
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  size: attachment.size
                }
              );
              console.log(`[Socket.IO] 📱 NOTIFICATION SENT - To online user ${participant.userId} (not in conversation)`);
            }
            // If user is in conversation room, they already received the message via conversation room broadcast
            // No need to send notification
          } else {
            // User is offline - create notification for when they come back
            await createChatMessageNotification(
              userId,
              participant.userId,
              conversationId,
              `📎 ${fileName}`,
              conversation.organizationId,
              'DIRECT',
              {
                id: attachment.id,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                size: attachment.size
              }
            );
            console.log(`[Socket.IO] 📱 NOTIFICATION CREATED - For offline user ${participant.userId} with attachment info`);
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(`[Socket.IO]  ATTACHMENT PROCESSING COMPLETE - Total time: ${totalTime}ms`);

      } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`[Socket.IO]  ERROR in uploadAttachment after ${errorTime}ms:`, error);
        socket.emit('error', { message: 'Failed to upload attachment' });
      }
    });

    socket.on('buzz', async ({ conversationId, targetUserId }) => {
      try {
        if (!conversationId || !targetUserId) {
          socket.emit('error', { message: 'Conversation ID and target user ID are required' });
          return;
        }

        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { participants: true }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true }
        });

        const targetSocket = activeConnections.get(targetUserId);
        if (targetSocket) {
          targetSocket.emit('buzzReceived', {
            conversationId: conversationId.toString(),
            senderId: userId,
            senderName: `${sender.firstName} ${sender.lastName || ''}`.trim(),
            timestamp: new Date()
          });
        }

        const notification = await createChatMessageNotification(
          userId,
          targetUserId,
          conversationId,
          '🔔 Buzz!',
          conversation.organizationId
        );

      } catch (error) {
        console.error(`[Socket.IO] ERROR in buzz:`, error);
        socket.emit('error', { message: 'Failed to send buzz' });
      }
    });

    // Group chat buzz handler
    socket.on('groupBuzz', async ({ groupId }) => {
      try {
        if (!groupId) {
          socket.emit('error', { message: 'Group ID is required' });
          return;
        }

        // Check if user is ORGANIZATION_ADMIN
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            organizationId: true,
            roles: {
              select: {
                name: true
              }
            }
          }
        });

        const isOrgAdmin = currentUser?.roles && currentUser.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

        // Check if user is a participant
        const participant = await prisma.groupChatParticipant.findFirst({
          where: {
            groupChatId: BigInt(groupId),
            userId,
            isActive: true
          },
          include: {
            groupChat: {
              select: {
                id: true,
                name: true,
                organizationId: true,
                allowBuzz: true,
                participants: {
                  where: { isActive: true },
                  select: { userId: true }
                }
              }
            }
          }
        });

        if (!participant || !participant.groupChat) {
          if (isOrgAdmin) {
            // Verify group belongs to same organization
            const groupChat = await prisma.groupChat.findUnique({
              where: { id: BigInt(groupId) },
              select: {
                id: true,
                name: true,
                organizationId: true,
                allowBuzz: true,
                participants: {
                  where: { isActive: true },
                  select: { userId: true }
                }
              }
            });
            
            if (!groupChat || groupChat.organizationId !== currentUser.organizationId) {
              socket.emit('error', { message: 'Not a participant in this group' });
              return;
            }
            // Allow ORGANIZATION_ADMIN to buzz even if not a participant
          } else {
            socket.emit('error', { message: 'Not a participant in this group' });
            return;
          }
        }

        const groupChat = participant?.groupChat || await prisma.groupChat.findUnique({
          where: { id: BigInt(groupId) },
          select: {
            id: true,
            name: true,
            organizationId: true,
            allowBuzz: true,
            participants: {
              where: { isActive: true },
              select: { userId: true }
            }
          }
        });

        if (!groupChat) {
          socket.emit('error', { message: 'Group not found' });
          return;
        }

        // Check if buzz is allowed for this group
        if (groupChat.allowBuzz === false) {
          socket.emit('error', { message: 'Buzz feature is disabled for this group' });
          return;
        }

        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true }
        });

        const senderName = `${sender.firstName} ${sender.lastName || ''}`.trim();

        // Broadcast buzz to all group members in the group room (excluding sender)
        const buzzData = {
          groupId: groupId.toString(),
          groupName: groupChat.name,
          senderId: userId,
          senderName: senderName,
          timestamp: new Date()
        };

        // Broadcast to all members in the group room (excluding sender)
        io.to(`group_${groupId}`).emit('groupBuzzReceived', buzzData);

        // Also send to members not in the room but online
        const participantUserIds = groupChat.participants.map(p => p.userId);
        for (const participantUserId of participantUserIds) {
          // Don't send buzz to the sender
          if (participantUserId === userId) continue;

          const participantSocket = activeConnections.get(participantUserId);
          if (participantSocket && !participantSocket.rooms.has(`group_${groupId}`)) {
            participantSocket.emit('groupBuzzReceived', buzzData);
          }
        }

        // Create notifications for offline users
        const otherParticipants = groupChat.participants.filter(p => p.userId !== userId);
        for (const otherParticipant of otherParticipants) {
          const isOnline = activeConnections.has(otherParticipant.userId);
          
          if (!isOnline) {
            // Create notification for offline user
            await createChatMessageNotification(
              userId,
              otherParticipant.userId,
              groupId,
              '🔔 Buzz!',
              groupChat.organizationId,
              'GROUP_CHAT'
            );
            console.log(`[Socket.IO] 📱 GROUP BUZZ NOTIFICATION CREATED - For offline user ${otherParticipant.userId}`);
          }
        }

        console.log(`[Socket.IO] 🔔 GROUP BUZZ - User ${userId} (${senderName}) buzzed group ${groupId} (${groupChat.name})`);

      } catch (error) {
        console.error(`[Socket.IO] ERROR in groupBuzz:`, error);
        socket.emit('error', { message: 'Failed to send group buzz' });
      }
    });

    socket.on('uploadGroupAttachment', async ({ groupId, fileUrl, fileName, mimeType, size, content = '' }) => {
      const startTime = Date.now();
      console.log(`[Socket.IO] 📎 GROUP ATTACHMENT UPLOAD - User ${userId} uploading file to group ${groupId}`);
      console.log(`[Socket.IO] 📎 File: ${fileName} (${mimeType}, ${size} bytes)`);
      
      try {
        if (!groupId || !fileUrl || !fileName || !mimeType || !size) {
          console.log(`[Socket.IO]  VALIDATION FAILED - Missing required group attachment data`);
          socket.emit('error', { message: 'Group ID, file URL, file name, MIME type, and size are required' });
          return;
        }

        if (size > 10 * 1024 * 1024) {
          console.log(`[Socket.IO]  VALIDATION FAILED - File size too large: ${size} bytes`);
          socket.emit('error', { message: 'File size too large. Maximum size is 10MB' });
          return;
        }

        const allowedMimeTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedMimeTypes.includes(mimeType)) {
          console.log(`[Socket.IO]  VALIDATION FAILED - File type not allowed: ${mimeType}`);
          socket.emit('error', { message: 'File type not allowed' });
          return;
        }

        // Check if user is ORGANIZATION_ADMIN
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            organizationId: true,
            roles: {
              select: {
                name: true
              }
            }
          }
        });

        const isOrgAdmin = currentUser?.roles && currentUser.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

        const participant = await prisma.groupChatParticipant.findFirst({
          where: {
            groupChatId: BigInt(groupId),
            userId: userId,
            isActive: true
          },
          include: {
            groupChat: {
              select: {
                id: true,
                organizationId: true,
                participants: {
                  where: { isActive: true },
                  select: { userId: true }
                }
              }
            }
          }
        });

        // If not a participant, check if ORGANIZATION_ADMIN and group belongs to same org
        if (!participant || !participant.groupChat) {
          if (isOrgAdmin) {
            // Verify group belongs to same organization
            const groupChat = await prisma.groupChat.findUnique({
              where: { id: BigInt(groupId) },
              select: {
                id: true,
                organizationId: true
              }
            });
            
            if (!groupChat || groupChat.organizationId !== currentUser.organizationId) {
              console.log(`[Socket.IO]  PERMISSION DENIED - User ${userId} (ORG_ADMIN) not in same org as group ${groupId}`);
              socket.emit('error', { message: 'Not a participant in this group' });
              return;
            }
            // ORGANIZATION_ADMIN can proceed
          } else {
            console.log(`[Socket.IO]  PERMISSION DENIED - User ${userId} not participant in group ${groupId}`);
            socket.emit('error', { message: 'Not a participant in this group' });
            return;
          }
        }

        console.log(`[Socket.IO]  PERMISSION VERIFIED - User ${userId} is ${isOrgAdmin ? 'ORGANIZATION_ADMIN' : 'participant'} in group ${groupId}`);

        const message = await prisma.groupChatMessage.create({
          data: {
            groupChatId: BigInt(groupId),
            senderId: userId,
            content: content || `📎 ${fileName}`,
            organizationId: participant.groupChat.organizationId
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                filePath: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        const attachment = await prisma.attachment.create({
          data: {
            organizationId: participant.groupChat.organizationId,
            userId: userId,
            groupMessageId: message.id,
            fileName: fileName,
            filePath: fileUrl,
            mimeType: mimeType,
            size: BigInt(size)
          }
        });

        console.log(`[Socket.IO] 💾 GROUP ATTACHMENT SAVED - Attachment ID: ${attachment.id}`);

        // Update group chat last message time
        await prisma.groupChat.update({
          where: { id: BigInt(groupId) },
          data: { 
            lastMessageAt: new Date(),
            updatedAt: new Date()
          }
        });

        const messageData = {
          id: message.id,
          groupId: groupId.toString(),
          senderId: message.senderId,
          senderName: `${message.sender.firstName} ${message.sender.lastName || ''}`.trim(),
          content: message.content,
          createdAt: message.createdAt,
          messageType: 'attachment',
          attachments: [{
            id: attachment.id,
            fileName: attachment.fileName,
            fileUrl: attachment.filePath,
            filePath: attachment.filePath,
            mimeType: attachment.mimeType,
            size: attachment.size.toString(),
            createdAt: attachment.createdAt
          }]
        };

        io.to(`group_${groupId}`).emit('newGroupMessage', messageData);
        
        const broadcastTime = Date.now() - startTime;
      
        socket.emit('groupAttachmentDelivered', {
          messageId: message.id,
          attachmentId: attachment.id,
          groupId: groupId.toString(),
          timestamp: new Date()
        });
        const otherParticipants = participant.groupChat.participants.filter(p => p.userId !== userId);
        
        for (const otherParticipant of otherParticipants) {
          const isOnline = activeConnections.has(otherParticipant.userId);
          
          if (!isOnline) {
          
            await createChatMessageNotification(
              userId,
              otherParticipant.userId,
              groupId,
              `📎 ${fileName}`,
              participant.groupChat.organizationId,
              'GROUP_CHAT',
              {
                id: attachment.id,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                size: attachment.size
              }
            );
            console.log(`[Socket.IO] 📱 GROUP NOTIFICATION CREATED - For offline user ${otherParticipant.userId} with attachment info`);
          }
        }

        // Send push notifications to online users not in group
        for (const otherParticipant of otherParticipants) {
          const participantSocket = activeConnections.get(otherParticipant.userId);
          if (participantSocket && !participantSocket.rooms.has(`group_${groupId}`)) {
            participantSocket.emit('newGroupMessageNotification', {
              groupId: groupId.toString(),
              senderId: userId,
              senderName: messageData.senderName,
              content: `📎 ${fileName}`,
              timestamp: new Date()
            });
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(`[Socket.IO]  GROUP ATTACHMENT PROCESSING COMPLETE - Total time: ${totalTime}ms`);

      } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`[Socket.IO]  ERROR in uploadGroupAttachment after ${errorTime}ms:`, error);
        socket.emit('error', { message: 'Failed to upload group attachment' });
      }
    });

    
    socket.on('messageReceived', ({ messageId, conversationId }) => {
      const timestamp = new Date().toISOString();
      console.log(`[Socket.IO]  FRONTEND CONFIRMATION - User ${userId} received message ${messageId} in conversation ${conversationId}`);
      console.log(`[Socket.IO]  FRONTEND CONFIRMATION - Timestamp: ${timestamp}`);
    });

    
    socket.on('messageDisplayed', ({ messageId, conversationId }) => {
      const timestamp = new Date().toISOString();
      console.log(`[Socket.IO]  FRONTEND DISPLAYED - User ${userId} displayed message ${messageId} in conversation ${conversationId}`);
      console.log(`[Socket.IO]  FRONTEND DISPLAYED - Timestamp: ${timestamp}`);
    });

    
    socket.on('typing', async ({ conversationId, isTyping }) => {
      const timestamp = new Date().toISOString();
      console.log(`[Socket.IO] ⌨️ TYPING - User ${userId} ${isTyping ? 'started' : 'stopped'} typing in conversation ${conversationId}`);
      console.log(`[Socket.IO] ⌨️ TYPING - Timestamp: ${timestamp}`);
      
      if (!conversationId) return;

      // Validate user is a participant in the conversation
      try {
        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { participants: true }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          console.warn(`[Socket.IO]  User ${userId} not in conversation ${conversationId} for typing indicator`);
          return;
        }

        
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true }
        });
        socket.to(`conversation_${conversationId}`).emit('userTyping', {
          conversationId: conversationId.toString(),
          userId,
          isTyping,
          timestamp: new Date()
        });

        console.log(`[Socket.IO]  userTyping event broadcasted to conversation ${conversationId}`);
      } catch (error) {
        console.error(`[Socket.IO]  Error handling typing event:`, error);
      }
    });

    
    socket.on('typingReceived', ({ conversationId, userId: typingUserId, isTyping }) => {
      const timestamp = new Date().toISOString();
      console.log(`[Socket.IO] ⌨️ TYPING RECEIVED - User ${userId} received typing indicator from user ${typingUserId} in conversation ${conversationId}`);
      console.log(`[Socket.IO] ⌨️ TYPING RECEIVED - Is typing: ${isTyping}, Timestamp: ${timestamp}`);
    });

    
    socket.on('markMessagesAsRead', async ({ conversationId }) => {
      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        
        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { participants: true }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        
        await prisma.message.updateMany({
          where: {
              chatSessionId: conversationId.toString(),
            senderId: { not: userId },
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        
        await updateUnreadCount(conversationId);

        
        io.to(`conversation_${conversationId}`).emit('messagesRead', {
          conversationId: conversationId.toString(),
          readBy: userId,
          timestamp: new Date()
        });

        
        await prisma.notification.updateMany({
          where: {
            recipientId: userId,
            type: 'NEW_MESSAGE',
            metadata: {
              path: ['sessionId'],
              equals: conversationId
            }
          },
          data: { isRead: true }
        });

      } catch (error) {
        console.error('[Socket.IO] Error in markMessagesAsRead:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Auto-mark messages as read when user joins conversation
    socket.on('markMessagesAsReadOnJoin', async ({ conversationId }) => {
      try {
        if (!conversationId) {
          return;
        }

        // Verify user is participant in conversation
        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { participants: true }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          return;
        }

        // Mark all unread messages as read
        const result = await prisma.message.updateMany({
          where: {
            chatSessionId: conversationId.toString(),
            senderId: { not: userId },
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        if (result.count > 0) {
          // Update unread count
          await updateUnreadCount(conversationId);

          // Notify all participants in real-time
          io.to(`conversation_${conversationId}`).emit('messagesRead', {
            conversationId: conversationId.toString(),
            readBy: userId,
            timestamp: new Date(),
            autoRead: true
          });

          // Mark chat notifications as read
          await prisma.notification.updateMany({
            where: {
              recipientId: userId,
              type: 'NEW_MESSAGE',
              metadata: {
                path: ['sessionId'],
                equals: conversationId
              }
            },
            data: { isRead: true }
          });
        }

      } catch (error) {
        console.error('[Socket.IO] Error in markMessagesAsReadOnJoin:', error);
      }
    });

    

    
    socket.on('joinGroupChat', async (groupId) => {
      try {
        if (!groupId) {
          socket.emit('error', { message: 'Group ID is required' });
          return;
        }

        // Check if user is ORGANIZATION_ADMIN
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            organizationId: true,
            roles: {
              select: {
                name: true
              }
            }
          }
        });

        const isOrgAdmin = currentUser?.roles && currentUser.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
        
        // Try to find participant
        const participant = await prisma.groupChatParticipant.findFirst({
          where: {
            groupChatId: BigInt(groupId),
            userId,
            isActive: true
          },
          include: {
            groupChat: {
              include: {
                participants: {
                  where: { isActive: true },
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true,
                        isOnline: true,
                        lastSeen: true
                      }
                    }
                  }
                },
                admin: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true
                  }
                },
                groupAdmins: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        // If not a participant and not ORGANIZATION_ADMIN, reject
        if (!participant && !isOrgAdmin) {
          socket.emit('error', { message: 'Not a participant in this group' });
          return;
        }

        // If ORGANIZATION_ADMIN but not a participant, fetch group data separately
        let groupChatData = null;
        if (!participant && isOrgAdmin) {
          groupChatData = await prisma.groupChat.findUnique({
            where: { id: BigInt(groupId) },
            include: {
              participants: {
                where: { isActive: true },
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatar: true,
                      isOnline: true,
                      lastSeen: true
                    }
                  }
                }
              },
              admin: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true
                }
              },
              groupAdmins: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatar: true
                    }
                  }
                }
              }
            }
          });

          // Verify the group belongs to the same organization
          if (!groupChatData || groupChatData.organizationId !== currentUser.organizationId) {
            socket.emit('error', { message: 'Not a participant in this group' });
            return;
          }
        }

        
        socket.join(`group_${groupId}`);
        userRooms.get(userId)?.add(`group_${groupId}`);

        // Use groupChatData from participant or fetched data for ORGANIZATION_ADMIN
        const groupChat = participant?.groupChat || groupChatData;
        
        const messages = await prisma.groupChatMessage.findMany({
          where: { groupChatId: BigInt(groupId) },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                filePath: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        socket.emit('groupChatLoaded', {
          groupId: groupId.toString(),
          group: {
            id: groupChat.id.toString(),
            name: groupChat.name,
            description: groupChat.description,
            admin: groupChat.admin,
            groupAdmins: groupChat.groupAdmins?.map(ga => ({
              id: ga.user.id,
              userId: ga.userId,
              user: {
                id: ga.user.id,
                firstName: ga.user.firstName,
                lastName: ga.user.lastName,
                email: ga.user.email,
                avatar: ga.user.avatar
              }
            })) || [],
            participants: groupChat.participants.map(p => ({
              id: p.user.id,
              name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
              email: p.user.email,
              avatar: p.user.avatar,
              isOnline: p.user.isOnline,
              lastSeen: p.user.lastSeen
            }))
          },
          messages: messages.reverse().map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: `${m.sender.firstName} ${m.sender.lastName || ''}`.trim(),
            sender: {
              id: m.sender.id,
              firstName: m.sender.firstName,
              lastName: m.sender.lastName,
              avatar: m.sender.avatar
            },
            content: m.content,
            createdAt: m.createdAt,
            messageType: 'text',
            attachments: m.attachments.map(att => ({
              id: att.id,
              fileName: att.fileName,
              fileUrl: att.filePath,
              filePath: att.filePath,
              mimeType: att.mimeType,
              size: att.size.toString(),
              createdAt: att.createdAt
            }))
          }))
        });

        console.log(`[Socket.IO] User ${userId} joined group chat ${groupId}`);

      } catch (error) {
        console.error('[Socket.IO] Error in joinGroupChat:', error);
        socket.emit('error', { message: 'Failed to join group chat' });
      }
    });

    
    socket.on('sendGroupMessage', async ({ groupId, content, messageType = 'text', attachment, attachments }) => {
      const startTime = Date.now();
      
      
      try {
        const att = attachment && attachment.fileUrl
          ? attachment
          : (Array.isArray(attachments) && attachments[0]?.fileUrl ? attachments[0] : null);
        const rawContent = content != null ? String(content).trim() : '';
        const messageContent = rawContent || (att ? `📎 ${att.fileName || 'file'}` : '');
        if (!groupId || messageContent === '') {
          console.log(`[Socket.IO]  VALIDATION FAILED - Missing groupId or content`);
          socket.emit('error', { message: 'Group ID and content are required' });
          return;
        }

        if (att) {
          if (!att.fileUrl || !att.fileName || !att.mimeType || att.size == null) {
            socket.emit('error', { message: 'Attachment requires fileUrl, fileName, mimeType, and size' });
            return;
          }
          const sizeNum = Number(att.size);
          if (sizeNum > 10 * 1024 * 1024) {
            socket.emit('error', { message: 'File size too large. Maximum size is 10MB' });
            return;
          }
          const allowedMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'text/plain', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ];
          if (!allowedMimeTypes.includes(att.mimeType)) {
            socket.emit('error', { message: 'File type not allowed' });
            return;
          }
        }

        // Check if user is ORGANIZATION_ADMIN
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            organizationId: true,
            roles: {
              select: {
                name: true
              }
            }
          }
        });

        const isOrgAdmin = currentUser?.roles && currentUser.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

        let participant = await prisma.groupChatParticipant.findFirst({
          where: {
            groupChatId: BigInt(groupId),
            userId,
            isActive: true
          },
          include: {
            groupChat: {
              select: {
                id: true,
                organizationId: true,
                participants: {
                  where: { isActive: true },
                  select: { userId: true }
                }
              }
            }
          }
        });

        // ORGANIZATION_ADMIN can view and read all groups, but can only send messages if they are a participant
        // Check if user is a participant (required for sending messages, even for ORGANIZATION_ADMIN)
        if (!participant || !participant.groupChat) {
          if (isOrgAdmin) {
            // Verify group belongs to same organization
            const groupChat = await prisma.groupChat.findUnique({
              where: { id: BigInt(groupId) },
              select: {
                id: true,
                organizationId: true
              }
            });
            
            if (!groupChat || groupChat.organizationId !== currentUser.organizationId) {
              socket.emit('error', { message: 'Not a participant in this group' });
              return;
            }
            // ORGANIZATION_ADMIN can view/read but cannot send messages if not a participant
            socket.emit('error', { 
              message: 'You can only send messages to groups where you are a member. You can view and read messages from all groups, but must be a participant to send messages.' 
            });
            return;
          } else {
            socket.emit('error', { message: 'Not a participant in this group' });
            return;
          }
        }

        console.log(`[Socket.IO]  PERMISSION VERIFIED - User ${userId} is ${isOrgAdmin ? 'ORGANIZATION_ADMIN' : 'participant'} in group ${groupId}`);

        
        let message = await prisma.groupChatMessage.create({
          data: {
            groupChatId: BigInt(groupId),
            senderId: userId,
            content: messageContent,
            organizationId: participant.groupChat.organizationId
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                filePath: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        if (att) {
          await prisma.attachment.create({
            data: {
              organizationId: participant.groupChat.organizationId,
              userId,
              groupMessageId: message.id,
              fileName: att.fileName,
              filePath: att.fileUrl,
              mimeType: att.mimeType,
              size: BigInt(att.size)
            }
          });
          message = await prisma.groupChatMessage.findUnique({
            where: { id: message.id },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              },
              attachments: {
                select: {
                  id: true,
                  fileName: true,
                  filePath: true,
                  mimeType: true,
                  size: true,
                  createdAt: true
                }
              }
            }
          });
        }

        console.log(`[Socket.IO] 💾 GROUP MESSAGE SAVED - Message ID: ${message.id}`);

        
        await prisma.groupChat.update({
          where: { id: BigInt(groupId) },
          data: { 
            lastMessageAt: new Date(),
            updatedAt: new Date()
          }
        });

        const messageData = {
          id: message.id,
          groupId: groupId.toString(),
          senderId: message.senderId,
          senderName: `${message.sender.firstName} ${message.sender.lastName || ''}`.trim(),
          sender: {
            id: message.sender.id,
            firstName: message.sender.firstName,
            lastName: message.sender.lastName,
            avatar: message.sender.avatar
          },
          content: message.content,
          createdAt: message.createdAt,
          messageType: att ? 'attachment' : messageType,
          attachments: message.attachments.map(a => ({
            id: a.id,
            fileName: a.fileName,
            fileUrl: a.filePath,
            filePath: a.filePath,
            mimeType: a.mimeType,
            size: a.size.toString(),
            createdAt: a.createdAt
          }))
        };

        console.log(`[Socket.IO] 📤 BROADCASTING GROUP MESSAGE - Broadcasting to group ${groupId}`);

        
        io.to(`group_${groupId}`).emit('newGroupMessage', messageData);
        
        const broadcastTime = Date.now() - startTime;
        console.log(`[Socket.IO]  GROUP MESSAGE BROADCASTED - Time: ${broadcastTime}ms`);

        
        socket.emit('groupMessageDelivered', {
          messageId: message.id,
          groupId: groupId.toString(),
          timestamp: new Date()
        });

        
        const otherParticipants = participant.groupChat.participants.filter(p => p.userId !== userId);
        
        for (const otherParticipant of otherParticipants) {
          const isOnline = activeConnections.has(otherParticipant.userId);
          
          if (!isOnline) {
            
            await createChatMessageNotification(
              userId,
              otherParticipant.userId,
              groupId,
              messageContent,
              participant.groupChat.organizationId,
              'GROUP_CHAT'
            );
            console.log(`[Socket.IO] 📱 GROUP NOTIFICATION CREATED - For offline user ${otherParticipant.userId}`);
          }
        }

        
        for (const otherParticipant of otherParticipants) {
          const participantSocket = activeConnections.get(otherParticipant.userId);
          if (participantSocket && !participantSocket.rooms.has(`group_${groupId}`)) {
            participantSocket.emit('newGroupMessageNotification', {
              groupId: groupId.toString(),
              senderId: userId,
              senderName: messageData.senderName,
              content: messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent,
              timestamp: new Date()
            });
          }
        }

        const totalTime = Date.now() - startTime;
       
      } catch (error) {
        const errorTime = Date.now() - startTime;
        console.error(`[Socket.IO]  ERROR in sendGroupMessage after ${errorTime}ms:`, error);
        socket.emit('error', { message: 'Failed to send group message' });
      }
    });

    
    socket.on('groupTyping', ({ groupId, isTyping }) => {
      if (!groupId) return;
      
      socket.to(`group_${groupId}`).emit('groupUserTyping', {
        groupId: groupId.toString(),
        userId,
        isTyping,
        timestamp: new Date()
      });
    });

    
    // Get real-time online status for organization
    socket.on('getOnlineStatus', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true }
        });

        if (!user?.organizationId) {
          socket.emit('error', { message: 'User not in organization' });
          return;
        }

        const orgUsers = await prisma.user.findMany({
          where: {
            organizationId: user.organizationId,
            isActive: true,
            id: { not: userId }
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            lastSeen: true
          }
        });

        // Check which users are actually connected via Socket.IO
        const onlineStatus = orgUsers.map(user => ({
          ...user,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          isOnline: activeConnections.has(user.id),
          lastSeen: user.lastSeen
        }));

        socket.emit('onlineStatusUpdate', {
          users: onlineStatus,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('[Socket.IO] Error getting online status:', error);
        socket.emit('error', { message: 'Failed to get online status' });
      }
    });

    // Get contacts via Socket.IO
    socket.on('getContacts', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { organization: true }
        });
        
        if (!user || !user.organizationId) {
          socket.emit('error', { message: 'User not in any organization' });
          return;
        }
        
        const organizationId = user.organizationId;

        // Get user permissions
        const permissions = await getUserPermissions({ id: userId, organizationId });
        const canChatWithAgents = permissions.some(
          p => p.action === 'CHAT' && p.resource === 'AGENT_TO_AGENT_CHAT'
        );
        const canChatWithTeamLeads = permissions.some(
          p => p.action === 'CHAT' && p.resource === 'AGENT_TO_TEAM_LEAD_CHAT'
        );
        const canChatWithAll = permissions.some(
          p => p.action === 'CHAT' && p.resource === 'TEAM_LEAD_ALL_CHAT'
        );

        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            roles: {
              where: { organizationId }
            }
          }
        });

        const isAgent = currentUser.roles.some(r => r.isAgent === true);
        const isTeamLead = currentUser.roles.some(r => r.name === 'TEAM_LEAD');

        const hasDefaultTeamLeadAccess = isTeamLead || canChatWithAll; 
        const hasExplicitTeamLeadAccess = canChatWithTeamLeads;
        const canAccessTeamLeads = hasDefaultTeamLeadAccess || hasExplicitTeamLeadAccess || isAgent;

        let teamLeads = [];
        if (canAccessTeamLeads) {
          teamLeads = await prisma.user.findMany({
            where: {
              organizationId,
              isActive: true,
              id: { not: userId },
              roles: {
                some: {
                  isAgent: false, 
                  organizationId
                }
              }
            },
            include: {
              roles: {
                where: { organizationId }
              }
            }
          });
        }

        let agents = [];
        if (canChatWithAll || canChatWithAgents) {
          agents = await prisma.user.findMany({
            where: {
              organizationId,
              isActive: true,
              id: { not: userId },
              roles: {
                some: {
                  isAgent: true,
                  organizationId
                }
              }
            },
            include: {
              roles: {
                where: { organizationId }
              }
            }
          });
        }

        // Get all chat sessions for the current user to find last message times
        const chatSessions = await prisma.chatSession.findMany({
          where: {
            organizationId,
            isActive: true,
            participants: {
              some: { userId }
            }
          },
          select: {
            id: true,
            lastMessageAt: true,
            participants: {
              select: {
                user: {
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        });

        // Create a map of contactId -> lastMessageAt
        const lastMessageMap = new Map();
        chatSessions.forEach(session => {
          const otherParticipant = session.participants.find(p => p.user.id !== userId);
          if (otherParticipant && session.lastMessageAt) {
            const existingTime = lastMessageMap.get(otherParticipant.user.id);
            if (!existingTime || new Date(session.lastMessageAt) > new Date(existingTime)) {
              lastMessageMap.set(otherParticipant.user.id, session.lastMessageAt);
            }
          }
        });

        // Sort function: recently chatted users first, then by name
        const sortByRecentChat = (a, b) => {
          const aLastMessage = lastMessageMap.get(a.id);
          const bLastMessage = lastMessageMap.get(b.id);
          
          // If both have chat history, sort by lastMessageAt (most recent first)
          if (aLastMessage && bLastMessage) {
            return new Date(bLastMessage) - new Date(aLastMessage);
          }
          // If only one has chat history, prioritize it
          if (aLastMessage && !bLastMessage) return -1;
          if (!aLastMessage && bLastMessage) return 1;
          // If neither has chat history, sort alphabetically by name
          const aName = (a.firstName + ' ' + (a.lastName || '')).trim();
          const bName = (b.firstName + ' ' + (b.lastName || '')).trim();
          return aName.localeCompare(bName);
        };

        // Sort team leads and agents by recent chat activity
        teamLeads.sort(sortByRecentChat);
        agents.sort(sortByRecentChat);

        // Get current user info
        const selfUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        });

        const contactsData = {
          teamLeads: teamLeads.map(u => ({
            id: u.id,
            name: u.firstName + ' ' + (u.lastName || ''),
            email: u.email,
            avatar: u.avatar,
            isOnline: activeConnections.has(u.id),
            lastSeen: u.lastSeen
          })),
          agents: agents.map(u => ({
            id: u.id,
            name: u.firstName + ' ' + (u.lastName || ''),
            email: u.email,
            avatar: u.avatar,
            isOnline: activeConnections.has(u.id),
            lastSeen: u.lastSeen
          })),
          permissions: {
            canChatWithAgents,
            canChatWithTeamLeads,
            canChatWithAll,
            hasDefaultTeamLeadAccess: isAgent || isTeamLead || canChatWithAll, 
            isAgent,
            isTeamLead
          },
          selfId: selfUser.id,
          selfName: `${selfUser.firstName} ${selfUser.lastName || ''}`.trim(),
          selfEmail: selfUser.email
        };

        socket.emit('contactsUpdate', contactsData);

      } catch (error) {
        console.error('[Socket.IO] Error getting contacts:', error);
        socket.emit('error', { message: 'Failed to get contacts' });
      }
    });

    socket.on('getConversations', async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true }
        });

        if (!user?.organizationId) {
          socket.emit('error', { message: 'User not in organization' });
          return;
        }

        const conversations = await prisma.chatSession.findMany({
          where: {
            isActive: true,
            organizationId: user.organizationId,
            participants: {
              some: { userId }
            }
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                    isOnline: true,
                    lastSeen: true
                  }
                }
              }
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: { lastMessageAt: 'desc' }
        });

        const conversationsList = await Promise.all(conversations.map(async (conv) => {
          const otherParticipant = conv.participants.find(p => p.user.id !== userId);
          const lastMessage = conv.messages[0];

         
          const unreadCount = await prisma.message.count({
            where: {
              chatSessionId: conv.id,
              senderId: { not: userId },
              isRead: false
            }
          });

          return {
            id: conv.id.toString(), 
            otherUser: otherParticipant ? {
              id: otherParticipant.user.id,
              name: `${otherParticipant.user.firstName} ${otherParticipant.user.lastName || ''}`.trim(),
              email: otherParticipant.user.email,
              avatar: otherParticipant.user.avatar,
              isOnline: otherParticipant.user.isOnline,
              lastSeen: otherParticipant.user.lastSeen
            } : null,
            lastMessage: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName || ''}`.trim(),
              createdAt: lastMessage.createdAt,
              isRead: lastMessage.isRead
            } : null,
            lastMessageAt: conv.lastMessageAt,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            unreadCount
          };
        }));

        socket.emit('conversationsList', { conversations: conversationsList });

      } catch (error) {
        console.error('[Socket.IO] Error in getConversations:', error);
        socket.emit('error', { message: 'Failed to load conversations' });
      }
    });

    
    socket.on('getMessages', async ({ conversationId, page = 1, limit = 50 }) => {
      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        
        const conversation = await prisma.chatSession.findUnique({
          where: { id: conversationId },
          include: { participants: true }
        });

        if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        const skip = (page - 1) * limit;
        const messages = await prisma.message.findMany({
          where: { chatSessionId: conversationId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            },
            attachments: {
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

        const hasMore = messages.length === limit;

        socket.emit('messagesLoaded', {
          conversationId: conversationId.toString(), 
          messages: messages.reverse().map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: `${m.sender.firstName} ${m.sender.lastName || ''}`.trim(),
            content: m.content,
            createdAt: m.createdAt,
            isRead: m.isRead,
            readAt: m.readAt,
            attachments: m.attachments.map(att => ({
              id: att.id,
              fileName: att.fileName,
              fileUrl: att.filePath,
              filePath: att.filePath,
              mimeType: att.mimeType,
              size: att.size.toString(),
              createdAt: att.createdAt
            }))
          })),
          hasMore,
          page
        });

      } catch (error) {
        console.error('[Socket.IO] Error in getMessages:', error);
        socket.emit('error', { message: 'Failed to load messages' });
      }
    });

    
    socket.on('deleteMessage', async ({ messageId }) => {
      try {
        if (!messageId) {
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }

        const message = await prisma.message.findUnique({
          where: { id: parseInt(messageId) },
          include: { chatSession: { include: { participants: true } } }
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.senderId !== userId) {
          socket.emit('error', { message: 'You can only delete your own messages' });
          return;
        }

        if (!message.chatSession.participants.some(p => p.userId === userId)) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        const permissions = await getUserPermissions({ id: userId });
        if (!userMayDeleteOwnDirectMessage(permissions)) {
          socket.emit('error', { message: 'You do not have permission to delete one-to-one chat messages' });
          return;
        }

        
        await prisma.message.update({
          where: { id: parseInt(messageId) },
          data: { 
            content: '[Message deleted]',
            updatedAt: new Date()
          }
        });

        
        io.to(`conversation_${message.chatSessionId}`).emit('messageDeleted', {
          messageId: parseInt(messageId),
          conversationId: message.chatSessionId.toString(), 
          timestamp: new Date()
        });

      } catch (error) {
        console.error('[Socket.IO] Error in deleteMessage:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Delete group chat message (own messages only, with GROUP_CHAT_MESSAGE DELETE permission)
    socket.on('deleteGroupMessage', async ({ messageId, groupId }) => {
      try {
        if (!messageId) {
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }

        if (!groupId) {
          socket.emit('error', { message: 'Group ID is required' });
          return;
        }

        // GroupChatMessage.id is Int in schema — must not use BigInt here
        const messageIdInt = parseInt(messageId, 10);
        if (Number.isNaN(messageIdInt)) {
          socket.emit('error', { message: 'Invalid message ID' });
          return;
        }

        // Get the group message
        const groupMessage = await prisma.groupChatMessage.findUnique({
          where: { id: messageIdInt },
          include: {
            groupChat: {
              include: {
                participants: {
                  where: { isActive: true },
                  select: { userId: true }
                }
              }
            }
          }
        });

        if (!groupMessage) {
          socket.emit('error', { message: 'Group message not found' });
          return;
        }

        if (Number(groupMessage.groupChatId) !== Number(groupId)) {
          socket.emit('error', { message: 'Message does not belong to this group' });
          return;
        }

        const isParticipant = groupMessage.groupChat.participants.some(p => p.userId === userId);
        if (!isParticipant) {
          socket.emit('error', { message: 'Not a participant in this group' });
          return;
        }

        const isSender = groupMessage.senderId === userId;
        if (!isSender) {
          socket.emit('error', { message: 'You can only delete your own messages' });
          return;
        }

        const permissions = await getUserPermissions({ id: userId });
        if (!userMayDeleteOwnGroupMessage(permissions)) {
          socket.emit('error', { message: 'You do not have permission to delete group chat messages' });
          return;
        }

        // Soft delete by updating content
        await prisma.groupChatMessage.update({
          where: { id: messageIdInt },
          data: { 
            content: '[Message deleted]',
            updatedAt: new Date()
          }
        });

        // Broadcast deletion to all group members
        io.to(`group_${groupId}`).emit('groupMessageDeleted', {
          messageId: messageIdInt,
          groupId: groupId.toString(),
          timestamp: new Date()
        });

        console.log(`[Socket.IO] Group message ${messageIdInt} deleted by user ${userId} in group ${groupId}`);

      } catch (error) {
        console.error('[Socket.IO] Error in deleteGroupMessage:', error);
        const detail = error?.message || (typeof error === 'string' ? error : '');
        socket.emit('error', {
          message: detail ? `Failed to delete group message: ${detail}` : 'Failed to delete group message'
        });
      }
    });

    
    socket.on('disconnect', async () => {
      console.log(`[Socket.IO] User disconnected: userId=${userId}, socketId=${socket.id}`);
      
      // Clear heartbeat interval
      if (socket.heartbeatInterval) {
        clearInterval(socket.heartbeatInterval);
      }
      
      activeConnections.delete(userId);
      userRooms.delete(userId);
      
      await updateOnlineStatus(false);
      
      // Notify organization members that this user went offline
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true }
        });

        if (user?.organizationId) {
          io.to(`org_${user.organizationId}`).emit('userStatusChanged', {
            userId,
            isOnline: false,
            lastSeen: new Date(),
            timestamp: new Date(),
            reason: 'disconnect'
          }); 
        }
      } catch (error) {
        console.error('[Socket.IO] Error notifying disconnect:', error);
      }
    });
  });
};


async function updateUnreadCount(conversationId) {
  try {
    const participants = await prisma.chatParticipant.findMany({
      where: { chatSessionId: conversationId },
      select: { userId: true }
    });

    const unreadCounts = {};
    
    for (const participant of participants) {
      const count = await prisma.message.count({
        where: {
          chatSessionId: conversationId.toString(),
          senderId: { not: participant.userId },
          isRead: false
        }
      });
      unreadCounts[participant.userId] = count;
    }

    await prisma.chatSession.update({
      where: { id: conversationId },
      data: { unreadCount: unreadCounts }
    });

    // CRITICAL FIX: Send unread count update individually to each participant
    // This ensures each user only receives their own unread count, not everyone's
    // Send to each user's personal room (user_${userId}) to ensure they receive it
    for (const participant of participants) {
      const participantUnreadCount = unreadCounts[participant.userId] || 0;
      
      // Send to user's personal room - this ensures they receive it even if not in conversation room
      io.to(`user_${participant.userId}`).emit('unreadCountUpdate', {
        conversationId: conversationId.toString(),
        unreadCounts: { [participant.userId]: participantUnreadCount }
      });
    }
    
    // Also send to conversation room with all counts (for backward compatibility)
    // Frontend will filter to get only the current user's count
    io.to(`conversation_${conversationId}`).emit('unreadCountUpdate', {
      conversationId: conversationId.toString(),
      unreadCounts: unreadCounts
    });

  } catch (error) {
    console.error('[Socket.IO] Error updating unread count:', error);
  }
} 