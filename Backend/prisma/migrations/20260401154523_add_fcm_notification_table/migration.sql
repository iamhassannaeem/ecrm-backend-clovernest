-- CreateTable
CREATE TABLE "fcm_device_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "platform" TEXT,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "fcm_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fcm_notification_deliveries" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "fcm_notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fcm_device_tokens_token_key" ON "fcm_device_tokens"("token");

-- CreateIndex
CREATE INDEX "fcm_device_tokens_userId_idx" ON "fcm_device_tokens"("userId");

-- CreateIndex
CREATE INDEX "fcm_device_tokens_userId_organizationId_isActive_idx" ON "fcm_device_tokens"("userId", "organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "fcm_notification_deliveries_notificationId_key" ON "fcm_notification_deliveries"("notificationId");

-- CreateIndex
CREATE INDEX "fcm_notification_deliveries_recipientId_idx" ON "fcm_notification_deliveries"("recipientId");

-- AddForeignKey
ALTER TABLE "fcm_device_tokens" ADD CONSTRAINT "fcm_device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
