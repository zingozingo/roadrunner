-- Add classification tracking columns to messages table.
-- pending_review: true when the message needs human review (low confidence or new entity suggested)
-- classification_result: full Claude JSON response stored for later use in dashboard review

ALTER TABLE messages
  ADD COLUMN pending_review       boolean NOT NULL DEFAULT false,
  ADD COLUMN classification_result jsonb;

CREATE INDEX idx_messages_pending_review ON messages(pending_review) WHERE pending_review = true;