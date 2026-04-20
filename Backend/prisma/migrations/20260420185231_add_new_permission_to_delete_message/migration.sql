-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionResource" ADD VALUE 'GROUP_CHAT_MESSAGE';
ALTER TYPE "PermissionResource" ADD VALUE 'ONE_TO_ONE_CHAT_MESSAGE';

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "allowed_ip_labels" SET DEFAULT '{}'::jsonb;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "allowed_ip_labels" SET DEFAULT '{}'::jsonb;
