-- Migration 040: Add missing partner contact fields
-- Adds psa_email, account_manager (name+email), and pmm (name+email)
-- to match the cleaned-up Airtable Partners table structure.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS psa_email TEXT,
  ADD COLUMN IF NOT EXISTS account_manager TEXT,
  ADD COLUMN IF NOT EXISTS account_manager_email TEXT,
  ADD COLUMN IF NOT EXISTS pmm TEXT,
  ADD COLUMN IF NOT EXISTS pmm_email TEXT;
