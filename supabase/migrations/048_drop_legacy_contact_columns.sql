-- Migration 048: Drop legacy scalar contact columns
-- Phase 3 of contact standardization. All consumers now read from JSONB columns.
-- JSONB columns: partners.aws_team, partners.partner_contacts, aws_relationships.contacts

ALTER TABLE partners
  DROP COLUMN IF EXISTS alliance_lead,
  DROP COLUMN IF EXISTS alliance_lead_email,
  DROP COLUMN IF EXISTS psa,
  DROP COLUMN IF EXISTS psa_email,
  DROP COLUMN IF EXISTS account_manager,
  DROP COLUMN IF EXISTS account_manager_email,
  DROP COLUMN IF EXISTS pmm,
  DROP COLUMN IF EXISTS pmm_email,
  DROP COLUMN IF EXISTS partner_contact_emails;

ALTER TABLE aws_relationships
  DROP COLUMN IF EXISTS primary_contact_name,
  DROP COLUMN IF EXISTS primary_contact_email,
  DROP COLUMN IF EXISTS aws_contact_emails;
