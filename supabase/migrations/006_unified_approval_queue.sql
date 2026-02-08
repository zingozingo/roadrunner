-- Unified approval queue: replaces pending_reviews and pending_event_approvals
-- with a single table that handles both initiative assignment and event creation approvals.

CREATE TABLE approval_queue (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  text        NOT NULL,   -- 'initiative_assignment' | 'event_creation'
  message_id            uuid        REFERENCES messages(id) ON DELETE SET NULL,
  initiative_id         uuid        REFERENCES initiatives(id) ON DELETE SET NULL,
  classification_result jsonb,                  -- full Claude output (initiative_assignment only)
  entity_data           jsonb,                  -- EventSuggestion (event_creation only)
  options_sent          jsonb,                  -- SMS options (initiative_assignment only)
  sms_sent              boolean     NOT NULL DEFAULT false,
  sms_sent_at           timestamptz,
  resolved              boolean     NOT NULL DEFAULT false,
  resolved_at           timestamptz,
  resolution            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_queue_unresolved ON approval_queue (resolved) WHERE resolved = false;

-- Migrate data from pending_reviews
INSERT INTO approval_queue (
  id, type, message_id, classification_result, options_sent,
  sms_sent, sms_sent_at, resolved, resolved_at, resolution, created_at
)
SELECT
  id, 'initiative_assignment', message_id, classification_result, options_sent,
  sms_sent, sms_sent_at, resolved, resolved_at, resolution, created_at
FROM pending_reviews;

-- Migrate data from pending_event_approvals
INSERT INTO approval_queue (
  id, type, message_id, initiative_id, entity_data,
  resolved, resolved_at, resolution, created_at
)
SELECT
  id, 'event_creation', source_message_id, initiative_id, event_data,
  resolved, resolved_at, resolution, created_at
FROM pending_event_approvals;

-- Drop old tables
DROP TABLE pending_reviews;
DROP TABLE pending_event_approvals;
