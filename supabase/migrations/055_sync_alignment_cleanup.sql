-- Migration 055: Sync alignment cleanup
--
-- Aligns Supabase schema with Airtable fields:
--   (a) engagements: add 'planned' status, drop dead columns
--   (b) meetings: add meeting_type, drop dead columns
--   (c) meeting_notes: drop ai_flags (killed in Decision #111)

-- 1a. Engagements: expand status CHECK to include 'planned'
ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_status_check;
ALTER TABLE engagements ADD CONSTRAINT engagements_status_check
  CHECK (status IN ('active', 'planned', 'blocked', 'completed', 'archived'));

-- 1b. Engagements: drop dead columns
ALTER TABLE engagements DROP COLUMN IF EXISTS engagement_type;
ALTER TABLE engagements DROP COLUMN IF EXISTS partner_name;

-- 2a. Meetings: add meeting_type single-select (matches Airtable options exactly)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_type TEXT
  CHECK (meeting_type IS NULL OR meeting_type IN (
    'Partner Cadence Call',
    'Co-Build Cadence',
    'Co-Market Cadence',
    'SCA Review',
    'QBR',
    'Product Team Sync',
    'Co-Sell Cadence',
    'Co-Sell Strategy',
    'Executive Meeting'
  ));

-- 2b. Meetings: drop dead column
ALTER TABLE meetings DROP COLUMN IF EXISTS partner_name;

-- 3. Meeting notes: drop ai_flags (killed in Decision #111)
ALTER TABLE meeting_notes DROP COLUMN IF EXISTS ai_flags;
