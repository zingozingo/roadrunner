-- Migration 042: Drop engagement date fields and "planned" status
-- Reverts start_date, target_completion added in 041. Removes "planned" from status.

BEGIN;

-- 1. Drop date columns
ALTER TABLE engagements DROP COLUMN IF EXISTS start_date;
ALTER TABLE engagements DROP COLUMN IF EXISTS target_completion;

-- 2. Migrate any 'planned' rows to 'active'
UPDATE engagements SET status = 'active' WHERE status = 'planned';

-- 3. Replace status CHECK constraint
ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_status_check;
ALTER TABLE engagements ADD CONSTRAINT engagements_status_check
  CHECK (status IN ('active', 'blocked', 'completed', 'archived'));

COMMIT;
