-- Roadrunner (Relay) Initial Schema
-- Run this against your Supabase project via the SQL editor

-- ============================================================
-- INITIATIVES
-- ============================================================
CREATE TABLE initiatives (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'closed')),
  summary       text,
  partner_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text    NOT NULL,
  type            text    NOT NULL
                          CHECK (type IN ('conference', 'summit', 'deadline', 'review_cycle', 'meeting_series')),
  start_date      date,
  end_date        date,
  date_precision  text    NOT NULL DEFAULT 'exact'
                          CHECK (date_precision IN ('exact', 'week', 'month', 'quarter')),
  location        text,
  description     text,
  source          text    NOT NULL DEFAULT 'email_extracted'
                          CHECK (source IN ('seed', 'email_extracted', 'user_created')),
  verified        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PROGRAMS
-- ============================================================
CREATE TABLE programs (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text    NOT NULL,
  description   text,
  eligibility   text,
  url           text,
  status        text    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ENTITY_LINKS (generic many-to-many between initiatives, events, programs)
-- ============================================================
CREATE TABLE entity_links (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type   text    NOT NULL CHECK (source_type IN ('initiative', 'event', 'program')),
  source_id     uuid    NOT NULL,
  target_type   text    NOT NULL CHECK (target_type IN ('initiative', 'event', 'program')),
  target_id     uuid    NOT NULL,
  relationship  text    NOT NULL,
  context       text,
  created_by    text    NOT NULL DEFAULT 'ai'
                        CHECK (created_by IN ('ai', 'user')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MESSAGES (inbound emails)
-- ============================================================
CREATE TABLE messages (
  id                        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id             uuid    REFERENCES initiatives(id),
  sender_name               text,
  sender_email              text,
  sent_at                   timestamptz,
  subject                   text,
  body_text                 text,
  body_raw                  text,
  content_type              text    CHECK (content_type IN (
                                      'initiative_email', 'event_info', 'program_info',
                                      'meeting_invite', 'mixed', 'noise'
                                    )),
  classification_confidence float,
  linked_entities           jsonb   NOT NULL DEFAULT '[]'::jsonb,
  forwarded_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PARTICIPANTS
-- ============================================================
CREATE TABLE participants (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text    UNIQUE NOT NULL,
  name          text,
  organization  text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PARTICIPANT_LINKS
-- ============================================================
CREATE TABLE participant_links (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  uuid    NOT NULL REFERENCES participants(id),
  entity_type     text    NOT NULL CHECK (entity_type IN ('initiative', 'event')),
  entity_id       uuid    NOT NULL,
  role            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- NOTES
-- ============================================================
CREATE TABLE notes (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id   uuid    NOT NULL REFERENCES initiatives(id),
  content         text    NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_messages_initiative_id       ON messages(initiative_id);
CREATE INDEX idx_messages_forwarded_at        ON messages(forwarded_at);
CREATE INDEX idx_entity_links_source          ON entity_links(source_type, source_id);
CREATE INDEX idx_entity_links_target          ON entity_links(target_type, target_id);
CREATE INDEX idx_participant_links_participant ON participant_links(participant_id);
CREATE INDEX idx_participant_links_entity     ON participant_links(entity_type, entity_id);

-- ============================================================
-- TRIGGER: auto-update updated_at on initiatives
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_initiatives_updated_at
  BEFORE UPDATE ON initiatives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
