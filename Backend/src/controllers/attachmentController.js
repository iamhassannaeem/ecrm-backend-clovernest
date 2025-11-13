const { prisma } = require('../config/database');
const backblazeService = require('../services/backblazeService');

async function createAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId, messageId } = req.params;
    const { organizationId, fileUrl, fileName, mimeType, size } = req.body;

    if (!fileUrl || !fileName || !mimeType || !size) {
      return res.status(400).json({
        success: false,
        error: 'fileUrl, fileName, mimeType, and size are required'
      });
    }

    const conversation = await prisma.chatSession.findFirst({
      where: {
        id: conversationId,
        organizationId: parseInt(organizationId),
        participants: {
          some: { userId }
        }
      }
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation'
      });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: parseInt(messageId),
        chatSessionId: conversationId,
        senderId: userId,
        organizationId: parseInt(organizationId)
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found or access denied'
      });
    }

    const attachment = await prisma.attachment.create({
      data: {
        organizationId: parseInt(organizationId),
        userId: userId,
        messageId: parseInt(messageId),
        fileName: fileName,
        filePath: fileUrl,
        mimeType: mimeType,
        size: BigInt(size)
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.filePath,
        filePath: attachment.filePath,
        mimeType: attachment.mimeType,
        size: attachment.size.toString(),
        createdAt: attachment.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function createGroupAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { groupId, messageId } = req.params;
    const { organizationId, fileUrl, fileName, mimeType, size } = req.body;

    if (!fileUrl || !fileName || !mimeType || !size) {
      return res.status(400).json({
        success: false,
        error: 'fileUrl, fileName, mimeType, and size are required'
      });
    }

    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(groupId),
        userId: userId,
        organizationId: parseInt(organizationId),
        isActive: true
      }
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this group chat'
      });
    }

    const message = await prisma.groupChatMessage.findFirst({
      where: {
        id: parseInt(messageId),
        groupChatId: BigInt(groupId),
        senderId: userId,
        organizationId: parseInt(organizationId)
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found or access denied'
      });
    }

    const attachment = await prisma.attachment.create({
      data: {
        organizationId: parseInt(organizationId),
        userId: userId,
        groupMessageId: parseInt(messageId),
        fileName: fileName,
        filePath: fileUrl,
        mimeType: mimeType,
        size: BigInt(size)
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.filePath,
        filePath: attachment.filePath,
        mimeType: attachment.mimeType,
        size: attachment.size.toString(),
        createdAt: attachment.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating group attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function getAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { attachmentId } = req.params;

    if (!attachmentId || isNaN(parseInt(attachmentId))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid attachment ID'
      });
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        OR: [
          {
            id: parseInt(attachmentId),
            message: {
              chatSession: {
                participants: {
                  some: { userId }
                }
              }
            }
          },
          {
            id: parseInt(attachmentId),
            groupMessage: {
              groupChat: {
                participants: {
                  some: { userId }
                }
              }
            }
          }
        ]
      }
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found or access denied'
      });
    }

    const key = backblazeService.extractKeyFromUrl(attachment.filePath);
    
    if (key) {
      const viewUrl = await backblazeService.generatePresignedViewUrl(key);
      return res.redirect(viewUrl);
    }

    res.json({
      success: true,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.filePath,
        filePath: attachment.filePath,
        mimeType: attachment.mimeType,
        size: attachment.size.toString(),
        createdAt: attachment.createdAt
      }
    });

  } catch (error) {
    console.error('Error getting attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function getMessageAttachments(req, res) {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { type } = req.query;

    let attachments;

    if (type === 'group') {
      const message = await prisma.groupChatMessage.findFirst({
        where: {
          id: parseInt(messageId)
        },
        include: {
          groupChat: {
            include: {
              participants: {
                where: { userId }
              }
            }
          }
        }
      });

      if (!message || message.groupChat.participants.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this message'
        });
      }

      attachments = await prisma.attachment.findMany({
        where: {
          groupMessageId: parseInt(messageId)
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
    } else {
      const message = await prisma.message.findFirst({
        where: {
          id: parseInt(messageId)
        },
        include: {
          chatSession: {
            include: {
              participants: {
                where: { userId }
              }
            }
          }
        }
      });

      if (!message || message.chatSession.participants.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this message'
        });
      }

      attachments = await prisma.attachment.findMany({
        where: {
          messageId: parseInt(messageId)
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
    }

    res.json({
      success: true,
      data: attachments.map(attachment => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.filePath,
        filePath: attachment.filePath,
        mimeType: attachment.mimeType,
        size: attachment.size.toString(),
        createdAt: attachment.createdAt
      }))
    });

  } catch (error) {
    console.error('Error getting message attachments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function deleteAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { attachmentId } = req.params;

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        userId: userId
      }
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found or access denied'
      });
    }

    const key = backblazeService.extractKeyFromUrl(attachment.filePath);
    if (key) {
      await backblazeService.deleteFile(key);
    }

    await prisma.attachment.delete({
      where: {
        id: attachment.id
      }
    });

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function createAttachmentWithMessage(req, res) {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;
    const { conversationId } = req.params;
    const { content = '', fileUrl, fileName, mimeType, size } = req.body;

    if (!fileUrl || !fileName || !mimeType || !size) {
      return res.status(400).json({
        success: false,
        error: 'fileUrl, fileName, mimeType, and size are required'
      });
    }

    const conversation = await prisma.chatSession.findFirst({
      where: {
        id: conversationId,
        organizationId: organizationId,
        participants: {
          some: { userId }
        }
      }
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation'
      });
    }

    const message = await prisma.message.create({
      data: {
        chatSessionId: conversationId.toString(),
        senderId: userId,
        content: content || `📎 ${fileName}`,
        organizationId: organizationId
      }
    });

    const attachment = await prisma.attachment.create({
      data: {
        organizationId: organizationId,
        userId: userId,
        messageId: message.id,
        fileName: fileName,
        filePath: fileUrl,
        mimeType: mimeType,
        size: BigInt(size)
      }
    });

    await prisma.chatSession.update({
      where: { id: conversationId },
      data: { 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.status(201).json({
      success: true,
      data: {
        messageId: message.id,
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.filePath,
          mimeType: attachment.mimeType,
          size: attachment.size.toString(),
          createdAt: attachment.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error creating attachment with message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function createGroupAttachmentWithMessage(req, res) {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;
    const { groupId } = req.params;
    const { content = '', fileUrl, fileName, mimeType, size } = req.body;

    if (!fileUrl || !fileName || !mimeType || !size) {
      return res.status(400).json({
        success: false,
        error: 'fileUrl, fileName, mimeType, and size are required'
      });
    }

    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(groupId),
        userId: userId,
        organizationId: organizationId,
        isActive: true
      }
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this group chat'
      });
    }

    const message = await prisma.groupChatMessage.create({
      data: {
        groupChatId: BigInt(groupId),
        senderId: userId,
        content: content || `📎 ${fileName}`,
        organizationId: organizationId
      }
    });

    const attachment = await prisma.attachment.create({
      data: {
        organizationId: organizationId,
        userId: userId,
        groupMessageId: message.id,
        fileName: fileName,
        filePath: fileUrl,
        mimeType: mimeType,
        size: BigInt(size)
      }
    });

    await prisma.groupChat.update({
      where: { id: BigInt(groupId) },
      data: { lastMessageAt: new Date() }
    });

    res.status(201).json({
      success: true,
      data: {
        messageId: message.id,
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.filePath,
          mimeType: attachment.mimeType,
          size: attachment.size.toString(),
          createdAt: attachment.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error creating group attachment with message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  createAttachment,
  createGroupAttachment,
  createAttachmentWithMessage,
  createGroupAttachmentWithMessage,
  getAttachment,
  getMessageAttachments,
  deleteAttachment
};
