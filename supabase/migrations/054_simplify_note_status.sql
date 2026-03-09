-- Simplify meeting_notes status from 3 values to 2: draft, complete
-- "summarized" and "finalized" collapse into "complete"

-- Step 1: Drop old constraint (must happen before UPDATE, or CHECK rejects 'complete')
ALTER TABLE meeting_notes DROP CONSTRAINT IF EXISTS meeting_notes_status_check;

-- Step 2: Migrate existing rows
UPDATE meeting_notes SET status = 'complete' WHERE status IN ('summarized', 'finalized');

-- Step 3: Add new constraint
ALTER TABLE meeting_notes ADD CONSTRAINT meeting_notes_status_check CHECK (status IN ('draft', 'complete'));
