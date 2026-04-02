const { prisma } = require('../../config/database');

async function registerFcmToken({ userId, organizationId, token, platform, appVersion }) {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('FCM token is required');
  }

  if (!userId || Number.isNaN(Number(userId))) {
    throw new Error('userId is required');
  }

  if (!organizationId || Number.isNaN(Number(organizationId))) {
    throw new Error('organizationId is required');
  }

  const normalizedToken = token.trim();

  const numericUserId = Number(userId);
  const numericOrgId = Number(organizationId);

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // If this token already exists, just refresh it and (re)assign to this user.
    const existingByToken = await tx.fcmDeviceToken.findUnique({
      where: { token: normalizedToken },
      select: { id: true },
    });

    let saved;

    if (existingByToken) {
      saved = await tx.fcmDeviceToken.update({
        where: { token: normalizedToken },
        data: {
          userId: numericUserId,
          organizationId: numericOrgId,
          platform: platform ?? null,
          appVersion: appVersion ?? null,
          isActive: true,
          lastSeenAt: now,
        },
      });
    } else {
      // Token rotated (cache cleared / reinstall). Reuse an existing row for this user/org
      // by updating its token instead of inserting a new row.
      const existingForUser = await tx.fcmDeviceToken.findFirst({
        where: {
          userId: numericUserId,
          organizationId: numericOrgId,
        },
        orderBy: [{ isActive: 'desc' }, { lastSeenAt: 'desc' }, { updatedAt: 'desc' }],
      });

      if (existingForUser) {
        saved = await tx.fcmDeviceToken.update({
          where: { id: existingForUser.id },
          data: {
            token: normalizedToken,
            platform: platform ?? null,
            appVersion: appVersion ?? null,
            isActive: true,
            lastSeenAt: now,
          },
        });
      } else {
        saved = await tx.fcmDeviceToken.create({
          data: {
            token: normalizedToken,
            userId: numericUserId,
            organizationId: numericOrgId,
            platform: platform ?? null,
            appVersion: appVersion ?? null,
            isActive: true,
            lastSeenAt: now,
          },
        });
      }
    }

    // Ensure only one active token remains for the user/org.
    const result = await tx.fcmDeviceToken.updateMany({
      where: {
        userId: numericUserId,
        organizationId: numericOrgId,
        isActive: true,
        id: { not: saved.id },
      },
      data: { isActive: false, updatedAt: now },
    });

    if (result.count > 0) {
      console.warn(
        `[FCM] Deactivated ${result.count} old token(s) for userId=${numericUserId} orgId=${numericOrgId}`
      );
    }

    return saved;
  });
}

async function deactivateToken(token, reason) {
  if (!token) return;

  await prisma.fcmDeviceToken.updateMany({
    where: { token, isActive: true },
    data: { isActive: false, updatedAt: new Date() },
  });

  if (reason) {
    console.warn(`[FCM] Token deactivated: ${reason}`);
  }
}

module.exports = { registerFcmToken, deactivateToken };

