-- Allow participants without email addresses (name-only participants extracted from email bodies)
ALTER TABLE participants ALTER COLUMN email DROP NOT NULL;
