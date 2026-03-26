-- Migration 074: Relax program enrollment constraints
-- program_id nullable (many enrollments have no linked record yet)
-- Drop UNIQUE(partner_id, program_id) — a partner can have multiple enrollments
-- without a resolved program, and airtable_id UNIQUE is the real dedup key.

ALTER TABLE partner_program_enrollments ALTER COLUMN program_id DROP NOT NULL;
ALTER TABLE partner_program_enrollments DROP CONSTRAINT IF EXISTS partner_program_enrollments_partner_id_program_id_key;
