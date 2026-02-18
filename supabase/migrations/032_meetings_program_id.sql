-- 032: Add program_id FK to meetings
--
-- Meetings can now be linked to a program (e.g., ISV Accelerate exec review).
-- Nullable — most meetings aren't program-specific. SET NULL on delete
-- so deleting a program doesn't cascade-delete the meeting record.

ALTER TABLE meetings
  ADD COLUMN program_id uuid REFERENCES programs(id) ON DELETE SET NULL;

CREATE INDEX idx_meetings_program_id ON meetings(program_id);

COMMENT ON COLUMN meetings.program_id IS 'Optional link to a program (e.g., meeting about Security Competency review)';
