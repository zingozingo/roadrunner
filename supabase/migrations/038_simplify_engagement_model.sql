-- Migration 038: Simplify engagement model
-- Removes: priority column, open_items column
-- Simplifies: status from 5 values to 3 (active, planned, archived)
-- Data migration: paused/completed → archived

BEGIN;

-- 1. Convert paused and completed engagements to archived
UPDATE engagements SET status = 'archived' WHERE status IN ('paused', 'completed');

-- 2. Update status constraint to 3 values
ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_status_check;
ALTER TABLE engagements ADD CONSTRAINT engagements_status_check
  CHECK (status IN ('active', 'planned', 'archived'));

-- 3. Drop priority column
ALTER TABLE engagements DROP COLUMN IF EXISTS priority;

-- 4. Drop open_items column
ALTER TABLE engagements DROP COLUMN IF EXISTS open_items;

COMMIT;
