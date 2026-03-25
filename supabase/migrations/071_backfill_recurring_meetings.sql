-- Backfill 8 meetings that have is_recurring=true but no recurrence_pattern or series_id.
-- Sets weekly cadence and self-referencing series root so the spawn engine picks them up.
-- Idempotent: WHERE clause excludes already-configured rows.

UPDATE meetings
SET recurrence_pattern = 'weekly',
    series_id = id
WHERE is_recurring = true
  AND recurrence_pattern IS NULL
  AND series_id IS NULL;
