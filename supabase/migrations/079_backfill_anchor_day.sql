-- Backfill anchor_day on series root meetings (where id = series_id).
-- Uses EXTRACT(DOW ...) which returns 0=Sunday..6=Saturday, matching JS Date.getDay().
UPDATE meetings
SET anchor_day = EXTRACT(DOW FROM meeting_date)::smallint
WHERE id = series_id
  AND recurrence_pattern IS NOT NULL
  AND meeting_date IS NOT NULL
  AND anchor_day IS NULL;
