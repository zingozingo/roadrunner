-- Add engagement_id to tasks for workstream organization.
-- Tasks survive engagement deletion (SET NULL) — they're partner-level entities.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS engagement_id UUID
    REFERENCES engagements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_engagement_id ON tasks(engagement_id);
