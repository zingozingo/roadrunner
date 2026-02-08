-- Pending event approvals: stores new events identified by Claude
-- that need user approval before being created.
CREATE TABLE pending_event_approvals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_data        jsonb       NOT NULL,
  source_message_id uuid        REFERENCES messages(id),
  initiative_id     uuid        REFERENCES initiatives(id),
  resolved          boolean     NOT NULL DEFAULT false,
  resolved_at       timestamptz,
  resolution        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_event_approvals_unresolved
  ON pending_event_approvals (resolved)
  WHERE resolved = false;