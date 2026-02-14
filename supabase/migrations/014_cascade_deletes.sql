-- 014_cascade_deletes.sql
-- Add DB-level FK cascades for messages and notes on engagement delete.
-- Also cleans up orphaned data from prior test runs.

-- ============================================================
-- FK cascade: messages.engagement_id → ON DELETE SET NULL
-- ============================================================
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_engagement_id_fkey;

ALTER TABLE messages
  ADD CONSTRAINT messages_engagement_id_fkey
  FOREIGN KEY (engagement_id)
  REFERENCES engagements (id)
  ON DELETE SET NULL;

-- ============================================================
-- FK cascade: notes.engagement_id → ON DELETE CASCADE
-- ============================================================
ALTER TABLE notes
  DROP CONSTRAINT IF EXISTS notes_engagement_id_fkey;

ALTER TABLE notes
  ADD CONSTRAINT notes_engagement_id_fkey
  FOREIGN KEY (engagement_id)
  REFERENCES engagements (id)
  ON DELETE CASCADE;

-- ============================================================
-- ONE-TIME CLEANUP: Remove orphaned test data (2026-02-14)
-- ============================================================

-- Remove unclassified messages (no engagement, accumulated from testing)
DELETE FROM messages WHERE engagement_id IS NULL;

-- Remove participant_links pointing to deleted engagements
DELETE FROM participant_links
  WHERE entity_type = 'engagement'
    AND entity_id NOT IN (SELECT id FROM engagements);

-- Remove entity_links pointing to deleted engagements (both directions)
DELETE FROM entity_links
  WHERE source_type = 'engagement'
    AND source_id NOT IN (SELECT id FROM engagements);

DELETE FROM entity_links
  WHERE target_type = 'engagement'
    AND target_id NOT IN (SELECT id FROM engagements);

-- Remove orphaned participants (no links to anything)
DELETE FROM participants
  WHERE id NOT IN (SELECT participant_id FROM participant_links);

-- Remove unresolved approval_queue entries with missing messages
DELETE FROM approval_queue
  WHERE resolved = false
    AND message_id IS NOT NULL
    AND message_id NOT IN (SELECT id FROM messages);
