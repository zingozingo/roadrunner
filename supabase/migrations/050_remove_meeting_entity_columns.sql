-- Migration 050: Remove redundant meeting entity columns
--
-- Meetings inherit ALL entity relationships through their parent engagement.
-- The engagement is the single source of truth for program, event, and AWS
-- relationship connections (engagement-hub architecture, Decision #96+).
--
-- Airtable already implements this via lookup fields through the Engagement link.
-- The automated pipeline never writes event_id, program_id, or
-- meeting_aws_relationships — they are dead code.
--
-- Also removes "body_parsed" from the source CHECK constraint — the fallback
-- meeting detector was deleted in Decision #97.

-- 1. Drop the meeting_aws_relationships junction table
DROP TABLE IF EXISTS meeting_aws_relationships;

-- 2. Drop indexes before columns
DROP INDEX IF EXISTS idx_meetings_event_id;
DROP INDEX IF EXISTS idx_meetings_program_id;

-- 3. Drop the redundant FK columns
ALTER TABLE meetings DROP COLUMN IF EXISTS event_id;
ALTER TABLE meetings DROP COLUMN IF EXISTS program_id;

-- 4. Tighten source CHECK constraint (remove body_parsed)
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_source_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_source_check
  CHECK (source = ANY (ARRAY['manual'::text, 'ics_parsed'::text]));
