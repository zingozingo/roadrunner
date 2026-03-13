-- 056: Partner context table for scratchpad entries, AI synthesis, and seed dumps
-- Supports the "Living Context" section on partner detail pages

CREATE TABLE partner_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'scratchpad' CHECK (source IN ('scratchpad', 'ai_synthesis', 'seed_dump')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_context_partner ON partner_context(partner_id);
CREATE INDEX idx_partner_context_source ON partner_context(partner_id, source);

-- Reuse existing updated_at trigger function
CREATE TRIGGER update_partner_context_updated_at
  BEFORE UPDATE ON partner_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
