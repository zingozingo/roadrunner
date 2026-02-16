-- 022: Meetings completeness — align with Airtable schema
--
-- 1. Add event_id FK — meetings can be associated with events
-- 2. Standardize status values to match Airtable Meeting Type picklist
-- 3. Add indexes for event_id and partner_name lookups

-- ============================================================
-- ADD event_id FK
-- ============================================================
-- Nullable — not all meetings are event-linked (e.g., standalone partner calls)
ALTER TABLE meetings
  ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE SET NULL;

COMMENT ON COLUMN meetings.event_id IS 'Optional link to an event (e.g., re:Invent exec meeting)';

CREATE INDEX idx_meetings_event_id ON meetings(event_id);

-- ============================================================
-- STANDARDIZE status values to match Airtable
-- ============================================================
-- Migrate existing 'scheduled' default to Airtable-format 'Scheduling'
UPDATE meetings SET status = 'Scheduling' WHERE status = 'scheduled';

-- Change default to match Airtable picklist
ALTER TABLE meetings ALTER COLUMN status SET DEFAULT 'Scheduling';

-- Add CHECK constraint matching Airtable's Meeting Status options exactly
ALTER TABLE meetings
  ADD CONSTRAINT meetings_status_check
  CHECK (status IN ('Scheduling', 'Invites Sent', 'Confirmed', 'Completed', 'Did Not Occur'));

-- ============================================================
-- ADD partner_name index
-- ============================================================
-- partner_name column already exists (migration 018) but has no index
CREATE INDEX idx_meetings_partner_name ON meetings(partner_name);
