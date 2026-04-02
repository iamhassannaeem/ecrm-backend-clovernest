const { prisma } = require('../../config/database');
const { getMessaging } = require('./firebaseAdmin');
const { deactivateToken } = require('./fcmTokenService');

const CHAT_NOTIFICATION_TYPES = new Set(['NEW_MESSAGE', 'NEW_GROUP_MESSAGE']);

function toStringData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined || v === null) out[k] = '';
    else out[k] = String(v);
  }
  return out;
}

function buildChatData(notification) {
  const meta = notification.metadata || {};
  const isGroup = notification.type === 'NEW_GROUP_MESSAGE';

  return {
    route: isGroup ? 'GROUP_CHAT_SCREEN' : 'DIRECT_CHAT_SCREEN',
    chatType: isGroup ? 'GROUP_CHAT' : 'DIRECT',

    // navigation ids
    conversationId: isGroup ? '' : String(meta.conversationId ?? ''),
    groupId: isGroup ? String(meta.groupId ?? '') : '',

    // display content/preview
    content: String(notification.message ?? ''),
    title: String(notification.title ?? ''),
    body: String(notification.message ?? ''),

    // helpful meta for mobile UI/debug
    notificationId: String(notification.id),
    senderId: String(meta.senderId ?? ''),
    senderName: String(meta.senderName ?? ''),
    messagePreview: String(meta.messagePreview ?? ''),
    groupName: String(meta.groupName ?? ''),
    organizationId: String(notification.organizationId ?? ''),
  };
}

function isInvalidTokenError(error) {
  const msg = error?.message || '';
  const code = error?.code || '';
  const combined = `${code} ${msg}`.toLowerCase();

  return (
    combined.includes('registration-token-not-registered') ||
    combined.includes('invalid-registration-token') ||
    combined.includes('unregistered')
  );
}

async function sendChatPush({ notification }) {
  try {
    if (!notification) return null;
    if (!CHAT_NOTIFICATION_TYPES.has(notification.type)) return null;

    // Dedup: if we already delivered this notification, skip.
    const delivery = await prisma.fcmNotificationDelivery.findUnique({
      where: { notificationId: notification.id },
      select: { deliveredAt: true },
    });

    if (delivery?.deliveredAt) return null;

    // Recipient correctness: only push to the relevant recipientId (+ org safety).
    const deviceTokens = await prisma.fcmDeviceToken.findMany({
      where: {
        userId: Number(notification.recipientId),
        isActive: true,
        ...(notification.organizationId
          ? { organizationId: notification.organizationId }
          : {}),
      },
      select: { token: true },
    });

    const rawTokens = deviceTokens.map((t) => t.token).filter(Boolean);
    const tokens = Array.from(new Set(rawTokens));
    if (tokens.length === 0) return null;

    const messaging = getMessaging();
    const data = toStringData(buildChatData(notification));

    console.log(
      `[FCM] send notificationId=${notification.id} type=${notification.type} recipientId=${notification.recipientId} tokens=${tokens.length}/${rawTokens.length} messageId=${String(
        notification.metadata?.messageId ?? ''
      )}`
    );

    // Some Android clients show duplicate notifications when both "notification" payload
    // (auto-displayed by OS) and "data" payload (handled by app) are present.
    // Set FCM_INCLUDE_NOTIFICATION_PAYLOAD=false to send data-only messages.
    const includeNotificationPayload =
      String(process.env.FCM_INCLUDE_NOTIFICATION_PAYLOAD ?? 'true').toLowerCase() !==
      'false';

    const response = await messaging.sendEachForMulticast({
      tokens,
      ...(includeNotificationPayload
        ? {
            notification: {
              title: notification.title,
              body: notification.message,
            },
          }
        : {}),
      data,
      android: { priority: 'high' },
      apns: {
        payload: {
          aps: includeNotificationPayload
            ? { sound: 'default' }
            : { 'content-available': 1 },
        },
      },
    });

    await prisma.fcmNotificationDelivery.upsert({
      where: { notificationId: notification.id },
      update: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        deliveredAt: response.successCount > 0 ? new Date() : null,
        lastError:
          response.failureCount > 0 ? 'FCM had failures for some tokens' : null,
      },
      create: {
        notificationId: notification.id,
        recipientId: Number(notification.recipientId),
        attempts: 1,
        lastAttemptAt: new Date(),
        deliveredAt: response.successCount > 0 ? new Date() : null,
        lastError:
          response.failureCount > 0 ? 'FCM had failures for some tokens' : null,
      },
    });

    // Deactivate invalid tokens to improve future accuracy.
    const invalidTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && isInvalidTokenError(r.error)) {
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length > 0) {
      await Promise.all(
        invalidTokens.map((t) => deactivateToken(t, 'invalid/unknown token'))
      );
    }

    return response;
  } catch (error) {
    // Never break chat: FCM failures should not impact your existing system.
    console.error('[FCM] sendChatPush failed:', error);
    return null;
  }
}

module.exports = { sendChatPush };

