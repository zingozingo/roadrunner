-- ============================================================
-- Migration 066: Inbox redesign — partner_id on messages, drop approval_queue
-- ============================================================
-- Decision #223: messages get partner_id for mechanical partner detection
-- Decision #226: approval_queue dropped — inbox is now a filtered view of messages
-- ============================================================

BEGIN;

-- 1. Add partner_id to messages (nullable FK, SET NULL on partner delete)
ALTER TABLE messages ADD COLUMN partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;

-- 2. Index for partner lookups on messages
CREATE INDEX idx_messages_partner ON messages(partner_id);

-- 3. Inbox index: unclassified, non-noise messages
--    Uses IS DISTINCT FROM because content_type is nullable and we want
--    NULLs (unclassified) to appear in the inbox (NULL != 'noise' is NULL in SQL).
CREATE INDEX idx_messages_inbox ON messages(engagement_id, content_type)
  WHERE engagement_id IS NULL AND content_type IS DISTINCT FROM 'noise';

-- 4. Drop approval_queue — replaced by inbox view over messages
DROP TABLE IF EXISTS approval_queue;

COMMIT;
