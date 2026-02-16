-- Add airtable_record_id to programs and events for Airtable sync
-- (aws_relationships already has this column from migration 017)

ALTER TABLE programs ADD COLUMN IF NOT EXISTS airtable_record_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_airtable_record_id
  ON programs(airtable_record_id) WHERE airtable_record_id IS NOT NULL;

ALTER TABLE events ADD COLUMN IF NOT EXISTS airtable_record_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_airtable_record_id
  ON events(airtable_record_id) WHERE airtable_record_id IS NOT NULL;
