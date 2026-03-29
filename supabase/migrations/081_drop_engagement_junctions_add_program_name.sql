-- Migration 081: Drop dissolved engagement junction tables + add program_name to enrollments
--
-- engagement_programs (9 rows), engagement_events (1 row), engagement_relationships (2 orphaned rows)
-- are no longer referenced by any application code. Programs and events link at the partner level
-- via partner_program_enrollments and partner_event_participations (Ring 3).
--
-- Also adds program_name to partner_program_enrollments so every enrollment has a displayable
-- name regardless of whether the program_id FK resolves. Populated by pull sync on next run.

BEGIN;

-- Drop dissolved junction tables
DROP TABLE IF EXISTS engagement_relationships CASCADE;
DROP TABLE IF EXISTS engagement_programs CASCADE;
DROP TABLE IF EXISTS engagement_events CASCADE;

-- Add program_name column to partner_program_enrollments
ALTER TABLE partner_program_enrollments ADD COLUMN IF NOT EXISTS program_name text;

COMMIT;
