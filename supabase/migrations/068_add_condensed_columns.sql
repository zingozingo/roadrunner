-- Migration 068: Add condensed columns for two-version summary pyramid
-- Stores AI-generated condensed digests alongside full summaries.
-- Both nullable TEXT — populated lazily by AI, not required.

ALTER TABLE engagements ADD COLUMN condensed TEXT;
ALTER TABLE meeting_notes ADD COLUMN condensed TEXT;
