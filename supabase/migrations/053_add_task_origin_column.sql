-- Add origin column to distinguish AI-generated vs manually-added tasks.
-- Allows re-summarization to delete+recreate AI tasks without losing manual ones.
ALTER TABLE note_tasks
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'
  CHECK (origin IN ('ai', 'manual'));

-- Backfill: existing tasks were all created manually (no AI materialization existed before this)
-- Default handles this — all existing rows get 'manual'.
