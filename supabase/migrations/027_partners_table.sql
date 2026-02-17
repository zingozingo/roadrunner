-- Migration 027: Partners table
-- First-class partner entity synced from Airtable. Enables deterministic
-- partner matching via contact emails instead of AI-guessed partner_name strings.

-- ============================================================
-- PARTNERS
-- ============================================================
CREATE TABLE partners (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text        NOT NULL,
  category               text,
  sub_category           text,
  alliance_lead          text,
  alliance_lead_email    text,
  psa                    text,
  spms_id                integer     UNIQUE,
  partner_contact_emails text[],
  airtable_record_id     text        UNIQUE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_partners_name ON partners(name);
CREATE INDEX idx_partners_category ON partners(category);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE partners IS 'Partner organizations. Synced from Airtable. Contact emails enable deterministic email-to-partner matching.';

-- ============================================================
-- FK: engagements.partner_id
-- ============================================================
ALTER TABLE engagements
  ADD COLUMN partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX idx_engagements_partner_id ON engagements(partner_id);

-- ============================================================
-- FK: meetings.partner_id
-- ============================================================
ALTER TABLE meetings
  ADD COLUMN partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX idx_meetings_partner_id ON meetings(partner_id);
