const { prisma } = require('../config/database');
const { createChatMessageNotification } = require('./notificationController');
const { getUserPermissions } = require('../utils/audit');

// Get all contacts (users) in the organization

async function getContacts(req, res) {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    });
    
    if (!user || !user.organizationId) {
      return res.status(400).json({ error: 'User not in any organization' });
    }
    
    const organizationId = user.organizationId;

    const permissions = await getUserPermissions(req.user);
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

    res.json({
      teamLeads: teamLeads.map(u => ({
        id: u.id,
        name: u.firstName + ' ' + (u.lastName || ''),
        email: u.email,
        avatar: u.avatar,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen
      })),
      agents: agents.map(u => ({
        id: u.id,
        name: u.firstName + ' ' + (u.lastName || ''),
        email: u.email,
        avatar: u.avatar,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen
      })),
      permissions: {
        canChatWithAgents,
        canChatWithTeamLeads,
        canChatWithAll,
        hasDefaultTeamLeadAccess: isAgent || isTeamLead || canChatWithAll, 
        isAgent,
        isTeamLead
      }
    });
  } catch (error) {
    console.error('Error in getContacts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get or create conversation between two users
async function getOrCreateConversation(req, res) {

  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user required' });
    }
    
    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Cannot chat with yourself' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ error: 'User not in any organization' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        roles: {
          where: { organizationId: user.organizationId }
        }
      }
    });

    if (!targetUser) {
      return res.status(400).json({ error: 'Target user not found' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: { organizationId: user.organizationId }
        }
      }
    });

    const isAgent = currentUser.roles.some(r => r.isAgent === true);
    const isTeamLead = currentUser.roles.some(r => r.name === 'TEAM_LEAD');

    const permissions = await getUserPermissions(req.user);
    const canChatWithAgents = permissions.some(
      p => p.action === 'CHAT' && p.resource === 'AGENT_TO_AGENT_CHAT'
    );
    const canChatWithTeamLeads = permissions.some(
      p => p.action === 'CHAT' && p.resource === 'AGENT_TO_TEAM_LEAD_CHAT'
    );
    const canChatWithAll = permissions.some(
      p => p.action === 'CHAT' && p.resource === 'TEAM_LEAD_ALL_CHAT'
    );

    
    const targetIsAgent = targetUser.roles.some(r => r.isAgent === true);

    let hasPermission = false;
    
    if (canChatWithAll || isTeamLead) {
      hasPermission = true;
    } else if (targetIsAgent && canChatWithAgents) {
      hasPermission = true;
    } else if (!targetIsAgent && (canChatWithTeamLeads || !isAgent)) {
      hasPermission = true;
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'You do not have permission to chat with this user',
        requiredAction: 'CHAT',
        requiredResource: targetIsAgent ? 'AGENT_TO_AGENT_CHAT' : 'AGENT_TO_TEAM_LEAD_CHAT'
      });
    }

    // Find existing conversation or create new one
    let conversation = await prisma.chatSession.findFirst({
      where: {
        isActive: true,
        organizationId: user.organizationId,
        participants: {
          some: { userId }
        },
        AND: {
          participants: {
            some: { userId: targetUserId }
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
      // Create new conversation
      conversation = await prisma.chatSession.create({
        data: {
          organizationId: user.organizationId,
          participants: {
            create: [
              { userId, organizationId: user.organizationId },
              { userId: targetUserId, organizationId: user.organizationId }
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
    
    res.json({ 
      conversationId: conversation.id.toString(),
      participants: conversation.participants.map(p => ({
        id: p.user.id,
        name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
        email: p.user.email,
        avatar: p.user.avatar,
        isOnline: p.user.isOnline,
        lastSeen: p.user.lastSeen
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    });
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get messages for a conversation
async function getMessages(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const conversation = await prisma.chatSession.findUnique({
        where: { id: conversationId },
      include: { participants: true }
    });
    
    if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }
    
    if (!conversation.isActive) {
      return res.status(410).json({ 
        error: 'Conversation is not active',
        code: 'CONVERSATION_INACTIVE'
      });
    }
    
    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where: { chatSessionId: conversationId },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit),
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
      }),
      prisma.message.count({
        where: { chatSessionId: conversationId }
      })
    ]);
    
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      messages: messages.map(m => ({
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
          mimeType: att.mimeType,
          size: att.size.toString(),
          createdAt: att.createdAt
        }))
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getMessages:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Send a message via REST API
async function sendMessage(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { content, attachments = [] } = req.body;
    
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Message content or attachments required' });
    }
    
    const conversation = await prisma.chatSession.findUnique({
      where: { id: conversationId },
      include: { participants: true }
    });
    
    if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }
    
    if (!conversation.isActive) {
      return res.status(410).json({ 
        error: 'Conversation is not active',
        code: 'CONVERSATION_INACTIVE'
      });
    }
    
    const message = await prisma.message.create({
      data: {
        chatSessionId: conversationId.toString(),
        senderId: userId,
        content: content || (attachments.length > 0 ? `📎 ${attachments.length} file(s)` : ''),
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

    // Handle attachments if provided
    if (attachments && attachments.length > 0) {
      const path = require('path');
      const fs = require('fs').promises;
      
      for (const attachment of attachments) {
        if (attachment.fileData && attachment.fileName && attachment.mimeType && attachment.size) {
          try {
            // Convert base64 to buffer and save file
            const fileBuffer = Buffer.from(attachment.fileData, 'base64');
            const fileExtension = path.extname(attachment.fileName);
            const finalFileName = `${Date.now()}_${attachment.fileName}`;
            
            const finalPath = path.join(
              'uploads',
              `org_${conversation.organizationId}`,
              `user_${userId}`,
              `chat_${conversationId}`,
              `message_${message.id}`,
              finalFileName
            );

            // Create directory and save file
            await fs.mkdir(path.dirname(finalPath), { recursive: true });
            await fs.writeFile(finalPath, fileBuffer);

            // Create attachment record
            await prisma.attachment.create({
              data: {
                organizationId: conversation.organizationId,
                userId: userId,
                messageId: message.id,
                fileName: attachment.fileName,
                filePath: finalPath,
                mimeType: attachment.mimeType,
                size: BigInt(attachment.size)
              }
            });
          } catch (attachmentError) {
            console.error('Error saving attachment:', attachmentError);
            // Continue with message even if attachment fails
          }
        }
      }
      
      // Reload message with attachments
      const updatedMessage = await prisma.message.findUnique({
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
              mimeType: true,
              size: true,
              createdAt: true
            }
          }
        }
      });
      
      message.attachments = updatedMessage.attachments;
    }
  
    await prisma.chatSession.update({
      where: { id: conversationId },
      data: { 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Create notifications for offline participants
    const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
    for (const participant of otherParticipants) {
      await createChatMessageNotification(
        userId,
        participant.userId,
        conversationId,
        content || (attachments.length > 0 ? `📎 ${attachments.length} file(s)` : ''),
        conversation.organizationId
      );
    }
    
    res.json({ 
      success: true, 
      message: {
        id: message.id,
        conversationId: conversationId.toString(), 
        senderId: message.senderId,
        senderName: `${message.sender.firstName} ${message.sender.lastName || ''}`.trim(),
        content: message.content,
        createdAt: message.createdAt,
        isRead: false,
        messageType: attachments.length > 0 ? 'attachment' : 'text',
        attachments: message.attachments.map(att => ({
          id: att.id,
          fileName: att.fileName,
          mimeType: att.mimeType,
          size: att.size.toString(),
          createdAt: att.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Mark messages as read
async function markMessagesAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    
    const conversation = await prisma.chatSession.findUnique({
      where: { id: conversationId },
      include: { participants: true }
    });
    
    if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }

    // Mark all unread messages as read
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
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in markMessagesAsRead:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}


async function getUserConversations(req, res) {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });
    
    if (!user || !user.organizationId) {
      return res.status(400).json({ error: 'User not in any organization' });
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
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });
    
    const conversationsList = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => p.user.id !== userId);
      const lastMessage = conv.messages[0];
      
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
          isRead: lastMessage.isRead,
          attachments: lastMessage.attachments.map(att => ({
            id: att.id,
            fileName: att.fileName,
            mimeType: att.mimeType,
            size: att.size.toString(),
            createdAt: att.createdAt
          }))
        } : null,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });
    
    res.json({ conversations: conversationsList });
  } catch (error) {
    console.error('Error in getUserConversations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get online status of users in organization
async function getOnlineStatus(req, res) {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });
    
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User not in any organization' });
    }

    // Get all users in the organization with their online status
    const users = await prisma.user.findMany({
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
        isOnline: true,
        lastSeen: true,
        onlineStatusUpdatedAt: true
      },
      orderBy: [
        { isOnline: 'desc' },
        { lastSeen: 'desc' }
      ]
    });

    res.json({
      success: true,
      users: users.map(user => ({
        ...user,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        status: user.isOnline ? 'online' : 'offline'
      }))
    });

  } catch (error) {
    console.error('Error getting online status:', error);
    res.status(500).json({ error: 'Failed to get online status' });
  }
}


async function getUserOnlineStatus(req, res) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    
    
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { organizationId: true }
    });
    
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        isOnline: true,
        lastSeen: true,
        onlineStatusUpdatedAt: true,
        organizationId: true
      }
    });

    if (!targetUser || targetUser.organizationId !== currentUser.organizationId) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        ...targetUser,
        fullName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
        status: targetUser.isOnline ? 'online' : 'offline'
      }
    });

  } catch (error) {
    console.error('Error getting user online status:', error);
    res.status(500).json({ error: 'Failed to get user online status' });
  }
}

