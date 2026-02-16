-- 026: Add message_id FK to meetings for ICS provenance tracking
--
-- When a meeting is parsed from an ICS attachment on an inbound email,
-- message_id links it back to the source message. Nullable because
-- manually created meetings won't have one. SET NULL on delete so
-- deleting a message doesn't cascade-delete the meeting record.

ALTER TABLE meetings
  ADD COLUMN message_id uuid REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX idx_meetings_message_id ON meetings(message_id);

COMMENT ON COLUMN meetings.message_id IS 'Source message that contained the ICS attachment (null for manual meetings)';
