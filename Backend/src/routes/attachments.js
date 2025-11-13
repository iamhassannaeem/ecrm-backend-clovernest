const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachmentController');
const { authenticateToken } = require('../middleware/auth');

router.post(
  '/chat/:conversationId/messages/:messageId',
  authenticateToken,
  attachmentController.createAttachment
);

router.post(
  '/chat/:conversationId',
  authenticateToken,
  attachmentController.createAttachmentWithMessage
);

router.post(
  '/group/:groupId/messages/:messageId',
  authenticateToken,
  attachmentController.createGroupAttachment
);

router.post(
  '/group/:groupId',
  authenticateToken,
  attachmentController.createGroupAttachmentWithMessage
);

router.options('/:attachmentId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

router.get(
  '/:attachmentId',
  authenticateToken,
  attachmentController.getAttachment
);

router.get(
  '/message/:messageId',
  authenticateToken,
  attachmentController.getMessageAttachments
);

router.delete(
  '/:attachmentId',
  authenticateToken,
  attachmentController.deleteAttachment
);

module.exports = router;
