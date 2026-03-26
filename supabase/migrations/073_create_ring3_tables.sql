-- Migration 073: Create Ring 3 tables
-- Strategic/financial posture data pulled from Airtable.
-- Decisions: #319 (Partner Goals), #321 (MPOPP/MDF separate), #325 (Goals gain engagement_id)

-- ── 1. Partner Goals (strategic milestones + operational KPIs) ──
CREATE TABLE partner_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'co_sell', 'co_build', 'co_market', 'compliance', 'program', 'vertical', 'operational'
  )),
  year INTEGER,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'completed', 'deferred'
  )),
  linked_program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
  notes TEXT,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_partner_goals_partner ON partner_goals(partner_id);

-- ── 2. Partner Program Enrollments ─────────────────────────────
CREATE TABLE partner_program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('competency', 'service_ready', 'program', 'credit_program')),
  status TEXT CHECK (status IN (
    'not_started', 'in_progress', 'submitted', 'approved', 'interested', 'denied', 'expired'
  )),
  date_achieved DATE,
  aws_stakeholder TEXT,
  notes TEXT,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, program_id)
);
CREATE INDEX idx_partner_program_enrollments_partner ON partner_program_enrollments(partner_id);

-- ── 3. Partner Event Participations ────────────────────────────
CREATE TABLE partner_event_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('invited', 'registered', 'sponsoring', 'confirming')),
  contacts_attending TEXT,
  notes TEXT,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, event_id)
);
CREATE INDEX idx_partner_event_participations_partner ON partner_event_participations(partner_id);

-- ── 4. MPOPP Funding ──────────────────────────────────────────
CREATE TABLE partner_funding_mpopp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('applied', 'approved', 'rejected', 'disbursed', 'needs_action')),
  half TEXT CHECK (half IN ('h1', 'h2')),
  track TEXT CHECK (track IN ('activate', 'grow')),
  allocated NUMERIC(12,2),
  spent NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_partner_funding_mpopp_partner ON partner_funding_mpopp(partner_id);

-- ── 5. MDF Funding ─────────────────────────────────────────────
CREATE TABLE partner_funding_mdf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  record_name TEXT,
  allocated NUMERIC(12,2),
  utilized NUMERIC(12,2) DEFAULT 0,
  date_allocated DATE,
  source TEXT CHECK (source IN ('competency_service_ready', 'custom')),
  recurrence TEXT CHECK (recurrence IN ('one_time', 'reloads_next_year')),
  notes TEXT,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_partner_funding_mdf_partner ON partner_funding_mdf(partner_id);