// Send a message with attachments via REST API
async function sendMessageWithAttachments(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { content, attachments = [] } = req.body;
    
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Message content or attachments required' });
    }
    
    const conversation = await prisma.chatSession.findUnique({
      where: { id: conversationId },
      include: { participants: true }
    });
    
    if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
      return res.status(403).json({ error: 'Not a participant in this conversation' });
    }
    
    if (!conversation.isActive) {
      return res.status(410).json({ 
        error: 'Conversation is not active',
        code: 'CONVERSATION_INACTIVE'
      });
    }
    
    // Validate attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (!attachment.fileData || !attachment.fileName || !attachment.mimeType || !attachment.size) {
          return res.status(400).json({ 
            error: 'Each attachment must have fileData, fileName, mimeType, and size' 
          });
        }
        
        // Validate file size (e.g., max 10MB)
        if (attachment.size > 10 * 1024 * 1024) {
          return res.status(400).json({ 
            error: 'File size too large. Maximum size is 10MB' 
          });
        }
        
        // Validate MIME type (basic validation)
        const allowedMimeTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 'text/plain', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedMimeTypes.includes(attachment.mimeType)) {
          return res.status(400).json({ 
            error: 'File type not allowed' 
          });
        }
      }
    }
    
    const message = await prisma.message.create({
      data: {
        chatSessionId: conversationId.toString(),
        senderId: userId,
        content: content || (attachments.length > 0 ? `📎 ${attachments.length} file(s)` : ''),
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

    // Handle attachments if provided
    if (attachments && attachments.length > 0) {
      const path = require('path');
      const fs = require('fs').promises;
      
      for (const attachment of attachments) {
        try {
          // Convert base64 to buffer and save file
          const fileBuffer = Buffer.from(attachment.fileData, 'base64');
          const fileExtension = path.extname(attachment.fileName);
          const finalFileName = `${Date.now()}_${attachment.fileName}`;
          
          const finalPath = path.join(
            'uploads',
            `org_${conversation.organizationId}`,
            `user_${userId}`,
            `chat_${conversationId}`,
            `message_${message.id}`,
            finalFileName
          );

          // Create directory and save file
          await fs.mkdir(path.dirname(finalPath), { recursive: true });
          await fs.writeFile(finalPath, fileBuffer);

          // Create attachment record
          await prisma.attachment.create({
            data: {
              organizationId: conversation.organizationId,
              userId: userId,
              messageId: message.id,
              fileName: attachment.fileName,
              filePath: finalPath,
              mimeType: attachment.mimeType,
              size: BigInt(attachment.size)
            }
          });
        } catch (attachmentError) {
          console.error('Error saving attachment:', attachmentError);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to save attachment' 
          });
        }
      }
      
      // Reload message with attachments
      const updatedMessage = await prisma.message.findUnique({
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
              mimeType: true,
              size: true,
              createdAt: true
            }
          }
        }
      });
      
      message.attachments = updatedMessage.attachments;
    }
  
    await prisma.chatSession.update({
      where: { id: conversationId },
      data: { 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Create notifications for offline participants
    const otherParticipants = conversation.participants.filter(p => p.userId !== userId);
    for (const participant of otherParticipants) {
      await createChatMessageNotification(
        userId,
        participant.userId,
        conversationId,
        content || (attachments.length > 0 ? `📎 ${attachments.length} file(s)` : ''),
        conversation.organizationId
      );
    }
    
    res.json({ 
      success: true, 
      message: {
        id: message.id,
        conversationId: conversationId.toString(), 
        senderId: message.senderId,
        senderName: `${message.sender.firstName} ${message.sender.lastName || ''}`.trim(),
        content: message.content,
        createdAt: message.createdAt,
        isRead: false,
        messageType: attachments.length > 0 ? 'attachment' : 'text',
        attachments: message.attachments.map(att => ({
          id: att.id,
          fileName: att.fileName,
          mimeType: att.mimeType,
          size: att.size.toString(),
          createdAt: att.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error in sendMessageWithAttachments:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  getContacts,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  sendMessageWithAttachments,
  markMessagesAsRead,
  getUserConversations,
  getOnlineStatus,
  getUserOnlineStatus
}; 