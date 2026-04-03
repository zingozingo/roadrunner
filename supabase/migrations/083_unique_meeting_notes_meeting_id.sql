-- Migration 083: Enforce one-note-per-meeting at the database level.
-- Replaces the non-unique index from migration 051 with a unique index.
-- Zero duplicates confirmed before applying (41 rows, 0 conflicts).

DROP INDEX IF EXISTS idx_meeting_notes_meeting_id;
CREATE UNIQUE INDEX idx_meeting_notes_meeting_id ON meeting_notes(meeting_id);
