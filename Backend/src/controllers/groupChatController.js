const { prisma } = require('../config/database');
const { getUserPermissions } = require('../utils/audit');
const { serializeBigInt } = require('../utils/bigIntSerializer');

// Create a new group chat
async function createGroupChat(req, res) {
  try {
    const userId = req.user.id;
    const { name, description, userIds } = req.body;

    if (!name || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Group name and user IDs array are required' 
      });
    }

    const permissions = await getUserPermissions(req.user);
    const canCreateGroup = permissions.some(
      p => p.action === 'CREATE' && p.resource === 'CREATE_GROUP_CHAT'
    );

    if (!canCreateGroup) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions to create group chat' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    // Verify all users exist and are in the same organization
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        organizationId: user.organizationId,
        isActive: true
      }
    });

    if (users.length !== userIds.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Some users not found or not in organization' 
      });
    }

    // Create group chat with participants
    const groupChat = await prisma.groupChat.create({
      data: {
        name,
        description,
        organizationId: user.organizationId,
        adminId: userId,
        participants: {
          create: [
            { userId, organizationId: user.organizationId },
            ...userIds.filter(id => id !== userId).map(id => ({
              userId: id,
              organizationId: user.organizationId
            }))
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
                avatar: true
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
    });

    // Serialize BigInt values using utility function
    const serializedGroupChat = serializeBigInt(groupChat);

    res.status(201).json({
      success: true,
      data: serializedGroupChat
    });

  } catch (error) {
    console.error('Error in createGroupChat:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get all group chats for a user
async function getUserGroupChats(req, res) {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const groupChats = await prisma.groupChat.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        participants: {
          some: {
            userId,
            isActive: true
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
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });
    const serializedGroupChats = serializeBigInt(groupChats);

    res.json({
      success: true,
      data: serializedGroupChats
    });

  } catch (error) {
    console.error('Error in getUserGroupChats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get specific group chat details
async function getGroupChat(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        isActive: true,
        participants: {
          some: {
            userId
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
                avatar: true
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
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found' 
      });
    }

    const serializedGroupChat = serializeBigInt(groupChat);

    res.json({
      success: true,
      data: serializedGroupChat
    });

  } catch (error) {
    console.error('Error in getGroupChat:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Update group chat (admin only)
async function updateGroupChat(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Group name is required' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

   
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        adminId: userId,
        isActive: true
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not the admin' 
      });
    }

    const updatedGroup = await prisma.groupChat.update({
      where: { id: BigInt(id) },
      data: {
        name,
        description,
        updatedAt: new Date()
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
                avatar: true
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
    });

    const serializedUpdatedGroup = serializeBigInt(updatedGroup);

    res.json({
      success: true,
      data: serializedUpdatedGroup
    });

  } catch (error) {
    console.error('Error in updateGroupChat:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Delete group chat (admin only)
async function deleteGroupChat(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        adminId: userId,
        isActive: true
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not the admin' 
      });
    }

    // Soft delete by setting isActive to false
    await prisma.groupChat.update({
      where: { id: BigInt(id) },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Group chat deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteGroupChat:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Add participants to group chat (admin only)
async function addParticipants(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'User IDs array is required' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

  
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        adminId: userId,
        isActive: true
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not the admin' 
      });
    }

    
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        organizationId: user.organizationId,
        isActive: true
      }
    });

    if (users.length !== userIds.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Some users not found or not in organization' 
      });
    }

    
    const participants = await prisma.groupChatParticipant.createMany({
      data: userIds.map(userId => ({
        userId,
        groupChatId: BigInt(id),
        organizationId: user.organizationId
      })),
      skipDuplicates: true
    });

    res.json({
      success: true,
      message: `Added ${participants.count} participants to group`,
      data: { addedCount: participants.count }
    });

  } catch (error) {
    console.error('Error in addParticipants:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Remove participants from group chat (admin only)
async function removeParticipants(req, res) {
  console.log("removeParticipants");
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'User IDs array is required' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        adminId: userId,
        isActive: true
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not the admin' 
      });
    }


    await prisma.groupChatParticipant.deleteMany({
      where: {
        groupChatId: BigInt(id),
        userId: { in: userIds.map(id => parseInt(id)) }
      }
    });

    res.json({
      success: true,
      message: 'Participants removed from group successfully'
    });

  } catch (error) {
    console.error('Error in removeParticipants:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get group chat messages
async function getGroupChatMessages(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }


    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(id),
        userId,
        organizationId: user.organizationId,
        isActive: true
      }
    });

    if (!participant) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not a participant of this group' 
      });
    }

    const messages = await prisma.groupChatMessage.findMany({
      where: {
        groupChatId: BigInt(id),
        organizationId: user.organizationId
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Serialize BigInt values using utility function
    const serializedMessages = serializeBigInt(messages);

    res.json({
      success: true,
      data: serializedMessages.reverse().map(message => ({
        ...message,
        attachments: message.attachments.map(att => ({
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

  } catch (error) {
    console.error('Error in getGroupChatMessages:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Send message to group chat
async function sendGroupChatMessage(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Message content is required' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

   
    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(id),
        userId,
        organizationId: user.organizationId,
        isActive: true
      }
    });

    if (!participant) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not a participant of this group' 
      });
    }

  


    const message = await prisma.groupChatMessage.create({
      data: {
        groupChatId: BigInt(id),
        senderId: userId,
        content: content.trim(),
        organizationId: user.organizationId
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

   
    await prisma.groupChat.update({
      where: { id: BigInt(id) },
      data: { lastMessageAt: new Date() }
    });

    
    const serializedMessage = serializeBigInt(message);

    res.status(201).json({
      success: true,
      data: {
        ...serializedMessage,
        attachments: serializedMessage.attachments.map(att => ({
          id: att.id,
          fileName: att.fileName,
          fileUrl: att.filePath,
          filePath: att.filePath,
          mimeType: att.mimeType,
          size: att.size.toString(),
          createdAt: att.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Error in sendGroupChatMessage:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Leave group chat
async function leaveGroupChat(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

   
    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(id),
        userId,
        organizationId: user.organizationId,
        isActive: true
      }
    });

    if (!participant) {
      return res.status(404).json({ 
        success: false, 
        error: 'You are not a participant of this group' 
      });
    }


    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        adminId: userId,
        isActive: true
      }
    });

    if (groupChat) {
      return res.status(400).json({ 
        success: false, 
        error: 'Group admin cannot leave the group. Please delete the group or transfer admin role first.' 
      });
    }

   
    await prisma.groupChatParticipant.delete({
      where: {
        id: participant.id
      }
    });

    res.json({
      success: true,
      message: 'Successfully left the group chat'
    });

  } catch (error) {
    console.error('Error in leaveGroupChat:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  createGroupChat,
  getUserGroupChats,
  getGroupChat,
  updateGroupChat,
  deleteGroupChat,
  addParticipants,
  removeParticipants,
  getGroupChatMessages,
  sendGroupChatMessage,
  leaveGroupChat
};
