const { prisma } = require('../config/database');
const { getClientIP, isIPAllowed } = require('../utils/accessControl');

function deny(res) {
  return res.status(403).json({ code: 'ACCESS_DENIED', message: 'Unauthorized access' });
}

function getHeaderDeviceIdStrict(req) {
  const hasHeader = Object.prototype.hasOwnProperty.call(req.headers || {}, 'x-device-id');
  const v = req.get('x-device-id');
  if (!hasHeader) return { present: false, value: null };
  const s = v != null ? String(v).trim() : '';
  return { present: true, value: s.length ? s : null };
}

function getTokenDeviceId(req) {
  const d = req.auth || {};
  // Support both naming conventions to avoid brittle coupling
  return d.device_id || d.deviceId || null;
}

async function accessControlMiddleware(req, res, next) {
  try {
    if (req.user?.isStoreTestUser === true) {
      return next();
    }
    // req.user and req.organizationId must be set by auth middleware
    const organizationId = Number(req.organizationId);
    if (!organizationId) {
      return deny(res);
    }

    const header = getHeaderDeviceIdStrict(req);
    if (header.present && !header.value) {
      return deny(res);
    }
    const headerDeviceId = header.value;
    const ip = getClientIP(req);
    const userAllowedIps = req.user?.allowedIps || req.user?.allowed_ips || [];

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, allowedIps: true, mobileAppEnabled: true },
    });
    if (!org) {
      return deny(res);
    }

    // MOBILE: identified ONLY by x-device-id header.
    // For mobile requests, enforce device allowlist always (if configured) and
    // org/user allowlists only when enabled for that specific device.
    if (headerDeviceId) {
      if (org.mobileAppEnabled === false) {
        return deny(res);
      }

      const device = await prisma.mobileDevice.findUnique({
        where: { deviceId: headerDeviceId },
        select: {
          organizationId: true,
          userId: true,
          isApproved: true,
          allowedIps: true,
          applyOrgIps: true,
          applyUserIps: true,
        },
      });

      if (!device) {
        return deny(res);
      }
      if (device.organizationId !== org.id) {
        return deny(res);
      }
      if (req.user?.id != null && device.userId !== req.user.id) {
        return deny(res);
      }
      if (!device.isApproved) {
        return deny(res);
      }

      // Org/user allowlists for mobile are optional and controlled per device.
      if (device.applyOrgIps && Array.isArray(org.allowedIps) && org.allowedIps.length > 0) {
        if (!isIPAllowed(ip, org.allowedIps)) return deny(res);
      }
      if (device.applyUserIps && Array.isArray(userAllowedIps) && userAllowedIps.length > 0) {
        if (!isIPAllowed(ip, userAllowedIps)) return deny(res);
      }

      if (Array.isArray(device.allowedIps) && device.allowedIps.length > 0) {
        if (!isIPAllowed(ip, device.allowedIps)) {
          return deny(res);
        }
      }

      const tokenDeviceId = getTokenDeviceId(req);
      if (!tokenDeviceId) {
        return deny(res);
      }
      if (String(tokenDeviceId) !== String(headerDeviceId)) {
        return deny(res);
      }

      return next();
    }

    // WEB: apply org/user IP restrictions whenever configured
    // (request must satisfy ALL configured whitelists)
    if (Array.isArray(org.allowedIps) && org.allowedIps.length > 0) {
      if (!isIPAllowed(ip, org.allowedIps)) {
        return deny(res);
      }
    }
    if (Array.isArray(userAllowedIps) && userAllowedIps.length > 0) {
      if (!isIPAllowed(ip, userAllowedIps)) {
        return deny(res);
      }
    }

    return next();
  } catch (e) {
    return deny(res);
  }
}

module.exports = { accessControlMiddleware };

