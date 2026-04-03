-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "allowed_ip_labels" SET DEFAULT '{}'::jsonb;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "allowed_ip_labels" SET DEFAULT '{}'::jsonb;
