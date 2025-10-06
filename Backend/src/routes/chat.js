const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const groupChatController = require('../controllers/groupChatController');
const { authenticateToken } = require('../middleware/auth'); 

// Get all contacts in organization
router.get('/contacts', authenticateToken, chatController.getContacts);

// Get or create conversation between two users
router.post('/conversations', authenticateToken, chatController.getOrCreateConversation);
router.post('/session', authenticateToken, chatController.getOrCreateConversation); // Alias for compatibility

// Get user's conversations list
router.get('/conversations', authenticateToken, chatController.getUserConversations);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', authenticateToken, chatController.getMessages);
router.get('/session/:conversationId/messages', authenticateToken, chatController.getMessages); // Alias for compatibility

// Send a message in a conversation
router.post('/conversations/:conversationId/messages', authenticateToken, chatController.sendMessage);
router.post('/session/:conversationId/message', authenticateToken, chatController.sendMessage); // Alias for compatibility

// Mark messages as read in a conversation
router.patch('/conversations/:conversationId/read', authenticateToken, chatController.markMessagesAsRead);

// Online status routes
router.get('/online-status', authenticateToken, chatController.getOnlineStatus);
router.get('/online-status/:userId', authenticateToken, chatController.getUserOnlineStatus);

// Group Chat routes
router.get('/groups', authenticateToken, groupChatController.getUserGroupChats);
router.post('/groups/create', authenticateToken, groupChatController.createGroupChat);
router.get('/groups/:id', authenticateToken, groupChatController.getGroupChat);
router.put('/groups/:id/update', authenticateToken, groupChatController.updateGroupChat);
router.delete('/groups/:id/delete', authenticateToken, groupChatController.deleteGroupChat);
router.get('/groups/:id/participants', authenticateToken, groupChatController.getGroupChat);
router.post('/groups/:id/participants/add', authenticateToken, groupChatController.addParticipants);
router.post('/groups/:id/participants/remove', authenticateToken, groupChatController.removeParticipants);
router.get('/groups/:id/messages', authenticateToken, groupChatController.getGroupChatMessages);
router.post('/groups/:id/message', authenticateToken, groupChatController.sendGroupChatMessage);

// Leave group chat
router.post('/groups/:id/leave', authenticateToken, groupChatController.leaveGroupChat);

module.exports = router; 