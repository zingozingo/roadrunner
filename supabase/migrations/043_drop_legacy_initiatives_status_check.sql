-- Migration 043: Drop legacy initiatives_status_check constraint
--
-- The engagements table (formerly "initiatives") has two overlapping CHECK
-- constraints on the status column:
--   - initiatives_status_check: status IN ('active','paused','closed')     ← legacy, wrong
--   - engagements_status_check: status IN ('active','blocked','completed','archived') ← correct
--
-- Both are enforced simultaneously, so the only usable value is 'active'.
-- This migration drops the legacy constraint, unblocking blocked/completed/archived.

ALTER TABLE public.engagements
  DROP CONSTRAINT initiatives_status_check;
