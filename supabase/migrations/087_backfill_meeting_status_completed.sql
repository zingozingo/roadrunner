-- Migration 087: Backfill meeting status scheduled → completed for meetings with notes.
-- One-time fix: the notes save path now auto-flips status, but 48 existing meetings
-- were created before that logic existed. Idempotent — only touches 'scheduled' rows.

UPDATE meetings
SET status = 'completed', updated_at = now()
WHERE status = 'scheduled'
  AND id IN (SELECT meeting_id FROM meeting_notes);
