-- Migration 018: Meetings table
-- Tracks meetings associated with engagements and AWS relationships.
-- Mirrors Airtable "Meetings" table for bi-directional sync.

-- ============================================================
-- MEETINGS
-- ============================================================
CREATE TABLE meetings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text        NOT NULL,
  engagement_id       uuid        REFERENCES engagements(id) ON DELETE SET NULL,
  partner_name        text,
  meeting_type        text,
  status              text        NOT NULL DEFAULT 'scheduled',
  meeting_date        date,
  start_time          text,
  end_time            text,
  location            text,
  organizer_email     text,
  attendees           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ics_uid             text        UNIQUE,
  source              text        NOT NULL DEFAULT 'ics_parsed'
                                  CHECK (source IN ('manual', 'ics_parsed')),
  notes               text,
  airtable_record_id  text        UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_meetings_engagement_id ON meetings(engagement_id);
CREATE INDEX idx_meetings_meeting_date ON meetings(meeting_date);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE meetings IS 'Meetings linked to engagements and AWS relationships. Synced from Airtable or parsed from ICS.';
