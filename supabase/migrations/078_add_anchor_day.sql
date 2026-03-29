-- Add anchor_day to meetings for recurrence day-of-week snapping.
-- 0=Sunday, 1=Monday, ..., 6=Saturday (JS Date.getDay() convention).
-- NULL for non-recurring meetings.
ALTER TABLE meetings ADD COLUMN anchor_day smallint;
