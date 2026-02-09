-- Phase 3: Drop orphaned timeline_entries column from initiatives.
-- This column was added in 008 but is no longer written or read by any code path.
-- The data was AI-fabricated timeline entries and is safe to discard.
ALTER TABLE initiatives DROP COLUMN IF EXISTS timeline_entries;
