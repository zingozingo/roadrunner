-- 065: Replace polymorphic entity_links with typed junction tables.
-- entity_links used source_type/target_type polymorphism with no FK constraints.
-- In practice only engagement→program and engagement→event links exist.
-- New tables: engagement_programs, engagement_events (with proper FKs + CASCADE).

-- ============================================================
-- 1. Create engagement_programs
-- ============================================================
CREATE TABLE engagement_programs (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   uuid         NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  program_id      uuid         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  context         text,
  created_by      text         NOT NULL DEFAULT 'ai'
                               CHECK (created_by IN ('ai', 'user')),
  created_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(engagement_id, program_id)
);

CREATE INDEX idx_engagement_programs_engagement ON engagement_programs(engagement_id);
CREATE INDEX idx_engagement_programs_program ON engagement_programs(program_id);

-- ============================================================
-- 2. Create engagement_events
-- ============================================================
CREATE TABLE engagement_events (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   uuid         NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  event_id        uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  context         text,
  created_by      text         NOT NULL DEFAULT 'ai'
                               CHECK (created_by IN ('ai', 'user')),
  created_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(engagement_id, event_id)
);

CREATE INDEX idx_engagement_events_engagement ON engagement_events(engagement_id);
CREATE INDEX idx_engagement_events_event ON engagement_events(event_id);

-- ============================================================
-- 3. Migrate existing data
-- ============================================================
INSERT INTO engagement_programs (engagement_id, program_id, context, created_by, created_at)
SELECT source_id, target_id, context, created_by, created_at
FROM entity_links
WHERE source_type = 'engagement' AND target_type = 'program';

INSERT INTO engagement_events (engagement_id, event_id, context, created_by, created_at)
SELECT source_id, target_id, context, created_by, created_at
FROM entity_links
WHERE source_type = 'engagement' AND target_type = 'event';

-- ============================================================
-- 4. Drop entity_links (indexes drop automatically with table)
-- ============================================================
DROP TABLE entity_links;
