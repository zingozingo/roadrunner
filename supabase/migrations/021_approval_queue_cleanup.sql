-- 021: approval_queue cleanup
-- - Drop entity_data column (always null; event_creation approval path was removed)
-- - Add CHECK constraint on type (only 'engagement_assignment' is used by the app)

ALTER TABLE approval_queue DROP COLUMN entity_data;

ALTER TABLE approval_queue
  ADD CONSTRAINT approval_queue_type_check
  CHECK (type = 'engagement_assignment');
