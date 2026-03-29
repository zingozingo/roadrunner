-- Add anchor_day to meetings for recurrence day-of-week snapping.
-- 0=Sunday, 1=Monday, ..., 6=Saturday (JS Date.getDay() convention).
-- For monthly/quarterly: 1-31 (day of month).
-- NULL for non-recurring meetings and series children (read from root).
--
-- Migrations 078/079 tracked this but DDL never executed in production.
-- This migration is the authoritative source.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS anchor_day smallint;

-- Backfill anchor_day on series root meetings (where id = series_id).
-- Weekly/biweekly: day-of-week via EXTRACT(DOW), 0=Sunday..6=Saturday.
-- Monthly/quarterly would use day-of-month, but no monthly/quarterly series exist yet.
UPDATE meetings
SET anchor_day = EXTRACT(DOW FROM meeting_date)::smallint
WHERE id = series_id
  AND recurrence_pattern IS NOT NULL
  AND meeting_date IS NOT NULL
  AND anchor_day IS NULL;
