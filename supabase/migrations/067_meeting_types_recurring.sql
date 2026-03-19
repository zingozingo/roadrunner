-- Migration 067: Meeting types taxonomy replacement, recurring meeting columns, source constraint update
-- Part of Meetings Motion plan

-- 1. Clean slate: NULL all existing meeting_type values
UPDATE meetings SET meeting_type = NULL WHERE meeting_type IS NOT NULL;

-- 2. Drop old inline meeting_type CHECK constraint (auto-named from migration 055)
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;

-- 3. Add new named meeting_type CHECK constraint with 10 types
ALTER TABLE meetings ADD CONSTRAINT meetings_meeting_type_check
  CHECK (meeting_type IS NULL OR meeting_type IN (
    'partner_cadence', 'sca_review', 'qbr', 'executive',
    'event', 'internal', 'support', 'demo', 'enablement', 'ad_hoc'
  ));

-- 4. Add recurrence_pattern column
ALTER TABLE meetings ADD COLUMN recurrence_pattern TEXT
  CHECK (recurrence_pattern IS NULL OR recurrence_pattern IN ('weekly', 'biweekly', 'monthly', 'quarterly'));

-- 5. Add recurrence_end column
ALTER TABLE meetings ADD COLUMN recurrence_end DATE;

-- 6. Add series_id column with self-referential FK
ALTER TABLE meetings ADD COLUMN series_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- 7. Drop old source CHECK constraint and add updated one with 'auto'
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_source_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_source_check
  CHECK (source IN ('manual', 'ics_parsed', 'body_parsed', 'auto'));

-- 8. Partial index on series_id for series queries
CREATE INDEX idx_meetings_series_id ON meetings(series_id) WHERE series_id IS NOT NULL;

-- 9. Unique index to prevent spawn race conditions (two concurrent requests spawning the same occurrence)
CREATE UNIQUE INDEX idx_meetings_series_date_unique ON meetings(series_id, meeting_date) WHERE series_id IS NOT NULL;
