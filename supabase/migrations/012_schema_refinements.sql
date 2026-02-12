-- 012_schema_refinements.sql
-- Schema refinements for seed-only architecture + data wipe for fresh start.
--   Events: add host, drop date_precision
--   Programs: add lifecycle_type + lifecycle_duration, drop renewal_cycle
--   Data wipe: clear all application tables (FK-safe order)

BEGIN;

-- ============================================================
-- Events table
-- ============================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS host text;
COMMENT ON COLUMN events.host IS 'Organization hosting the event (e.g. AWS, RSA, partner name)';

ALTER TABLE events DROP COLUMN IF EXISTS date_precision;

-- ============================================================
-- Programs table
-- ============================================================

ALTER TABLE programs ADD COLUMN IF NOT EXISTS lifecycle_type text NOT NULL DEFAULT 'indefinite'
  CHECK (lifecycle_type IN ('indefinite', 'recurring', 'expiring'));
COMMENT ON COLUMN programs.lifecycle_type IS 'indefinite = ongoing, recurring = must revalidate on cycle, expiring = ends after duration';

ALTER TABLE programs ADD COLUMN IF NOT EXISTS lifecycle_duration text;
COMMENT ON COLUMN programs.lifecycle_duration IS 'Human-readable duration (e.g. "6 months", "2 years"). Null for indefinite.';

ALTER TABLE programs DROP COLUMN IF EXISTS renewal_cycle;

-- ============================================================
-- Data wipe — FK-safe order (dependents first)
-- ============================================================

DELETE FROM approval_queue;
DELETE FROM entity_links;
DELETE FROM participant_links;
DELETE FROM notes;
DELETE FROM messages;
DELETE FROM participants;
DELETE FROM engagements;
DELETE FROM events;
DELETE FROM programs;

COMMIT;
