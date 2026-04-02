-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "allowed_ip_labels" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "allowed_ip_labels" JSONB NOT NULL DEFAULT '{}'::jsonb;
