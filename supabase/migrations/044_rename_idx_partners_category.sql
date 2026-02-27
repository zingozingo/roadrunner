-- Migration 044: Rename stale index idx_partners_category → idx_partners_segment
--
-- The partners.category column was renamed to "segment" in migration 033,
-- but the index name was never updated. The index itself is correct (it
-- references the segment column), only the name is stale.

ALTER INDEX idx_partners_category RENAME TO idx_partners_segment;
