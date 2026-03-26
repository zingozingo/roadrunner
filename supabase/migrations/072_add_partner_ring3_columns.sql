-- Migration 072: Add Ring 3 columns to partners table
-- Financial goals (from Co-Sell Goals dissolution, decision #318),
-- financial actuals (AT-pulled, decision #326),
-- JVP (decision #320), CRM restructure (decision #322).

-- ── Financial goals (migrated from Co-Sell Goals table) ──────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS mp_tcv_goal NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS larr_goal NUMERIC(12,2);

-- ── Financial actuals (pulled from Airtable) ─────────────────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS mp_tcv_ytd NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS larr_ytd NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS mp_tcv_prior_year NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS larr_prior_year NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS mp_tcv_projected_annual NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS larr_projected_annual NUMERIC(12,2);

-- ── Joint Value Proposition (decision #320) ──────────────────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS joint_value_proposition TEXT;

-- ── CRM restructure (decision #322) ─────────────────────────
-- Rename crm_status to crm_platform (it was always about the platform, not a status)
ALTER TABLE partners RENAME COLUMN crm_status TO crm_platform;
-- Clear freeform values that would violate the new CHECK constraint
UPDATE partners SET crm_platform = NULL WHERE crm_platform IS NOT NULL;
-- Constrain to known platforms
ALTER TABLE partners ADD CONSTRAINT partners_crm_platform_check
  CHECK (crm_platform IS NULL OR crm_platform IN ('suger', 'labra', 'tackle', 'native', 'none'));
-- Free-text notes for CRM context
ALTER TABLE partners ADD COLUMN IF NOT EXISTS crm_notes TEXT;
