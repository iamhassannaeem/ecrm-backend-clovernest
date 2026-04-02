-- CreateTable
CREATE TABLE "GroupChatAdmin" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "groupChatId" BIGINT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "GroupChatAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupChatAdmin_userId_groupChatId_key" ON "GroupChatAdmin"("userId", "groupChatId");

-- AddForeignKey
ALTER TABLE "GroupChatAdmin" ADD CONSTRAINT "GroupChatAdmin_groupChatId_fkey" FOREIGN KEY ("groupChatId") REFERENCES "GroupChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatAdmin" ADD CONSTRAINT "GroupChatAdmin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatAdmin" ADD CONSTRAINT "GroupChatAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
