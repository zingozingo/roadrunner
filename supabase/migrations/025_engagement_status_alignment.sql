-- Align engagement status to 5 values matching Airtable lifecycle:
--   planned  → Planned
--   active   → Active
--   paused   → Blocked
--   completed → Completed
--   archived → Archived

-- Migrate existing "closed" rows to "completed"
UPDATE engagements SET status = 'completed' WHERE status = 'closed';

-- Drop old CHECK and add new one with all five statuses
ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_status_check;
ALTER TABLE engagements ADD CONSTRAINT engagements_status_check
  CHECK (status IN ('planned', 'active', 'paused', 'completed', 'archived'));
