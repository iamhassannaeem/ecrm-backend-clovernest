-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "allowed_ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mobile_app_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "allowed_ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "is_store_test_user" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "allowed_ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "apply_org_ips" BOOLEAN NOT NULL DEFAULT false,
    "apply_user_ips" BOOLEAN NOT NULL DEFAULT false,
    "last_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_device_id_key" ON "mobile_devices"("device_id");

-- CreateIndex
CREATE INDEX "mobile_devices_org_id_idx" ON "mobile_devices"("org_id");

-- CreateIndex
CREATE INDEX "mobile_devices_user_id_idx" ON "mobile_devices"("user_id");

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
