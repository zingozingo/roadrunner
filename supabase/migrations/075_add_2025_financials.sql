-- Migration 075: Rename ambiguous "prior_year" columns to year-explicit, add 2025 data
-- "prior_year" was 2024 data — make that explicit. Add 3 new 2025 financial columns.

-- Rename 2024 columns to be year-explicit
ALTER TABLE partners RENAME COLUMN mp_tcv_prior_year TO mp_tcv_2024;
ALTER TABLE partners RENAME COLUMN larr_prior_year TO larr_2024;

-- Add 2025 columns
ALTER TABLE partners ADD COLUMN IF NOT EXISTS mp_tcv_2025 NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS larr_2025 NUMERIC(12,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS mp_tcv_target_2025 NUMERIC(12,2);
