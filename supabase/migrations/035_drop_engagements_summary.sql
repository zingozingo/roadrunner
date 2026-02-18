-- Drop the legacy summary column from engagements.
-- It was always a copy of current_state (see migration 010 comment).
-- current_state is the sole source of truth.
ALTER TABLE engagements DROP COLUMN summary;
