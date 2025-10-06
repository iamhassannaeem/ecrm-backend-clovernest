const { prisma } = require('../config/database');

class NotificationService {
  // Create a notification for a new chat message
  static async createChatNotification(senderId, recipientId, conversationId, messageContent, organizationId) {
    try {
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true }
      });

      const notification = await prisma.notification.create({
        data: {
          type: 'NEW_MESSAGE',
          title: `New message from ${sender.firstName} ${sender.lastName || ''}`.trim(),
          message: messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent,
          recipientId,
          organizationId,
          metadata: {
            senderId,
            conversationId: conversationId.toString(), // Convert BigInt to string
            messagePreview: messageContent.substring(0, 50)
          }
        }
      });

      return notification;
    } catch (error) {
      console.error('Error creating chat notification:', error);
      throw error;
    }
  }

  // Create a notification for a new group chat message
  static async createGroupChatNotification(senderId, recipientId, groupId, messageContent, organizationId) {
    try {
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true }
      });

      const group = await prisma.groupChat.findUnique({
        where: { id: BigInt(groupId) },
        select: { name: true }
      });

      const notification = await prisma.notification.create({
        data: {
          type: 'NEW_GROUP_MESSAGE',
          title: `New message in ${group.name}`,
          message: `${sender.firstName} ${sender.lastName || ''}: ${messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent}`,
          recipientId,
          organizationId,
          metadata: {
            senderId,
            groupId: groupId.toString(),
            messagePreview: messageContent.substring(0, 50),
            groupName: group.name
          }
        }
      });

      return notification;
    } catch (error) {
      console.error('Error creating group chat notification:', error);
      throw error;
    }
  }

  // Create a notification for lead assignment
  static async createLeadAssignmentNotification(leadId, assignedToId, assignedById, organizationId) {
    try {
      const [lead, assignedTo, assignedBy] = await Promise.all([
        prisma.lead.findUnique({
          where: { id: leadId },
          select: { firstName: true, lastName: true, email: true }
        }),
        prisma.user.findUnique({
          where: { id: assignedToId },
          select: { firstName: true, lastName: true }
        }),
        prisma.user.findUnique({
          where: { id: assignedById },
          select: { firstName: true, lastName: true }
        })
      ]);

      const customerName = `${lead.firstName} ${lead.lastName}`.trim();
      const notification = await prisma.notification.create({
        data: {
          type: 'LEAD_ASSIGNED',
          title: 'New Lead Assigned',
          message: `Lead for ${customerName} (${lead.email}) has been assigned to you by ${assignedBy.firstName} ${assignedBy.lastName || ''}`.trim(),
          recipientId: assignedToId,
          organizationId,
          metadata: {
            leadId,
            assignedById,
            customerName: customerName,
            customerEmail: lead.email
          }
        }
      });

      // Emit notification via socket for real-time delivery
      if (global.io) {
        global.io.to(`user_${assignedToId}`).emit('newNotification', {
          notification: {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            createdAt: notification.createdAt,
            metadata: notification.metadata
          }
        });
        console.log(`[NotificationService] Lead assignment notification sent via socket to user ${assignedToId}`);
      } else {
        console.warn('[NotificationService] Socket.IO instance not available for lead assignment notification');
      }

      return notification;
    } catch (error) {
      console.error('Error creating lead assignment notification:', error);
      throw error;
    }
  }

  // Create a notification for lead status change
  static async createLeadStatusNotification(leadId, oldStatus, newStatus, updatedById, organizationId) {
    try {
      const [lead, updatedBy] = await Promise.all([
        prisma.lead.findUnique({
          where: { id: leadId },
          select: { firstName: true, lastName: true, email: true, assignedToId: true }
        }),
        prisma.user.findUnique({
          where: { id: updatedById },
          select: { firstName: true, lastName: true }
        })
      ]);

      const customerName = `${lead.firstName} ${lead.lastName}`.trim();
      const notification = await prisma.notification.create({
        data: {
          type: 'LEAD_STATUS_CHANGED',
          title: 'Lead Status Updated',
          message: `Lead for ${customerName} status changed from ${oldStatus} to ${newStatus} by ${updatedBy.firstName} ${updatedBy.lastName || ''}`.trim(),
          recipientId: lead.assignedToId,
          organizationId,
          metadata: {
            leadId,
            oldStatus,
            newStatus,
            updatedById,
            customerName: customerName
          }
        }
      });

      // Emit notification via socket for real-time delivery
      if (global.io && lead.assignedToId) {
        global.io.to(`user_${lead.assignedToId}`).emit('newNotification', {
          notification: {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            createdAt: notification.createdAt,
            metadata: notification.metadata
          }
        });
        console.log(`[NotificationService] Lead status notification sent via socket to user ${lead.assignedToId}`);
      } else if (!global.io) {
        console.warn('[NotificationService] Socket.IO instance not available for lead status notification');
      }

      return notification;
    } catch (error) {
      console.error('Error creating lead status notification:', error);
      throw error;
    }
  }

  // Create a notification for new lead creation
  static async createNewLeadNotification(leadId, createdById, organizationId) {
    try {
      const [lead, createdBy] = await Promise.all([
        prisma.lead.findUnique({
          where: { id: leadId },
          select: { firstName: true, lastName: true, email: true, assignedToId: true }
        }),
        prisma.user.findUnique({
          where: { id: createdById },
          select: { firstName: true, lastName: true }
        })
      ]);

      // Notify the assigned user
      if (lead.assignedToId && lead.assignedToId !== createdById) {
        const customerName = `${lead.firstName} ${lead.lastName}`.trim();
        const notification = await prisma.notification.create({
          data: {
            type: 'LEAD_ASSIGNED',
            title: 'New Lead Created and Assigned',
            message: `New lead for ${customerName} (${lead.email}) has been created by ${createdBy.firstName} ${createdBy.lastName || ''}`.trim(),
            recipientId: lead.assignedToId,
            organizationId,
            metadata: {
              leadId,
              createdById,
              customerName: customerName,
              customerEmail: lead.email
            }
          }
        });

        // Emit notification via socket for real-time delivery
        if (global.io) {
          global.io.to(`user_${lead.assignedToId}`).emit('newNotification', {
            notification: {
              id: notification.id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              createdAt: notification.createdAt,
              metadata: notification.metadata
            }
          });
          console.log(`[NotificationService] New lead notification sent via socket to user ${lead.assignedToId}`);
        } else {
          console.warn('[NotificationService] Socket.IO instance not available for new lead notification');
        }

        return notification;
      }
    } catch (error) {
      console.error('Error creating new lead notification:', error);
      throw error;
    }
  }

  // Get unread notifications for a user
  static async getUnreadNotifications(userId, organizationId, limit = 20) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          recipientId: userId,
          organizationId,
          isRead: false,
          isDeleted: false
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return notifications;
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      throw error;
    }
  }

  // Mark notifications as read
  static async markNotificationsAsRead(userId, notificationIds) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          recipientId: userId
        },
        data: {
          isRead: true,
          updatedAt: new Date()
        }
      });

      return result;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  static async markAllNotificationsAsRead(userId, organizationId) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          recipientId: userId,
          organizationId,
          isRead: false
        },
        data: {
          isRead: true,
          updatedAt: new Date()
        }
      });

      return result;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete a notification
  static async deleteNotification(userId, notificationId) {
    try {
      const result = await prisma.notification.update({
        where: {
          id: notificationId,
          recipientId: userId
        },
        data: {
          isDeleted: true,
          updatedAt: new Date()
        }
      });

      return result;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Get notification count for a user
  static async getNotificationCount(userId, organizationId) {
    try {
      const count = await prisma.notification.count({
        where: {
          recipientId: userId,
          organizationId,
          isRead: false,
          isDeleted: false
        }
      });

      return count;
    } catch (error) {
      console.error('Error getting notification count:', error);
      throw error;
    }
  }

  // Broadcast notification to all online users in an organization
  static async broadcastToOrganization(organizationId, notificationData) {
    try {
      // This would be called from socket.io to broadcast to all online users
      // The actual broadcasting is handled in socket.js
      console.log(`Broadcasting notification to organization ${organizationId}:`, notificationData);
      return true;
    } catch (error) {
      console.error('Error broadcasting notification:', error);
      throw error;
    }
  }

  // Get recent notifications for a user
  static async getRecentNotifications(userId, organizationId, limit = 50) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          recipientId: userId,
          organizationId,
          isDeleted: false
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return notifications;
    } catch (error) {
      console.error('Error getting recent notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService; 