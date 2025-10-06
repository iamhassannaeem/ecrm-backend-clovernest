/*
  Warnings:

  - You are about to drop the column `rgusId` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `saleServiceTypeId` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `saleTypeId` on the `Lead` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_rgusId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_saleServiceTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_saleTypeId_fkey";

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "rgusId",
DROP COLUMN "saleServiceTypeId",
DROP COLUMN "saleTypeId",
ADD COLUMN     "customerTypeId" INTEGER;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerTypeId_fkey" FOREIGN KEY ("customerTypeId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
