-- Drop deprecated is_recurring column from meetings.
-- recurrence_pattern is the source of truth for recurrence.
ALTER TABLE meetings DROP COLUMN IF EXISTS is_recurring;
