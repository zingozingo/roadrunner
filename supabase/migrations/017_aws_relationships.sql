-- Migration 017: AWS Relationships table
-- Tracks AWS-side contacts and organizational relationships relevant to partner engagements.
-- Mirrors Airtable "AWS Relationships" table for bi-directional sync.

-- ============================================================
-- AWS_RELATIONSHIPS
-- ============================================================
CREATE TABLE aws_relationships (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  partner_name          text,
  aws_org               text,
  aws_service           text,
  relationship_type     text        CHECK (relationship_type IS NULL OR relationship_type IN (
                                      'Exec/Leader', 'Product Team', 'Program Team', 'Seller'
                                    )),
  primary_contact_name  text,
  primary_contact_email text,
  aws_contact_emails    text[]      NOT NULL DEFAULT '{}',
  strength              text        CHECK (strength IS NULL OR strength IN (
                                      'Strong', 'Building', 'New', 'Deferred'
                                    )),
  notes                 text,
  airtable_record_id    text        UNIQUE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_aws_relationships_partner_name ON aws_relationships(partner_name);
CREATE INDEX idx_aws_relationships_primary_contact_email ON aws_relationships(primary_contact_email);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE TRIGGER trg_aws_relationships_updated_at
  BEFORE UPDATE ON aws_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE aws_relationships IS 'AWS-side contacts and org relationships. Synced from Airtable.';
