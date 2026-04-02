-- CreateEnum
CREATE TYPE "ChatDisplayMode" AS ENUM ('FULLSCREEN', 'CHATBOX');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "chatDisplayMode" "ChatDisplayMode" NOT NULL DEFAULT 'FULLSCREEN';
