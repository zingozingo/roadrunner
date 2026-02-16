-- Add airtable_record_id to engagements for Roadrunner → Airtable push sync

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS airtable_record_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagements_airtable_record_id
  ON engagements(airtable_record_id) WHERE airtable_record_id IS NOT NULL;
