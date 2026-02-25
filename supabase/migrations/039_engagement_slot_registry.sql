-- Slot registry fields — topic and goal are populated by Phase 2 classification.
-- engagement_type taxonomy will be defined after pattern analysis of real data.

ALTER TABLE engagements ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS engagement_type TEXT;
