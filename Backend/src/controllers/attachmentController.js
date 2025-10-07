const { prisma } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const { getFileInfo, cleanupFiles } = require('../middleware/upload');

// Upload file attachment for one-to-one chat
async function uploadAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId, messageId } = req.params;
    const { organizationId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Verify user has access to this conversation
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
      await cleanupFiles(req.file);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation'
      });
    }

    // Verify message exists and belongs to user
    const message = await prisma.message.findFirst({
      where: {
        id: parseInt(messageId),
        chatSessionId: conversationId,
        senderId: userId,
        organizationId: parseInt(organizationId)
      }
    });

    if (!message) {
      await cleanupFiles(req.file);
      return res.status(404).json({
        success: false,
        error: 'Message not found or access denied'
      });
    }

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        organizationId: organizationId,
        userId: userId,
        messageId: parseInt(messageId),
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        size: BigInt(req.file.size)
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size.toString(),
        createdAt: attachment.createdAt
      }
    });

  } catch (error) {
    console.error('Error uploading attachment:', error);
    await cleanupFiles(req.file);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Upload file attachment for group chat
async function uploadGroupAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { groupId, messageId } = req.params;
    const { organizationId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Verify user is participant in this group chat
    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(groupId),
        userId: userId,
        organizationId: organizationId,
        isActive: true
      }
    });

    if (!participant) {
      await cleanupFiles(req.file);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this group chat'
      });
    }

    // Verify message exists and belongs to user
    const message = await prisma.groupChatMessage.findFirst({
      where: {
        id: parseInt(messageId),
        groupChatId: BigInt(groupId),
        senderId: userId,
        organizationId: parseInt(organizationId)
      }
    });

    if (!message) {
      await cleanupFiles(req.file);
      return res.status(404).json({
        success: false,
        error: 'Message not found or access denied'
      });
    }

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        organizationId: organizationId,
        userId: userId,
        groupMessageId: parseInt(messageId),
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        size: BigInt(req.file.size)
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size.toString(),
        createdAt: attachment.createdAt
      }
    });

  } catch (error) {
    console.error('Error uploading group attachment:', error);
    await cleanupFiles(req.file);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Get attachment file
async function getAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { attachmentId } = req.params;

    // Validate attachmentId
    if (!attachmentId || isNaN(parseInt(attachmentId))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid attachment ID'
      });
    }

    // Get attachment with access verification
    const attachment = await prisma.attachment.findFirst({
      where: {
        OR: [
          // One-to-one chat attachment
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
          // Group chat attachment
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
      },
      include: {
        message: {
          include: {
            chatSession: {
              include: {
                participants: true
              }
            }
          }
        },
        groupMessage: {
          include: {
            groupChat: {
              include: {
                participants: true
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found or access denied'
      });
    }

    // Check if file exists
    const filePath = path.join(process.cwd(), attachment.filePath);
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }

    // Set appropriate headers with CORS support
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    res.setHeader('Content-Length', attachment.size.toString());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Last-Modified, ETag');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', `"${attachment.id}-${attachment.size}"`);

    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error getting attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Get attachments for a message
async function getMessageAttachments(req, res) {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { type } = req.query; // 'chat' or 'group'

    let attachments;

    if (type === 'group') {
      // Verify user has access to group message
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
      // Verify user has access to chat message
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

// Delete attachment
async function deleteAttachment(req, res) {
  try {
    const userId = req.user.id;
    const { attachmentId } = req.params;

    // Get attachment with access verification
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        userId: userId // Only allow user who uploaded to delete
      }
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found or access denied'
      });
    }

    // Delete file from filesystem
    try {
      const filePath = path.join(process.cwd(), attachment.filePath);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file from filesystem:', error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
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

// Upload file attachment directly to conversation (creates message)
async function uploadAttachmentToConversation(req, res) {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;
    const { conversationId } = req.params;
    const { content = '' } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Verify user has access to this conversation
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
      await cleanupFiles(req.file);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation'
      });
    }

    // Create a message first
    const message = await prisma.message.create({
      data: {
        chatSessionId: conversationId.toString(),
        senderId: userId,
        content: content || `📎 ${req.file.originalname}`,
        organizationId: organizationId
      }
    });

    // Move file from temp location to final location with message ID
    const finalPath = path.join(
      'uploads',
      `org_${organizationId}`,
      `user_${userId}`,
      `chat_${conversationId}`,
      `message_${message.id}`,
      path.basename(req.file.path)
    );

    // Create final directory and move file
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.rename(req.file.path, finalPath);

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        organizationId: organizationId,
        userId: userId,
        messageId: message.id,
        fileName: req.file.originalname,
        filePath: finalPath,
        mimeType: req.file.mimetype,
        size: BigInt(req.file.size)
      }
    });

    // Update conversation last message time
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
          mimeType: attachment.mimeType,
          size: attachment.size.toString(),
          createdAt: attachment.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error uploading attachment to conversation:', error);
    await cleanupFiles(req.file);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Upload file attachment directly to group chat (creates message)
async function uploadAttachmentToGroup(req, res) {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;
    const { groupId } = req.params;
    const { content = '' } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Verify user is participant in this group chat
    const participant = await prisma.groupChatParticipant.findFirst({
      where: {
        groupChatId: BigInt(groupId),
        userId: userId,
        organizationId: organizationId,
        isActive: true
      }
    });

    if (!participant) {
      await cleanupFiles(req.file);
      return res.status(403).json({
        success: false,
        error: 'Access denied to this group chat'
      });
    }

    // Create a message first
    const message = await prisma.groupChatMessage.create({
      data: {
        groupChatId: BigInt(groupId),
        senderId: userId,
        content: content || `📎 ${req.file.originalname}`,
        organizationId: organizationId
      }
    });

    // Move file from temp location to final location with message ID
    const finalPath = path.join(
      'uploads',
      `org_${organizationId}`,
      `user_${userId}`,
      `chat_${groupId}`,
      `message_${message.id}`,
      path.basename(req.file.path)
    );

    // Create final directory and move file
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.rename(req.file.path, finalPath);

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        organizationId: organizationId,
        userId: userId,
        groupMessageId: message.id,
        fileName: req.file.originalname,
        filePath: finalPath,
        mimeType: req.file.mimetype,
        size: BigInt(req.file.size)
      }
    });

    // Update group chat last message time
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
          mimeType: attachment.mimeType,
          size: attachment.size.toString(),
          createdAt: attachment.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error uploading attachment to group:', error);
    await cleanupFiles(req.file);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  uploadAttachment,
  uploadGroupAttachment,
  uploadAttachmentToConversation,
  uploadAttachmentToGroup,
  getAttachment,
  getMessageAttachments,
  deleteAttachment
};
