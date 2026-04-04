-- Migration 084: Replace programs.type with category/subtype + new AT fields.
-- Airtable "Type" field (fldCd7TnUOgxnWmNt) was deleted; replaced by Category,
-- Subtype, MDF Value, SCA Stackable, Partner Path, Parent Program.

-- 1. Drop old type column and its CHECK constraint
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_type_check;
ALTER TABLE programs DROP COLUMN IF EXISTS type;

-- 2. Add new columns
ALTER TABLE programs ADD COLUMN category TEXT;
ALTER TABLE programs ADD CONSTRAINT programs_category_check
  CHECK (category IS NULL OR category IN ('Specialization', 'Funding', 'Agreement', 'Operational', 'Enablement'));

ALTER TABLE programs ADD COLUMN subtype TEXT;
ALTER TABLE programs ADD CONSTRAINT programs_subtype_check
  CHECK (subtype IS NULL OR subtype IN ('Competency', 'Service Ready', 'MSP', 'Sub-Category', 'MDF', 'Credit Program', 'Hybrid', 'SCA', 'Co-Sell', 'Channel', 'Migration', 'Workshop', 'Certification'));

ALTER TABLE programs ADD COLUMN mdf_value INTEGER;

ALTER TABLE programs ADD COLUMN sca_stackable BOOLEAN DEFAULT false;

ALTER TABLE programs ADD COLUMN partner_path TEXT;
ALTER TABLE programs ADD CONSTRAINT programs_partner_path_check
  CHECK (partner_path IS NULL OR partner_path IN ('Software', 'Services', 'Both'));

ALTER TABLE programs ADD COLUMN parent_program_airtable_id TEXT;
