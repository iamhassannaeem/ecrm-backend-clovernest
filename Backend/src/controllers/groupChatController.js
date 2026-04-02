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

    // Get user with roles to check isAgent
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        organizationId: true,
        roles: {
          select: {
            isAgent: true
          }
        }
      }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    // Requirement 4: Check if user has isAgent=false (users with isAgent=true cannot create groups)
    const isAgent = user.roles && user.roles.some(role => role.isAgent === true);
    if (isAgent) {
      return res.status(403).json({ 
        success: false, 
        error: 'Users with agent role cannot create groups' 
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

    // Create group chat with participants and automatically assign creator as group admin
    const groupChat = await prisma.groupChat.create({
      data: {
        name,
        description,
        organizationId: user.organizationId,
        adminId: userId, // Keep for backward compatibility
        participants: {
          create: [
            { userId, organizationId: user.organizationId },
            ...userIds.filter(id => id !== userId).map(id => ({
              userId: id,
              organizationId: user.organizationId
            }))
          ]
        },
        // Requirement 4 & 6: Automatically create group admin entry for creator
        groupAdmins: {
          create: {
            userId: userId,
            organizationId: user.organizationId,
            createdBy: userId
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

    // Create a system message indicating who created the group
    const creatorName = groupChat.admin.firstName && groupChat.admin.lastName
      ? `${groupChat.admin.firstName} ${groupChat.admin.lastName}`
      : groupChat.admin.firstName || groupChat.admin.email || 'Someone';
    
    await prisma.groupChatMessage.create({
      data: {
        groupChatId: groupChat.id,
        senderId: userId, // Use creator's ID for system message
        content: `[SYSTEM] ${creatorName} created this group`,
        organizationId: user.organizationId
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
      select: { 
        organizationId: true,
        roles: {
          select: {
            name: true
          }
        }
      }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    // Requirement 2 & 7: ORGANIZATION_ADMIN can see all groups, others see only groups where they are members
    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    
    // Requirement 9: No need for read permission when user is member of group
    // Build where clause based on user role
    const whereClause = {
      organizationId: user.organizationId,
      isActive: true
    };

    if (!isOrgAdmin) {
      // Regular users can only see groups where they are members
      whereClause.participants = {
        some: {
          userId,
          isActive: true
        }
      };
    }
    // If isOrgAdmin, no participant filter - can see all groups

    const groupChats = await prisma.groupChat.findMany({
      where: whereClause,
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
      select: { 
        organizationId: true,
        roles: {
          select: {
            name: true
          }
        }
      }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    // Requirement 2 & 7: ORGANIZATION_ADMIN can see all groups, others see only groups where they are members
    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    
    // Requirement 9: No need for read permission when user is member of group
    const whereClause = {
      id: BigInt(id),
      organizationId: user.organizationId,
      isActive: true
    };

    if (!isOrgAdmin) {
      // Regular users can only see groups where they are members
      whereClause.participants = {
        some: {
          userId
        }
      };
    }

    const groupChat = await prisma.groupChat.findFirst({
      where: whereClause,
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
    const { name, description, allowBuzz } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Group name is required' 
      });
    }

    // Check UPDATE permission for CREATE_GROUP_CHAT resource
    const permissions = await getUserPermissions(req.user);
    const canUpdateGroup = permissions.some(
      p => p.action === 'UPDATE' && p.resource === 'CREATE_GROUP_CHAT'
    );

    if (!canUpdateGroup) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions to update group chat' 
      });
    }

    const user = await prisma.user.findUnique({
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

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
   
    // Check if user is a group admin or ORGANIZATION_ADMIN
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        isActive: true,
        ...(isOrgAdmin ? {} : {
          groupAdmins: {
            some: {
              userId: userId
            }
          }
        })
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not an admin' 
      });
    }

    const updateData = {
      updatedAt: new Date()
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (allowBuzz !== undefined) updateData.allowBuzz = allowBuzz;

    const updatedGroup = await prisma.groupChat.update({
      where: { id: BigInt(id) },
      data: updateData,
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

    // Requirement 8: Even if user is admin of group, still need delete permission for group deletion
    const permissions = await getUserPermissions(req.user);
    const canDeleteGroup = permissions.some(
      p => p.action === 'DELETE' && p.resource === 'CREATE_GROUP_CHAT'
    );

    if (!canDeleteGroup) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions to delete group chat' 
      });
    }

    const user = await prisma.user.findUnique({
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

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

    // ORGANIZATION_ADMIN can delete any group in their organization, regardless of membership or admin status
    // Regular users must be group admins to delete
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        isActive: true,
        ...(isOrgAdmin ? {} : {
          // For non-ORGANIZATION_ADMIN, must be a group admin
          groupAdmins: {
            some: {
              userId: userId
            }
          }
        })
      }
    });

    if (!groupChat) {
      if (isOrgAdmin) {
        return res.status(404).json({ 
          success: false, 
          error: 'Group chat not found or does not belong to your organization' 
        });
      }
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not an admin' 
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

    // Check UPDATE permission for CREATE_GROUP_CHAT resource
    const permissions = await getUserPermissions(req.user);
    const canUpdateGroup = permissions.some(
      p => p.action === 'UPDATE' && p.resource === 'CREATE_GROUP_CHAT'
    );

    if (!canUpdateGroup) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions to add participants to group chat' 
      });
    }

    const user = await prisma.user.findUnique({
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

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

    // Check if user is a group admin or ORGANIZATION_ADMIN
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        isActive: true,
        ...(isOrgAdmin ? {} : {
          groupAdmins: {
            some: {
              userId: userId
            }
          }
        })
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not an admin' 
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

    // Get the admin who added the members
    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true
      }
    });

    // Get names of added users
    const addedUserNames = users.map(u => 
      (u.firstName && u.lastName) ? `${u.firstName} ${u.lastName}` : u.firstName || u.email || 'User'
    );

    // Create system message for each added member or a combined message
    const adminName = adminUser.firstName && adminUser.lastName
      ? `${adminUser.firstName} ${adminUser.lastName}`
      : adminUser.firstName || adminUser.email || 'Someone';
    
    const memberNamesText = addedUserNames.length === 1 
      ? addedUserNames[0]
      : addedUserNames.length === 2
      ? `${addedUserNames[0]} and ${addedUserNames[1]}`
      : `${addedUserNames.slice(0, -1).join(', ')}, and ${addedUserNames[addedUserNames.length - 1]}`;

    await prisma.groupChatMessage.create({
      data: {
        groupChatId: BigInt(id),
        senderId: userId, // Use admin's ID for system message
        content: `[SYSTEM] ${adminName} added ${memberNamesText} to the group`,
        organizationId: user.organizationId
      }
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

    // Check UPDATE permission for CREATE_GROUP_CHAT resource
    const permissions = await getUserPermissions(req.user);
    const canUpdateGroup = permissions.some(
      p => p.action === 'UPDATE' && p.resource === 'CREATE_GROUP_CHAT'
    );

    if (!canUpdateGroup) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions to remove participants from group chat' 
      });
    }

    const user = await prisma.user.findUnique({
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

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

    // Check if user is a group admin or ORGANIZATION_ADMIN
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        isActive: true,
        ...(isOrgAdmin ? {} : {
          groupAdmins: {
            some: {
              userId: userId
            }
          }
        })
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not an admin' 
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
    const { limit = 50, offset, page } = req.query;

    const user = await prisma.user.findUnique({
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

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

    // Requirement 9: No need for read permission when user is member of group
    // Check if user is a participant or ORGANIZATION_ADMIN
    if (!isOrgAdmin) {
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
    }

    // Support both page-based and offset-based pagination
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    let skip = 0;
    if (page !== undefined) {
      const parsedPage = Math.max(parseInt(page) || 1, 1);
      skip = (parsedPage - 1) * parsedLimit;
    } else if (offset !== undefined) {
      skip = parseInt(offset) || 0;
    }

    // Get total count for pagination
    const totalCount = await prisma.groupChatMessage.count({
      where: {
        groupChatId: BigInt(id),
        organizationId: user.organizationId
      }
    });

    // For WhatsApp-like behavior:
    // - Page 1: Get most recent messages (newest first, then reverse for display)
    // - Page 2+: Get older messages (newest first in that range, then reverse for display)
    // Query returns messages in DESC order (newest first), we'll reverse to ASC (oldest first) for display
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
        createdAt: 'desc' // Newest first
      },
      take: parsedLimit,
      skip: skip
    });

    // Serialize BigInt values using utility function
    const serializedMessages = serializeBigInt(messages);

    // Calculate pagination info
    const currentPage = page !== undefined ? Math.max(parseInt(page) || 1, 1) : Math.floor(skip / parsedLimit) + 1;
    const totalPages = Math.ceil(totalCount / parsedLimit);
    const hasNextPage = skip + parsedLimit < totalCount;

    // Reverse messages to get ascending order (oldest first) for WhatsApp-like display
    // Page 1: newest 15 → reverse → oldest to newest (correct)
    // Page 2: next 10 older → reverse → oldest to newest (correct, will be prepended)
    const sortedMessages = serializedMessages.reverse();

    res.json({
      success: true,
      messages: sortedMessages.map(message => {
        // Detect system messages by content pattern
        const isSystemMessage = message.content?.startsWith('[SYSTEM]') ||
          message.content?.includes('created this group') ||
          (message.content?.includes('added') && message.content?.includes('to the group'));
        
        return {
          ...message,
          messageType: isSystemMessage ? 'system' : (message.messageType || 'text'),
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
      }),
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage: currentPage > 1
      }
    });

  } catch (error) {
    console.error('Error in getGroupChatMessages:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Search messages in a group chat
async function searchGroupChatMessages(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { query, page = 1, limit = 50 } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query is required' 
      });
    }
    
    const user = await prisma.user.findUnique({
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
    
    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }
    
    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const searchTerm = query.trim();
    
    // Requirement 9: No need for read permission when user is member of group
    // Check if user is a participant or ORGANIZATION_ADMIN
    if (!isOrgAdmin) {
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
    }
    
    const [messages, totalCount] = await Promise.all([
      prisma.groupChatMessage.findMany({
        where: {
          groupChatId: BigInt(id),
          organizationId: user.organizationId,
          content: {
            contains: searchTerm,
            mode: 'insensitive'
          }
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
        take: parsedLimit,
        skip
      }),
      prisma.groupChatMessage.count({
        where: {
          groupChatId: BigInt(id),
          organizationId: user.organizationId,
          content: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      })
    ]);
    
    const totalPages = Math.ceil(totalCount / parsedLimit);
    const serializedMessages = serializeBigInt(messages);
    
    res.json({
      success: true,
      messages: serializedMessages.reverse().map(message => {
        // Detect system messages by content pattern
        const isSystemMessage = message.content?.startsWith('[SYSTEM]') ||
          message.content?.includes('created this group') ||
          (message.content?.includes('added') && message.content?.includes('to the group'));
        
        return {
          ...message,
          messageType: isSystemMessage ? 'system' : (message.messageType || 'text'),
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
      }),
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalCount,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1
      }
    });
    
  } catch (error) {
    console.error('Error in searchGroupChatMessages:', error);
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
      select: { 
        organizationId: true,
        roles: {
          select: {
            name: true
          }
        }
      }
    });

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

    // Requirement: ORGANIZATION_ADMIN can view and read all groups, but can only send messages if they are a participant
    // Check if user is a participant (required for sending messages, even for ORGANIZATION_ADMIN)
    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(id),
        userId,
        organizationId: user.organizationId,
        isActive: true
      }
    });

    if (!participant) {
      if (isOrgAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only send messages to groups where you are a member. You can view and read messages from all groups, but must be a participant to send messages.' 
        });
      }
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
      select: { 
        organizationId: true,
        roles: {
          select: {
            name: true
          }
        }
      }
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

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

    // Check if user is a group admin
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        isActive: true,
        ...(isOrgAdmin ? {} : {
          groupAdmins: {
            some: {
              userId: userId
            }
          }
        })
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

