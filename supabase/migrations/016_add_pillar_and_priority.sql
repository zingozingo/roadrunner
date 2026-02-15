-- Migration 016: Add pillar and priority columns to engagements table
-- Mirrors Airtable Partner Engagements schema for strategic context.
--   pillar:   Co-Sell / Co-Market / Co-Build (nullable — not all engagements have one)
--   priority: Mandated / High / Normal / Opportunistic (nullable — assigned by PDM)

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS pillar text
  CHECK (pillar IS NULL OR pillar IN ('Co-Sell', 'Co-Market', 'Co-Build'));

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS priority text
  CHECK (priority IS NULL OR priority IN ('Mandated', 'High', 'Normal', 'Opportunistic'));

COMMENT ON COLUMN engagements.pillar IS 'Strategic pillar: Co-Sell, Co-Market, or Co-Build. Nullable until classified.';
COMMENT ON COLUMN engagements.priority IS 'PDM priority: Mandated, High, Normal, or Opportunistic. Nullable until triaged.';
