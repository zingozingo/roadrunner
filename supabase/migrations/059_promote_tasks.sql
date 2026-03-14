-- Migration 059: Promote note_tasks → tasks as partner-level entities
--
-- Tasks were tightly coupled to meeting_notes via CASCADE delete. This
-- migration decouples them so tasks survive note deletion, adds
-- owner_participant_id for richer ownership, expands owner vocabulary,
-- and cleans up the source/origin overlap.

BEGIN;

-- ================================================================
-- 1. Rename table
-- ================================================================
ALTER TABLE note_tasks RENAME TO tasks;

-- ================================================================
-- 2. meeting_note_id: CASCADE → SET NULL (tasks survive note deletion)
--    Also make column nullable (was NOT NULL for note-coupled design)
-- ================================================================
ALTER TABLE tasks
  DROP CONSTRAINT note_tasks_meeting_note_id_fkey;

ALTER TABLE tasks
  ALTER COLUMN meeting_note_id DROP NOT NULL;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_meeting_note_id_fkey
    FOREIGN KEY (meeting_note_id) REFERENCES meeting_notes(id)
    ON DELETE SET NULL;

-- ================================================================
-- 3. partner_id: NO ACTION → CASCADE (tasks die with partner)
-- ================================================================
ALTER TABLE tasks
  DROP CONSTRAINT note_tasks_partner_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_partner_id_fkey
    FOREIGN KEY (partner_id) REFERENCES partners(id)
    ON DELETE CASCADE;

-- ================================================================
-- 4. owner CHECK: expand from (me/partner/aws_internal) to
--    (me/internal/partner/third_party)
-- ================================================================

-- Backfill first (while old CHECK still allows 'aws_internal')
UPDATE tasks SET owner = 'internal' WHERE owner = 'aws_internal';

-- Drop old CHECK, add new
ALTER TABLE tasks DROP CONSTRAINT note_tasks_owner_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_owner_check
  CHECK (owner IN ('me', 'internal', 'partner', 'third_party'));

-- ================================================================
-- 5. owner_participant_id: FK to participants with SET NULL
-- ================================================================
ALTER TABLE tasks
  ADD COLUMN owner_participant_id UUID
    REFERENCES participants(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_owner_participant_id ON tasks(owner_participant_id);

-- ================================================================
-- 6. Clean up source/origin overlap
-- ================================================================

-- Drop the source column entirely (was 'meeting'/'seed' — redundant
-- now that tasks are decoupled from notes)
ALTER TABLE tasks DROP COLUMN source;

-- Backfill origin values before swapping CHECK
UPDATE tasks SET origin = 'ai_extracted' WHERE origin = 'ai';

-- Drop old CHECK on origin, add new
ALTER TABLE tasks DROP CONSTRAINT note_tasks_origin_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_origin_check
  CHECK (origin IN ('ai_extracted', 'manual'));

-- ================================================================
-- 7. Rename indexes to match new table name
-- ================================================================
ALTER INDEX idx_note_tasks_meeting_note_id RENAME TO idx_tasks_meeting_note_id;
ALTER INDEX idx_note_tasks_partner_id RENAME TO idx_tasks_partner_id;
ALTER INDEX idx_note_tasks_status RENAME TO idx_tasks_status;

-- ================================================================
-- 8. Rename trigger to match new table name
--    (PostgreSQL renames the trigger's table reference automatically
--     when the table is renamed, but the trigger name still says
--     "note_tasks" — rename for clarity)
-- ================================================================
ALTER TRIGGER update_note_tasks_updated_at ON tasks
  RENAME TO update_tasks_updated_at;

COMMIT;
