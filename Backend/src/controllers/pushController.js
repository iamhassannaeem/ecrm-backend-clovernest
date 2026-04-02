const { registerFcmToken } = require('../services/firebase/fcmTokenService');
const { logger } = require('../middleware/errorHandler');

async function registerFcmTokenHandler(req, res) {
  try {
    const userId = Number(req.user?.id);
    const organizationId = req.user?.organizationId ? Number(req.user.organizationId) : null;

    // Mobile apps sometimes send snake_case; accept both.
    const { token, platform, appVersion, fcm_token, device_name, os_version } = req.body || {};
    const resolvedToken = token || fcm_token;
    const resolvedAppVersion = appVersion || (req.body && req.body.app_version);

    if (!userId || Number.isNaN(userId)) {
      logger.warn({
        message: 'FCM register rejected: invalid user',
        path: req.originalUrl,
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : undefined,
      });
      return res.status(400).json({ success: false, error: 'Invalid user' });
    }

    if (!organizationId || Number.isNaN(organizationId)) {
      logger.warn({
        message: 'FCM register rejected: org missing in JWT',
        path: req.originalUrl,
        userId,
        organizationId: req.user?.organizationId,
        bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : undefined,
      });
      return res.status(400).json({ success: false, error: 'organizationId missing in JWT' });
    }

    if (!resolvedToken) {
      logger.warn({
        message: 'FCM register rejected: token missing',
        path: req.originalUrl,
        userId,
        organizationId,
        body: {
          // do NOT log token value; only show presence/metadata
          tokenPresent: Boolean(token),
          fcmTokenPresent: Boolean(fcm_token),
          platform: platform ?? null,
          appVersion: resolvedAppVersion ?? null,
          deviceName: device_name ?? null,
          osVersion: os_version ?? null,
        },
      });
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    const saved = await registerFcmToken({
      userId,
      organizationId,
      token: resolvedToken,
      platform,
      appVersion: resolvedAppVersion,
    });

    return res.json({ success: true, id: saved.id });
  } catch (error) {
    console.error('[pushController] registerFcmTokenHandler error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { registerFcmTokenHandler };

