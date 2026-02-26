-- Migration 041: Field Contract Alignment
-- Aligns Roadrunner schema with finalized Airtable field contract.
-- Changes: programs (5), events (3), meetings (1 status overhaul), engagements (5)

BEGIN;

-- ============================================================
-- PROGRAMS (5 changes)
-- ============================================================

-- 1. Drop url column
ALTER TABLE programs DROP COLUMN IF EXISTS url;

-- 2. Drop status column (inline CHECK constraint has auto-generated name)
--    Drop any CHECK constraint on programs.status first
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'programs'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE programs DROP CONSTRAINT %I', cname);
  END IF;
END$$;
ALTER TABLE programs DROP COLUMN IF EXISTS status;

-- 3. Rename eligibility → requirements
ALTER TABLE programs RENAME COLUMN eligibility TO requirements;

-- 4. Add what_it_unlocks
ALTER TABLE programs ADD COLUMN what_it_unlocks TEXT;

-- 5. Add notes
ALTER TABLE programs ADD COLUMN notes TEXT;

-- ============================================================
-- EVENTS (3 additions)
-- ============================================================

-- 6. sponsor_option
ALTER TABLE events ADD COLUMN sponsor_option BOOLEAN NOT NULL DEFAULT false;

-- 7. partner_day
ALTER TABLE events ADD COLUMN partner_day BOOLEAN NOT NULL DEFAULT false;

-- 8. partner_day_date
ALTER TABLE events ADD COLUMN partner_day_date DATE;

-- ============================================================
-- MEETINGS — status overhaul
-- ============================================================

-- 9. Migrate existing status values to new lowercase values
UPDATE meetings SET status = 'scheduled'     WHERE status IN ('Scheduling', 'Invites Sent', 'Confirmed');
UPDATE meetings SET status = 'completed'     WHERE status = 'Completed';
UPDATE meetings SET status = 'did_not_occur' WHERE status = 'Did Not Occur';

-- 10. Drop old CHECK constraint
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;

-- 11. Change default
ALTER TABLE meetings ALTER COLUMN status SET DEFAULT 'scheduled';

-- 12. Add new CHECK constraint
ALTER TABLE meetings ADD CONSTRAINT meetings_status_check
  CHECK (status IN ('scheduled', 'completed', 'did_not_occur'));

-- ============================================================
-- ENGAGEMENTS (5 changes)
-- ============================================================

-- 13. Add program_id FK
ALTER TABLE engagements ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE SET NULL;

-- 14. Add start_date
ALTER TABLE engagements ADD COLUMN start_date DATE;

-- 15. Add target_completion
ALTER TABLE engagements ADD COLUMN target_completion DATE;

-- 16. Drop old CHECK constraint
ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_status_check;

-- 17. Add new CHECK constraint (keep default 'active')
ALTER TABLE engagements ADD CONSTRAINT engagements_status_check
  CHECK (status IN ('active', 'planned', 'blocked', 'completed', 'archived'));

COMMIT;
