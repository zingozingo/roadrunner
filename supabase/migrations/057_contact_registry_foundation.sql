-- 057: Contact registry foundation
--
-- Makes participants THE canonical person registry. Adds org_type and source
-- tracking to the existing table, then creates four dedicated join tables
-- with real FK CASCADE constraints to replace the polymorphic participant_links
-- pattern and scattered JSONB contact storage.
--
-- Purely additive — no existing tables or columns are modified or dropped.

-- ============================================================
-- 1. Enhance participants table
-- ============================================================

ALTER TABLE participants ADD COLUMN IF NOT EXISTS org_type TEXT
  CHECK (org_type IN ('internal', 'partner', 'third_party'));

ALTER TABLE participants ADD COLUMN IF NOT EXISTS source TEXT
  CHECK (source IN ('airtable_sync', 'ics_parsed', 'classifier', 'manual'));

ALTER TABLE participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_participants_org_type ON participants(org_type);

-- Reuse existing updated_at trigger function
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. partner_participants (replaces partners.aws_team / partner_contacts JSONB)
-- ============================================================

CREATE TABLE partner_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, participant_id, role)
);

CREATE INDEX idx_partner_participants_partner ON partner_participants(partner_id);
CREATE INDEX idx_partner_participants_participant ON partner_participants(participant_id);

-- ============================================================
-- 3. meeting_participants (replaces meetings.attendees JSONB)
-- ============================================================

CREATE TABLE meeting_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, participant_id)
);

CREATE INDEX idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_participant ON meeting_participants(participant_id);

-- ============================================================
-- 4. engagement_participants (replaces polymorphic participant_links)
-- ============================================================

CREATE TABLE engagement_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, participant_id)
);

CREATE INDEX idx_engagement_participants_engagement ON engagement_participants(engagement_id);
CREATE INDEX idx_engagement_participants_participant ON engagement_participants(participant_id);

-- ============================================================
-- 5. relationship_participants (replaces aws_relationships.contacts JSONB)
-- ============================================================

CREATE TABLE relationship_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES aws_relationships(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (relationship_id, participant_id)
);

CREATE INDEX idx_relationship_participants_relationship ON relationship_participants(relationship_id);
CREATE INDEX idx_relationship_participants_participant ON relationship_participants(participant_id);
