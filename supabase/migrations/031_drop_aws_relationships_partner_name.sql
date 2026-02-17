-- Migration 031: Drop partner_name from aws_relationships
--
-- Relationships are now partner-agnostic catalog records.
-- Partner context flows through junction tables:
--   engagement_aws_relationships (per-engagement)
--   meeting_aws_relationships (per-meeting)

DROP INDEX IF EXISTS idx_aws_relationships_partner_name;
ALTER TABLE aws_relationships DROP COLUMN IF EXISTS partner_name;
