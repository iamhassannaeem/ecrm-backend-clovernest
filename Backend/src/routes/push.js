const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { registerFcmTokenHandler } = require('../controllers/pushController');

// Mobile app only: register device token for push notifications
router.post('/fcm/register', authenticateToken, registerFcmTokenHandler);

module.exports = router;

