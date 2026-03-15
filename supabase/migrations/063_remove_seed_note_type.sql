-- 063: Remove 'seed' from meeting_notes note_type CHECK constraint.
-- Seed notes have been replaced by partner_context scratchpad entries.
-- All existing seed rows were manually deleted from the database.

ALTER TABLE meeting_notes DROP CONSTRAINT meeting_notes_note_type_check;
ALTER TABLE meeting_notes ADD CONSTRAINT meeting_notes_note_type_check
  CHECK (note_type IN ('meeting'));
