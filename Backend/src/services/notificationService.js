const { prisma } = require('../config/database');
const { sendChatPush } = require('./firebase/fcmNotificationService');

class NotificationService {
  static async createChatNotification(senderId, recipientId, conversationId, messageContent, organizationId, attachmentInfo = null) {
    try {
      // Check for duplicate notification within the last 5 seconds
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const existingNotification = await prisma.notification.findFirst({
        where: {
          type: 'NEW_MESSAGE',
          recipientId,
          organizationId,
          createdAt: {
            gte: fiveSecondsAgo
          },
          metadata: {
            path: ['conversationId'],
            equals: conversationId.toString()
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // If duplicate exists, return it instead of creating a new one
      if (existingNotification) {
        console.log(`[NotificationService] Duplicate notification prevented for conversation ${conversationId}, recipient ${recipientId}`);
        if (global.io) {
          global.io.to(`user_${recipientId}`).emit('newNotification', {
            notification: {
              id: existingNotification.id,
              type: existingNotification.type,
              title: existingNotification.title,
              message: existingNotification.message,
              createdAt: existingNotification.createdAt,
              metadata: existingNotification.metadata
            }
          });
        }
        return existingNotification;
      }

      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true }
      });

    
      const metadata = {
        senderId,
        senderName: `${sender.firstName} ${sender.lastName || ''}`.trim(),
        conversationId: conversationId.toString(), 
        messagePreview: messageContent.substring(0, 50)
      };

      if (attachmentInfo) {
        metadata.hasAttachment = true;
        metadata.attachment = {
          id: attachmentInfo.id,
          fileName: attachmentInfo.fileName,
          mimeType: attachmentInfo.mimeType,
          size: attachmentInfo.size.toString(),
          fileType: attachmentInfo.mimeType.split('/')[0] 
        };
      } else {
        metadata.hasAttachment = false;
      }

      const notification = await prisma.notification.create({
        data: {
          type: 'NEW_MESSAGE',
          title: `New message from ${sender.firstName} ${sender.lastName || ''}`.trim(),
          message: messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent,
          recipientId,
          organizationId,
          metadata: metadata
        }
      });

      // Mobile push (FCM) - do not block socket/web behavior
      sendChatPush({ notification }).catch((err) => {
        console.error('[FCM] createChatNotification sendChatPush error:', err);
      });

      if (global.io) {
        global.io.to(`user_${recipientId}`).emit('newNotification', {
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
      console.error('Error creating chat notification:', error);
      throw error;
    }
  }

  static async createGroupChatNotification(senderId, recipientId, groupId, messageContent, organizationId, attachmentInfo = null) {
    try {
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true }
      });

      const group = await prisma.groupChat.findUnique({
        where: { id: BigInt(groupId) },
        select: { name: true }
      });

    
      const metadata = {
        senderId,
        groupId: groupId.toString(),
        messagePreview: messageContent.substring(0, 50),
        groupName: group.name
      };

     
      if (attachmentInfo) {
        metadata.hasAttachment = true;
        metadata.attachment = {
          id: attachmentInfo.id,
          fileName: attachmentInfo.fileName,
          mimeType: attachmentInfo.mimeType,
          size: attachmentInfo.size.toString(), 
          fileType: attachmentInfo.mimeType.split('/')[0] 
        };
      } else {
        metadata.hasAttachment = false;
      }

      const notification = await prisma.notification.create({
        data: {
          type: 'NEW_GROUP_MESSAGE',
          title: `New message in ${group.name}`,
          message: `${sender.firstName} ${sender.lastName || ''}: ${messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent}`,
          recipientId,
          organizationId,
          metadata: metadata
        }
      });

      // Mobile push (FCM) - do not block socket/web behavior
      sendChatPush({ notification }).catch((err) => {
        console.error('[FCM] createGroupChatNotification sendChatPush error:', err);
      });

      return notification;
    } catch (error) {
      console.error('Error creating group chat notification:', error);
      throw error;
    }
  }

  static async createLeadAssignmentNotification(leadId, assignedToId, assignedById, organizationId, options = {}) {
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
      const isRoleBased = options.isRoleBased || false;
      
      const message = isRoleBased
        ? `Lead for ${customerName} (${lead.email}) has been assigned to your role. Click to proceed and claim this lead.`
        : `Lead for ${customerName} (${lead.email}) has been assigned to you by ${assignedBy.firstName} ${assignedBy.lastName || ''}`.trim();
      
      const notification = await prisma.notification.create({
        data: {
          type: 'LEAD_ASSIGNED',
          title: isRoleBased ? 'New Lead Available ' : 'New Lead Assigned',
          message: message,
          recipientId: assignedToId,
          organizationId,
          metadata: {
            leadId,
            assignedById,
            customerName: customerName,
            customerEmail: lead.email,
            isRoleBased: isRoleBased,
            requiresProceed: options.requiresProceed || false,
            allAssignedUserIds: options.allAssignedUserIds || []
          }
        }
      });

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

  static async createQARecordingAssignmentNotification(recordingIds, assignedToId, assignedById, organizationId) {
    try {
      const [assignedTo, assignedBy, recordings] = await Promise.all([
        prisma.user.findUnique({
          where: { id: assignedToId },
          select: { firstName: true, lastName: true }
        }),
        prisma.user.findUnique({
          where: { id: assignedById },
          select: { firstName: true, lastName: true }
        }),
        prisma.qARecording.findMany({
          where: { id: { in: recordingIds.map(id => parseInt(id)) } },
          include: {
            lead: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        })
      ]);

      if (!assignedTo || !assignedBy) {
        throw new Error('User not found');
      }

      const recordingCount = recordings.length;
      const leadNames = recordings
        .map(rec => rec.lead ? `${rec.lead.firstName} ${rec.lead.lastName}`.trim() : 'Unknown')
        .filter((name, index, self) => self.indexOf(name) === index)
        .slice(0, 3);

      const leadNamesText = leadNames.length > 0 
        ? leadNames.join(', ') + (recordings.length > 3 ? ' and more' : '')
        : 'recordings';

      const message = recordingCount === 1
        ? `QA recording for ${leadNames[0] || 'a lead'} has been assigned to you by ${assignedBy.firstName} ${assignedBy.lastName || ''}`.trim()
        : `${recordingCount} QA recording(s) for ${leadNamesText} have been assigned to you by ${assignedBy.firstName} ${assignedBy.lastName || ''}`.trim();

      const notification = await prisma.notification.create({
        data: {
          type: 'QA_RECORDING_ASSIGNED',
          title: recordingCount === 1 ? 'New lead for QA validation received' : 'New leads for QA validation received',
          message: message,
          recipientId: assignedToId,
          organizationId,
          metadata: {
            recordingIds: recordingIds,
            assignedById,
            recordingCount,
            leadNames: leadNames
          }
        }
      });

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
        console.log(`[NotificationService] QA recording assignment notification sent via socket to user ${assignedToId}`);
      } else {
        console.warn('[NotificationService] Socket.IO instance not available for QA recording assignment notification');
      }

      return notification;
    } catch (error) {
      console.error('Error creating QA recording assignment notification:', error);
      throw error;
    }
  }

  static async createQAReevaluationNotification(recordingId, evaluatedById, reassignedById, organizationId, comment) {
    try {
      const [evaluatedBy, reassignedBy, recording] = await Promise.all([
        prisma.user.findUnique({
          where: { id: evaluatedById },
          select: { firstName: true, lastName: true }
        }),
        prisma.user.findUnique({
          where: { id: reassignedById },
          select: { firstName: true, lastName: true }
        }),
        prisma.qARecording.findUnique({
          where: { id: recordingId },
          include: {
            lead: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        })
      ]);

      if (!evaluatedBy || !reassignedBy) {
        throw new Error('User not found');
      }

      const leadName = recording?.lead 
        ? `${recording.lead.firstName} ${recording.lead.lastName}`.trim()
        : 'a lead';

      const message = `Your evaluation failed. ${comment ? `Comment: ${comment}` : 'Please read the comment and reevaluate.'}`;

      const notification = await prisma.notification.create({
        data: {
          type: 'QA_EVALUATION_REJECTED',
          title: 'QA Evaluation Rejected - Reevaluation Required',
          message: message,
          recipientId: evaluatedById,
          organizationId,
          metadata: {
            recordingId,
            leadId: recording?.lead?.id || null,
            reassignedById,
            comment,
            leadName
          }
        }
      });

      if (global.io) {
        global.io.to(`user_${evaluatedById}`).emit('newNotification', {
          notification: {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            createdAt: notification.createdAt,
            metadata: notification.metadata
          }
        });
        console.log(`[NotificationService] QA reevaluation notification sent via socket to user ${evaluatedById}`);
      } else {
        console.warn('[NotificationService] Socket.IO instance not available for QA reevaluation notification');
      }

      return notification;
    } catch (error) {
      console.error('Error creating QA reevaluation notification:', error);
      throw error;
    }
  }

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

  static async broadcastToOrganization(organizationId, notificationData) {
    try {

      console.log(`Broadcasting notification to organization ${organizationId}:`, notificationData);
      return true;
    } catch (error) {
      console.error('Error broadcasting notification:', error);
      throw error;
    }
  }

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