// Mark/unmark users as group admins (only by existing group admins)
async function updateGroupAdmins(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { userIds, action } = req.body; // action: 'add' or 'remove'

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User IDs array is required' 
      });
    }

    if (!action || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Action must be either "add" or "remove"' 
      });
    }

    const user = await prisma.user.findUnique({
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

    if (!user || !user.organizationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User not in any organization' 
      });
    }

    const isOrgAdmin = user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');

    // Requirement 6: Only group admins can mark another user as group admin
    const groupChat = await prisma.groupChat.findFirst({
      where: {
        id: BigInt(id),
        organizationId: user.organizationId,
        isActive: true,
        ...(isOrgAdmin ? {} : {
          groupAdmins: {
            some: {
              userId: userId
            }
          }
        })
      }
    });

    if (!groupChat) {
      return res.status(404).json({ 
        success: false, 
        error: 'Group chat not found or you are not an admin' 
      });
    }

    // Verify all users exist and are in the same organization
    const targetUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        organizationId: user.organizationId,
        isActive: true
      },
      include: {
        roles: {
          select: {
            isAgent: true
          }
        }
      }
    });

    if (targetUsers.length !== userIds.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Some users not found or not in organization' 
      });
    }

    // Requirement 3 & 6: Users with isAgent=true cannot be marked as group admin
    if (action === 'add') {
      const agentUsers = targetUsers.filter(u => 
        u.roles && u.roles.some(role => role.isAgent === true)
      );
      
      if (agentUsers.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Users with agent role cannot be marked as group admin' 
        });
      }

      // Check if users are participants of the group
      const participants = await prisma.groupChatParticipant.findMany({
        where: {
          groupChatId: BigInt(id),
          userId: { in: userIds },
          isActive: true
        }
      });

      // If ORGANIZATION_ADMIN, automatically add non-participants as participants first
      if (isOrgAdmin && participants.length !== userIds.length) {
        const missingUserIds = userIds.filter(id => 
          !participants.some(p => p.userId === id)
        );
        
        // Add missing users as participants
        await prisma.groupChatParticipant.createMany({
          data: missingUserIds.map(targetUserId => ({
            userId: targetUserId,
            groupChatId: BigInt(id),
            organizationId: user.organizationId,
            isActive: true
          })),
          skipDuplicates: true
        });
      } else if (!isOrgAdmin && participants.length !== userIds.length) {
        // For non-ORGANIZATION_ADMIN, all users must be participants
        return res.status(400).json({ 
          success: false, 
          error: 'All users must be participants of the group before being made admin' 
        });
      }

      // Add group admins
      const adminRecords = await prisma.groupChatAdmin.createMany({
        data: userIds.map(targetUserId => ({
          userId: targetUserId,
          groupChatId: BigInt(id),
          organizationId: user.organizationId,
          createdBy: userId
        })),
        skipDuplicates: true
      });

      res.json({
        success: true,
        message: `Added ${adminRecords.count} group admin(s)`,
        data: { addedCount: adminRecords.count }
      });
    } else {
      // Remove group admins
      const deletedCount = await prisma.groupChatAdmin.deleteMany({
        where: {
          groupChatId: BigInt(id),
          userId: { in: userIds }
        }
      });

      res.json({
        success: true,
        message: `Removed ${deletedCount.count} group admin(s)`,
        data: { removedCount: deletedCount.count }
      });
    }

  } catch (error) {
    console.error('Error in updateGroupAdmins:', error);
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
  searchGroupChatMessages,
  sendGroupChatMessage,
  leaveGroupChat,
  updateGroupAdmins
};
