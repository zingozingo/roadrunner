-- Migration 011: Simplify content_type values
-- Remove event_info and program_info (now just engagement_email),
-- and catch any legacy initiative_email values.

-- 1. Update existing rows to use the simplified content types
UPDATE messages SET content_type = 'engagement_email' WHERE content_type IN ('event_info', 'program_info', 'initiative_email');

-- 2. Drop the old CHECK constraint (name may vary by DB)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_type_check;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS content_type_check;

-- 3. Add new CHECK constraint with simplified values
ALTER TABLE messages ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IS NULL OR content_type IN ('engagement_email', 'meeting_invite', 'mixed', 'noise'));
