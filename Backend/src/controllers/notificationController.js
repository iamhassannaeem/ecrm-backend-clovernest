const { prisma } = require('../config/database');
const NotificationService = require('../services/notificationService');


async function getUserNotifications(req, res) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;

    const whereClause = {
      recipientId: userId,
      isDeleted: false,
      ...(unreadOnly === 'true' && { isRead: false })
    };

    const [notifications, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true
            }
          }
        }
      }),
      prisma.notification.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}


async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    console.log('[Notification] markAsRead - userId:', userId, 'id:', id, 'id type:', typeof id);
    
    if (!id) {
      console.error('[Notification] markAsRead - Missing notification ID');
      return res.status(400).json({ 
        success: false, 
        error: 'Notification ID is required' 
      });
    }

    const notificationId = parseInt(id);
    if (isNaN(notificationId)) {
      console.error('[Notification] markAsRead - Invalid notification ID:', id);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid notification ID' 
      });
    }
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
        isDeleted: false
      }
    });

    if (!notification) {
     
      return res.status(404).json({ 
        success: false,
        error: 'Notification not found' 
      });
    }
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

      res.json({ 
      success: true, 
      message: 'Notification marked as read' 
    });
  } catch (error) {
    console.error('[Notification] Error in markAsRead:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}


async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
        isDeleted: false
      },
      data: { isRead: true }
    });

    res.json({ 
      success: true, 
      message: 'All notifications marked as read' 
    });
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}


async function deleteNotification(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id) {
      console.error('[Notification] deleteNotification - Missing notification ID');
      return res.status(400).json({ 
        success: false, 
        error: 'Notification ID is required' 
      });
    }

    const notificationId = parseInt(id);
    if (isNaN(notificationId)) {
      console.error('[Notification] deleteNotification - Invalid notification ID:', id);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid notification ID' 
      });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId
      }
    });

    if (!notification) {
     
      return res.status(404).json({ 
        success: false,
        error: 'Notification not found' 
      });
    }

   

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isDeleted: true }
    });

   

    res.json({ 
      success: true, 
      message: 'Notification deleted' 
    });
  } catch (error) {
    console.error('[Notification] Error in deleteNotification:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}


async function getUnreadCount(req, res) {
  try {
    const userId = req.user.id;

    const count = await prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false,
        isDeleted: false
      }
    });

    res.json({ 
      success: true, 
      unreadCount: count 
    });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}


async function createNotification(data) {
  try {
    if (!prisma) {
      console.error('Prisma is not available for creating notification');
      return null;
    }
    
    const notification = await prisma.notification.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        recipientId: data.recipientId,
        organizationId: data.organizationId,
        metadata: data.metadata || null
      },
      include: {
        recipient: {
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
    if (global.io) {
      global.io.to(`user_${data.recipientId}`).emit('newNotification', {
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt,
          metadata: notification.metadata
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

async function createLeadAssignmentNotification(leadId, assignedToId, assignedById, organizationId) {
  try {
    return await NotificationService.createLeadAssignmentNotification(leadId, assignedToId, assignedById, organizationId);
  } catch (error) {
    console.error('Error creating lead assignment notification:', error);
  }
}

async function createChatMessageNotification(senderId, recipientId, conversationId, messageContent, organizationId, chatType = 'DIRECT') {
  try {
    if (chatType === 'GROUP_CHAT') {
      return await NotificationService.createGroupChatNotification(senderId, recipientId, conversationId, messageContent, organizationId);
    } else {
      return await NotificationService.createChatNotification(senderId, recipientId, conversationId, messageContent, organizationId);
    }
  } catch (error) {
    console.error('Error creating chat message notification:', error);
  }
}


async function markChatMessagesAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        type: 'NEW_MESSAGE',
        isRead: false,
        metadata: {
          path: ['conversationId'],
          equals: parseInt(conversationId)
        }
      },
      data: { isRead: true }
    });

    res.json({ 
      success: true, 
      message: 'Chat messages marked as read' 
    });
  } catch (error) {
    console.error('Error in markChatMessagesAsRead:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  createNotification,
  createLeadAssignmentNotification,
  createChatMessageNotification,
  markChatMessagesAsRead
}; 