const jwt = require('jsonwebtoken');
const { prisma } = require('./config/database');
const { createChatMessageNotification } = require('./controllers/notificationController');
const { getUserPermissions } = require('./utils/audit');


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

        
        const messages = await prisma.message.findMany({
          where: { chatSessionId: conversation.id },
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
            select: { organizationId: true }
          }),
          prisma.user.findUnique({
            where: { id: parseInt(targetUserId) },
            select: { organizationId: true }
          })
        ]);

        if (!currentUser || !targetUser || currentUser.organizationId !== targetUser.organizationId) {
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
        
        // Fetch messages for the conversation
        const messages = await prisma.message.findMany({
          where: { chatSessionId: conversation.id },
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

        
        const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
        console.log(`[Socket.IO] 🔗 OTHER PARTICIPANTS - Count: ${otherParticipants.length}`);
        
        for (const participant of otherParticipants) {
          const isOnline = activeConnections.has(participant.userId);
          console.log(`[Socket.IO] 👤 Participant ${participant.userId} - Online: ${isOnline}`);
          
          if (!isOnline) {
            
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

        
        for (const participant of otherParticipants) {
          const participantSocket = activeConnections.get(participant.userId);
          if (participantSocket && !participantSocket.rooms.has(`conversation_${conversationId}`)) {
            participantSocket.emit('newMessageNotification', {
              conversationId: conversationId.toString(),
              senderId: userId,
              senderName: messageData.senderName,
              content: content.length > 50 ? content.substring(0, 50) + '...' : content,
              timestamp: new Date()
            });
            console.log(`[Socket.IO]  PUSH NOTIFICATION SENT - To online user ${participant.userId} (not in conversation)`);
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

        // Broadcast to all participants in the conversation
        io.to(`conversation_${conversationId}`).emit('newMessage', messageData);
        
        const broadcastTime = Date.now() - startTime;
        console.log(`[Socket.IO]  ATTACHMENT BROADCASTED - Time: ${broadcastTime}ms`);

        // Send delivery confirmation to sender
        socket.emit('attachmentDelivered', {
          messageId: message.id,
          attachmentId: attachment.id,
          conversationId: conversationId.toString(),
          timestamp: new Date()
        });

        console.log(`[Socket.IO]  DELIVERY CONFIRMATION SENT - To sender ${userId}`);

        // Update unread count
        await updateUnreadCount(conversationId);

        // Handle notifications for offline users
        const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
        
        for (const participant of otherParticipants) {
          const isOnline = activeConnections.has(participant.userId);
          
          if (!isOnline) {
            // Pass attachment information to notification
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

        // Send push notifications to online users not in conversation
        for (const participant of otherParticipants) {
          const participantSocket = activeConnections.get(participant.userId);
          if (participantSocket && !participantSocket.rooms.has(`conversation_${conversationId}`)) {
            participantSocket.emit('newMessageNotification', {
              conversationId: conversationId.toString(),
              senderId: userId,
              senderName: messageData.senderName,
              content: `📎 ${fileName}`,
              timestamp: new Date()
            });
            console.log(`[Socket.IO]  PUSH NOTIFICATION SENT - To online user ${participant.userId}`);
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

        if (!participant || !participant.groupChat) {
          console.log(`[Socket.IO]  PERMISSION DENIED - User ${userId} not participant in group ${groupId}`);
          socket.emit('error', { message: 'Not a participant in this group' })
          return;
        }

        console.log(`[Socket.IO]  PERMISSION VERIFIED - User ${userId} is participant in group ${groupId}`);

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
                }
              }
            }
          }
        });

        if (!participant) {
          socket.emit('error', { message: 'Not a participant in this group' });
          return;
        }

        
        socket.join(`group_${groupId}`);
        userRooms.get(userId)?.add(`group_${groupId}`);

        
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
            id: participant.groupChat.id.toString(),
            name: participant.groupChat.name,
            description: participant.groupChat.description,
            admin: participant.groupChat.admin,
            participants: participant.groupChat.participants.map(p => ({
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
            content: m.content,
            createdAt: m.createdAt,
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

    
    socket.on('sendGroupMessage', async ({ groupId, content, messageType = 'text' }) => {
      const startTime = Date.now();
      
      
      try {
        if (!groupId || !content) {
          console.log(`[Socket.IO]  VALIDATION FAILED - Missing groupId or content`);
          socket.emit('error', { message: 'Group ID and content are required' });
          return;
        }

        
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
                organizationId: true,
                participants: {
                  where: { isActive: true },
                  select: { userId: true }
                }
              }
            }
          }
        });

        if (!participant || !participant.groupChat) {
          socket.emit('error', { message: 'Not a participant in this group' });
          return;
        }

        console.log(`[Socket.IO]  PERMISSION VERIFIED - User ${userId} is participant in group ${groupId}`);

        
        const message = await prisma.groupChatMessage.create({
          data: {
            groupChatId: BigInt(groupId),
            senderId: userId,
            content,
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
                mimeType: true,
                size: true,
                createdAt: true
              }
            }
          }
        });

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
          content: message.content,
          createdAt: message.createdAt,
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
              content,
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
              content: content.length > 50 ? content.substring(0, 50) + '...' : content,
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

  } catch (error) {
    console.error('[Socket.IO] Error updating unread count:', error);
  }
} 