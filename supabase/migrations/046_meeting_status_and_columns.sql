-- Migration 046: Meeting status expansion and schema cleanup
--
-- 1. Add 'cancelled' to meetings.status CHECK constraint
-- 2. Drop meeting_type column (Airtable-only manual field going forward)
-- 3. Add sequence column (ICS SEQUENCE for update tracking)
-- 4. Add is_recurring column (ICS RRULE detection)

-- Step 1: Replace the status CHECK constraint
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'did_not_occur'));

-- Step 2: Drop meeting_type (nothing writes to it from the pipeline)
ALTER TABLE meetings DROP COLUMN IF EXISTS meeting_type;

-- Step 3: Add sequence for ICS update tracking
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS sequence INTEGER DEFAULT NULL;

-- Step 4: Add is_recurring for RRULE detection
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
