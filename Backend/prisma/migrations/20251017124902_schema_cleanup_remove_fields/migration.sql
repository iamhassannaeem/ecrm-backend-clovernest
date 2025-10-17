/*
  Warnings:

  - You are about to drop the column `installationDatetime` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `installationType` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `previousAddress` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `securityPin` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `Security` table. All the data in the column will be lost.
  - You are about to drop the column `dlExpiration` on the `Security` table. All the data in the column will be lost.
  - You are about to drop the column `stateId` on the `Security` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "installationDatetime",
DROP COLUMN "installationType",
DROP COLUMN "previousAddress",
DROP COLUMN "securityPin",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "policyNumber" TEXT;

-- AlterTable
ALTER TABLE "Security" DROP COLUMN "dateOfBirth",
DROP COLUMN "dlExpiration",
DROP COLUMN "stateId";
