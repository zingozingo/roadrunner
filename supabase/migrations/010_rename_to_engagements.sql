-- ============================================================
-- Migration 010: Rename initiatives → engagements
-- ============================================================
--
-- Transforms the v0.1 schema to the goal-state data model.
-- See: docs/goal-state.md, decisions 30-36.
--
-- What this does:
--   - Renames initiatives table → engagements
--   - Renames initiative_id columns → engagement_id (messages, notes, approval_queue)
--   - Updates entity_links/participant_links data: 'initiative' → 'engagement'
--   - Updates messages.content_type data: 'initiative_email' → 'engagement_email'
--   - Adds tags (jsonb) to engagements
--   - Adds renewal_cycle to programs
--   - Adds updated_at + auto-triggers to events and programs
--   - Fixes stale events.type CHECK (adds workshop, kickoff, trade_show, training; drops meeting_series)
--   - Recreates all affected FKs, CHECKs, triggers, and indexes
--
-- Constraint names verified against live database on 2026-02-10.
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 1: Drop dependent constraints and FKs
-- ============================================================

-- 1. FK: messages.initiative_id → initiatives(id) [NO ACTION]
ALTER TABLE messages DROP CONSTRAINT messages_initiative_id_fkey;

-- 2. FK: notes.initiative_id → initiatives(id) [NO ACTION]
ALTER TABLE notes DROP CONSTRAINT notes_initiative_id_fkey;

-- 3. FK: approval_queue.initiative_id → initiatives(id) [SET NULL]
ALTER TABLE approval_queue DROP CONSTRAINT approval_queue_initiative_id_fkey;

-- 4. Trigger: auto-update updated_at on initiatives
DROP TRIGGER IF EXISTS trg_initiatives_updated_at ON initiatives;

-- 5. CHECK: entity_links source_type and target_type (reference 'initiative')
ALTER TABLE entity_links DROP CONSTRAINT entity_links_source_type_check;
ALTER TABLE entity_links DROP CONSTRAINT entity_links_target_type_check;

-- 6. CHECK: participant_links entity_type (references 'initiative')
ALTER TABLE participant_links DROP CONSTRAINT participant_links_entity_type_check;

-- 7. CHECK: messages content_type (references 'initiative_email')
ALTER TABLE messages DROP CONSTRAINT messages_content_type_check;

-- 8. CHECK: events type (stale — allows meeting_series, missing workshop/kickoff/trade_show/training)
ALTER TABLE events DROP CONSTRAINT events_type_check;

-- 9. CHECK: events source (unchanged values, but drop and recreate clean)
ALTER TABLE events DROP CONSTRAINT events_source_check;

-- ============================================================
-- PHASE 2: Rename table and columns
-- ============================================================

-- 10. Rename the table
ALTER TABLE initiatives RENAME TO engagements;

-- 11-13. Rename FK columns
ALTER TABLE messages RENAME COLUMN initiative_id TO engagement_id;
ALTER TABLE notes RENAME COLUMN initiative_id TO engagement_id;
ALTER TABLE approval_queue RENAME COLUMN initiative_id TO engagement_id;

-- ============================================================
-- PHASE 3: Update data values in existing rows
-- ============================================================

-- 14-15. entity_links: 'initiative' → 'engagement'
UPDATE entity_links SET source_type = 'engagement' WHERE source_type = 'initiative';
UPDATE entity_links SET target_type = 'engagement' WHERE target_type = 'initiative';

-- 16. participant_links: 'initiative' → 'engagement'
UPDATE participant_links SET entity_type = 'engagement' WHERE entity_type = 'initiative';

-- 17. messages: 'initiative_email' → 'engagement_email'
UPDATE messages SET content_type = 'engagement_email' WHERE content_type = 'initiative_email';

-- 17b. events: remove stale 'meeting_series' type (killed in decision 10, session 5)
--      Map to 'conference' as safest fallback — unlikely to exist in practice.
UPDATE events SET type = 'conference' WHERE type = 'meeting_series';

-- ============================================================
-- PHASE 4: Add new columns
-- ============================================================

-- 18. Tags on engagements (JSONB string array, freeform labels)
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]';

-- 19. Renewal cycle on programs (e.g. "6 months" for M-POP, "annual" for competencies)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS renewal_cycle text;

-- 20-21. updated_at on events and programs (enables auto-trigger)
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE programs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================
-- PHASE 5: Recreate constraints
-- ============================================================

-- 22. FK: messages.engagement_id → engagements(id) [NO ACTION — matches original]
ALTER TABLE messages ADD CONSTRAINT messages_engagement_id_fkey
  FOREIGN KEY (engagement_id) REFERENCES engagements(id);

-- 23. FK: notes.engagement_id → engagements(id) [NO ACTION — matches original]
ALTER TABLE notes ADD CONSTRAINT notes_engagement_id_fkey
  FOREIGN KEY (engagement_id) REFERENCES engagements(id);

-- 24. FK: approval_queue.engagement_id → engagements(id) [SET NULL — matches original]
ALTER TABLE approval_queue ADD CONSTRAINT approval_queue_engagement_id_fkey
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL;

-- 25-26. CHECK: entity_links source_type and target_type
ALTER TABLE entity_links ADD CONSTRAINT entity_links_source_type_check
  CHECK (source_type IN ('engagement', 'event', 'program'));
ALTER TABLE entity_links ADD CONSTRAINT entity_links_target_type_check
  CHECK (target_type IN ('engagement', 'event', 'program'));

-- 27. CHECK: participant_links entity_type
ALTER TABLE participant_links ADD CONSTRAINT participant_links_entity_type_check
  CHECK (entity_type IN ('engagement', 'event'));

-- 28. CHECK: messages content_type
ALTER TABLE messages ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN ('engagement_email', 'event_info', 'program_info',
                          'meeting_invite', 'mixed', 'noise'));

-- 29. CHECK: events type (fixed — adds workshop, kickoff, trade_show, training; drops meeting_series)
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('conference', 'summit', 'workshop', 'kickoff', 'trade_show',
                  'deadline', 'review_cycle', 'training'));

-- 30. CHECK: events source (unchanged, recreated clean)
ALTER TABLE events ADD CONSTRAINT events_source_check
  CHECK (source IN ('seed', 'email_extracted', 'user_created'));

-- ============================================================
-- PHASE 6: Recreate triggers and indexes
-- ============================================================

-- 31. Trigger: auto-update updated_at on engagements (reuses existing function)
CREATE TRIGGER trg_engagements_updated_at
  BEFORE UPDATE ON engagements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 32. Trigger: auto-update updated_at on events
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 33. Trigger: auto-update updated_at on programs
CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 34. Unique index on participant_links (idempotent — already exists in production)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_links_unique
  ON participant_links (participant_id, entity_type, entity_id);

-- 35. Rename index: messages engagement lookup
ALTER INDEX idx_messages_initiative_id RENAME TO idx_messages_engagement_id;

-- ============================================================
-- PHASE 7: Comments
-- ============================================================

-- 36-38. Table and column documentation
COMMENT ON TABLE engagements IS 'Partner engagements tracked via email classification. Formerly initiatives.';
COMMENT ON COLUMN engagements.tags IS 'JSONB string array of freeform labels (e.g. ["finserv", "co-sell"])';
COMMENT ON COLUMN engagements.summary IS 'Legacy field — kept for backward compat. current_state is source of truth.';

COMMIT;
