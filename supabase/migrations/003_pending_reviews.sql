-- Pending reviews: tracks SMS-based classification prompts sent to the user.
-- Each row represents a message that needs human review via SMS.

CREATE TABLE pending_reviews (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id            uuid        NOT NULL REFERENCES messages(id),
  sms_sent              boolean     NOT NULL DEFAULT false,
  sms_sent_at           timestamptz,
  resolved              boolean     NOT NULL DEFAULT false,
  resolved_at           timestamptz,
  resolution            text,
  classification_result jsonb       NOT NULL,
  options_sent          jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_reviews_unresolved ON pending_reviews(created_at DESC) WHERE resolved = false;
CREATE INDEX idx_pending_reviews_message    ON pending_reviews(message_id);
