const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachmentController');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// Upload attachment for one-to-one chat message (with message ID)
router.post(
  '/chat/:conversationId/messages/:messageId/upload',
  authenticateToken,
  uploadSingle,
  handleUploadError,
  attachmentController.uploadAttachment
);

// Upload attachment for one-to-one chat (direct to conversation - creates message)
router.post(
  '/chat/:conversationId/upload',
  authenticateToken,
  uploadSingle,
  handleUploadError,
  attachmentController.uploadAttachmentToConversation
);

// Upload attachment for group chat message (with message ID)
router.post(
  '/group/:groupId/messages/:messageId/upload',
  authenticateToken,
  uploadSingle,
  handleUploadError,
  attachmentController.uploadGroupAttachment
);

// Upload attachment for group chat (direct to group - creates message)
router.post(
  '/group/:groupId/upload',
  authenticateToken,
  uploadSingle,
  handleUploadError,
  attachmentController.uploadAttachmentToGroup
);

// Handle preflight requests for attachments
router.options('/:attachmentId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Get attachment file
router.get(
  '/:attachmentId',
  authenticateToken,
  attachmentController.getAttachment
);

// Get attachments for a message
router.get(
  '/message/:messageId',
  authenticateToken,
  attachmentController.getMessageAttachments
);

// Delete attachment
router.delete(
  '/:attachmentId',
  authenticateToken,
  attachmentController.deleteAttachment
);

module.exports = router;
