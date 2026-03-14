-- 058: Rename aws_relationships → relationships (universal teams)
--
-- The relationships table represents teams within ANY organization — AWS internal,
-- third-party partners (Symbio, Tackle, BrightTalk), etc. The "aws_" prefix was
-- an artifact of the original single-org design. This migration makes it universal.
--
-- PostgreSQL ALTER TABLE ... RENAME TO automatically updates FK references in
-- dependent tables, so relationship_participants (from 057) follows automatically.
-- The junction table engagement_aws_relationships needs column + table rename.

BEGIN;

-- ============================================================
-- 1. Rename aws_relationships → relationships
-- ============================================================
-- FKs from engagement_aws_relationships and relationship_participants update automatically.
ALTER TABLE aws_relationships RENAME TO relationships;

-- ============================================================
-- 2. Rename engagement_aws_relationships → engagement_relationships
--    and rename aws_relationship_id → relationship_id
-- ============================================================

-- 2a. Rename the column first (before table rename, constraint names include table name)
ALTER TABLE engagement_aws_relationships
  RENAME COLUMN aws_relationship_id TO relationship_id;

-- 2b. Rename the table
ALTER TABLE engagement_aws_relationships RENAME TO engagement_relationships;

-- 2c. Rename the index to match new table/column names
ALTER INDEX idx_engagement_aws_rel_relationship
  RENAME TO idx_engagement_rel_relationship;

-- ============================================================
-- 3. Enhance relationships table for universal use
-- ============================================================

-- 3a. Add org_type to distinguish internal vs third-party teams
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS org_type TEXT
  CHECK (org_type IN ('internal', 'third_party'));

-- 3b. Backfill: all existing relationships are AWS internal teams
UPDATE relationships SET org_type = 'internal' WHERE org_type IS NULL;

-- 3c. Index for filtering by org_type
CREATE INDEX IF NOT EXISTS idx_relationships_org_type ON relationships(org_type);

-- 3d. Rename AWS-specific column names to universal names
ALTER TABLE relationships RENAME COLUMN aws_org TO org;
ALTER TABLE relationships RENAME COLUMN aws_service TO service;

COMMIT;
