-- Add JSONB contact columns for unified contact format
-- Phase 2 of contact standardization: new columns coexist with old ones (dual-write)
-- Old columns will be dropped in Phase 3 after all readers migrate

ALTER TABLE partners ADD COLUMN IF NOT EXISTS aws_team jsonb DEFAULT '[]'::jsonb;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_contacts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE aws_relationships ADD COLUMN IF NOT EXISTS contacts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organizer_name text;
