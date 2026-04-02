const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, requireOrgAdmin } = require('../middleware/auth');
const { requestDevice, approveDevice, unapproveDevice, updateDeviceControls, getDeviceStatus } = require('../controllers/mobileController');

const router = express.Router();

// Public endpoint for mobile device registration request (pre-login)
router.post(
  '/request-device',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('device_id').notEmpty().withMessage('device_id is required'),
    body('device_name').notEmpty().withMessage('device_name is required'),
    body('platform').isIn(['android', 'ios']).withMessage('platform must be android or ios'),
    body('name').optional().isString(),
  ],
  requestDevice
);

// Protected endpoint for org admins/settings managers to approve a device
router.post(
  '/approve-device',
  authenticateToken,
  requireOrgAdmin,
  [body('device_id').notEmpty().withMessage('device_id is required')],
  approveDevice
);

router.post(
  '/unapprove-device',
  authenticateToken,
  requireOrgAdmin,
  [body('device_id').notEmpty().withMessage('device_id is required')],
  unapproveDevice
);

router.patch(
  '/devices/:deviceId',
  authenticateToken,
  requireOrgAdmin,
  [
    body('allowed_ips').optional().isArray(),
    body('apply_org_ips').optional().isBoolean(),
    body('apply_user_ips').optional().isBoolean(),
  ],
  updateDeviceControls
);

// Public: check device request/approval status via x-device-id header
router.get('/device-status', getDeviceStatus);

module.exports = router;

