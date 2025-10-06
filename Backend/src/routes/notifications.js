const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all notifications for the current user
router.get('/', notificationController.getUserNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Mark chat messages as read (when user opens chat)
router.patch('/chat/:conversationId/read', notificationController.markChatMessagesAsRead);

module.exports = router; 