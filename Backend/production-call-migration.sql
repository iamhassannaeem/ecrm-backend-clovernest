-- Production Migration Script for Call Table Update
-- Date: 2025-01-19
-- Description: Updates Call table with new fields structure
-- 
-- IMPORTANT: This will DELETE all existing Call data!
-- Make sure to backup your database before running this script.

-- Start transaction
BEGIN;

-- Drop old columns that are no longer needed
ALTER TABLE "Call" DROP COLUMN IF EXISTS "callTime";
ALTER TABLE "Call" DROP COLUMN IF EXISTS "callDuration";
ALTER TABLE "Call" DROP COLUMN IF EXISTS "extension";
ALTER TABLE "Call" DROP COLUMN IF EXISTS "externalId";

-- Add new columns for the updated Call table structure
ALTER TABLE "Call" ADD COLUMN "user" TEXT;
ALTER TABLE "Call" ADD COLUMN "vendor_lead_code" TEXT;
ALTER TABLE "Call" ADD COLUMN "source_id" TEXT;
ALTER TABLE "Call" ADD COLUMN "list_id" TEXT;
ALTER TABLE "Call" ADD COLUMN "phone_number" TEXT;
ALTER TABLE "Call" ADD COLUMN "security_phrase" TEXT;
ALTER TABLE "Call" ADD COLUMN "comments" TEXT;
ALTER TABLE "Call" ADD COLUMN "external_lead_id" TEXT;
ALTER TABLE "Call" ADD COLUMN "campaign" TEXT;
ALTER TABLE "Call" ADD COLUMN "phone_login" TEXT;
ALTER TABLE "Call" ADD COLUMN "group" TEXT;
ALTER TABLE "Call" ADD COLUMN "SQLdate" TIMESTAMP(3);
ALTER TABLE "Call" ADD COLUMN "epoch" BIGINT;
ALTER TABLE "Call" ADD COLUMN "uniqueid" TEXT;
ALTER TABLE "Call" ADD COLUMN "server_ip" TEXT;
ALTER TABLE "Call" ADD COLUMN "SIPexten" TEXT;
ALTER TABLE "Call" ADD COLUMN "session_id" TEXT;
ALTER TABLE "Call" ADD COLUMN "recording_filename" TEXT;
ALTER TABLE "Call" ADD COLUMN "recording_id" TEXT;
ALTER TABLE "Call" ADD COLUMN "entry_date" TIMESTAMP(3);
ALTER TABLE "Call" ADD COLUMN "called_count" INTEGER;
ALTER TABLE "Call" ADD COLUMN "agent_log_id" TEXT;
ALTER TABLE "Call" ADD COLUMN "call_id" TEXT;
ALTER TABLE "Call" ADD COLUMN "user_group" TEXT;
ALTER TABLE "Call" ADD COLUMN "list_name" TEXT;
ALTER TABLE "Call" ADD COLUMN "talk_time" INTEGER;
ALTER TABLE "Call" ADD COLUMN "dispo" TEXT;
ALTER TABLE "Call" ADD COLUMN "call_notes" TEXT;
ALTER TABLE "Call" ADD COLUMN "term_reason" TEXT;
ALTER TABLE "Call" ADD COLUMN "callback_datetime" TIMESTAMP(3);

-- Commit the transaction
COMMIT;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Call' 
ORDER BY ordinal_position;
