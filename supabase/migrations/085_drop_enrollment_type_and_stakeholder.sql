-- Migration 085: Drop type and aws_stakeholder from partner_program_enrollments.
-- AT fields Type (fldu4oNGIHu7h5et5) and AWS Stakeholder (fldi0bBVH4VHkjIM3) were
-- deleted from Airtable. Enrollment type is now derived from the linked program's
-- category + subtype via the program_id FK join.

ALTER TABLE partner_program_enrollments DROP CONSTRAINT IF EXISTS partner_program_enrollments_type_check;
ALTER TABLE partner_program_enrollments DROP COLUMN IF EXISTS type;
ALTER TABLE partner_program_enrollments DROP COLUMN IF EXISTS aws_stakeholder;
