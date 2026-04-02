const { prisma } = require('../config/database');

function getDomainFromRequest(req) {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const host = req.get('Host');

  let domain = origin || referer || host;
  if (!domain) return null;

  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  domain = domain.split(':')[0];
  domain = domain.split('/')[0];
  return domain.toLowerCase();
}

function accessDenied(res) {
  return res.status(403).json({ code: 'ACCESS_DENIED', message: 'Unauthorized access' });
}

function getHeaderDeviceIdStrict(req) {
  const hasHeader = Object.prototype.hasOwnProperty.call(req.headers || {}, 'x-device-id');
  const v = req.get('x-device-id');
  if (!hasHeader) return null;
  const s = v != null ? String(v).trim() : '';
  return s.length ? s : null;
}

exports.requestDevice = async (req, res, next) => {
  try {
    const { email, name, device_id, device_name, platform } = req.body || {};

    if (!email || !device_id || !device_name || !platform) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['android', 'ios'].includes(String(platform).toLowerCase())) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Identify organization via domain (same approach as login)
    const requestDomain = getDomainFromRequest(req);
    if (!requestDomain) {
      return res.status(400).json({ error: 'Domain not detected' });
    }

    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { domain: { equals: requestDomain, mode: 'insensitive' } },
          { domain: { equals: `http://${requestDomain}`, mode: 'insensitive' } },
          { domain: { equals: `https://${requestDomain}`, mode: 'insensitive' } },
          { domain: { contains: requestDomain, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (!organization) {
      return accessDenied(res);
    }

    // User must exist in the system; then must belong to this organization (same as login).
    const userByEmail = await prisma.user.findFirst({
      where: {
        email: { equals: String(email).trim(), mode: 'insensitive' },
      },
      select: { id: true, organizationId: true, isActive: true, isDeleted: true },
    });

    if (!userByEmail) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Your profile does not exist.',
      });
    }

    if (userByEmail.isDeleted || !userByEmail.isActive) {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account is deactivated. Please contact your administrator.',
      });
    }

    if (userByEmail.organizationId !== organization.id) {
      return res.status(401).json({
        error: 'Profile not found',
        message: `Your profile doesn't exist in this organization (${organization.name})`,
      });
    }

    const user = userByEmail;

    const created = await prisma.mobileDevice.upsert({
      where: { deviceId: String(device_id) },
      update: {
        deviceName: String(device_name),
        platform: String(platform).toLowerCase(),
        lastIp: req.ip,
      },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        deviceId: String(device_id),
        deviceName: String(device_name),
        platform: String(platform).toLowerCase(),
        isApproved: false,
        lastIp: req.ip,
      },
      select: {
        deviceId: true,
        isApproved: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: 'Device request submitted',
      device: created,
      requested_by: { email, name: name || null },
    });
  } catch (error) {
    next(error);
  }
};

exports.approveDevice = async (req, res, next) => {
  try {
    const { device_id } = req.body || {};
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    const organizationId = Number(req.organizationId);
    if (!organizationId) {
      return accessDenied(res);
    }

    const updated = await prisma.mobileDevice.updateMany({
      where: {
        organizationId,
        deviceId: String(device_id),
      },
      data: {
        isApproved: true,
        approvedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    return res.json({ message: 'Device approved' });
  } catch (error) {
    next(error);
  }
};

// Org admin: update per-device mobile controls (device allowlist + toggle org/user allowlists)
exports.updateDeviceControls = async (req, res, next) => {
  try {
    const organizationId = Number(req.organizationId);
    if (!organizationId) return accessDenied(res);

    const deviceIdParam = String(req.params.deviceId || '').trim();
    if (!deviceIdParam) return res.status(400).json({ error: 'deviceId param is required' });

    const { allowed_ips, apply_org_ips, apply_user_ips } = req.body || {};
    const data = {};

    if (allowed_ips !== undefined) {
      if (!Array.isArray(allowed_ips)) return res.status(400).json({ error: 'allowed_ips must be an array' });
      data.allowedIps = allowed_ips.map((x) => String(x).trim()).filter(Boolean);
    }
    if (apply_org_ips !== undefined) data.applyOrgIps = Boolean(apply_org_ips);
    if (apply_user_ips !== undefined) data.applyUserIps = Boolean(apply_user_ips);

    const updated = await prisma.mobileDevice.updateMany({
      where: { organizationId, deviceId: deviceIdParam },
      data,
    });

    if (updated.count === 0) return res.status(404).json({ error: 'Device not found' });
    return res.json({ message: 'Device updated' });
  } catch (error) {
    next(error);
  }
};

// Org admin: unapprove a device (revoke mobile access)
exports.unapproveDevice = async (req, res, next) => {
  try {
    const organizationId = Number(req.organizationId);
    if (!organizationId) return accessDenied(res);

    const { device_id } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });

    const updated = await prisma.mobileDevice.updateMany({
      where: { organizationId, deviceId: String(device_id) },
      data: { isApproved: false, approvedAt: null },
    });

    if (updated.count === 0) return res.status(404).json({ error: 'Device not found' });
    return res.json({ message: 'Device unapproved' });
  } catch (error) {
    next(error);
  }
};

// Public endpoint: mobile app can check its approval status using x-device-id header
exports.getDeviceStatus = async (req, res, next) => {
  try {
    const deviceId = getHeaderDeviceIdStrict(req);
    if (!deviceId) {
      return res.status(400).json({ error: 'x-device-id header is required' });
    }

    const device = await prisma.mobileDevice.findUnique({
      where: { deviceId: String(deviceId) },
      select: {
        deviceId: true,
        isApproved: true,
        createdAt: true,
        approvedAt: true,
      },
    });

    if (!device) {
      return res.json({ device_id: String(deviceId), status: 'NOT_FOUND' });
    }

    return res.json({
      device_id: device.deviceId,
      status: device.isApproved ? 'APPROVED' : 'PENDING',
      createdAt: device.createdAt,
      approvedAt: device.approvedAt,
    });
  } catch (error) {
    next(error);
  }
};

