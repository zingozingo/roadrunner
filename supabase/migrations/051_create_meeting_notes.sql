-- Migration 051: Create meeting_notes and note_tasks tables
--
-- New "Notes" module for AI-powered meeting note-taking with partner context.
-- Supports both real-time meeting notes and historical seed notes (bulk paste
-- of old OneNote content). Seeds use date_range_start/end instead of meeting_date.

-- 1. meeting_notes table
CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  meeting_id UUID REFERENCES meetings(id),
  engagement_id UUID REFERENCES engagements(id),
  note_type TEXT NOT NULL DEFAULT 'meeting' CHECK (note_type IN ('meeting', 'seed')),
  title TEXT,
  meeting_date DATE,
  date_range_start DATE,
  date_range_end DATE,
  raw_notes TEXT NOT NULL,
  ai_summary TEXT,
  ai_tasks JSONB,
  ai_flags JSONB,
  context_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'summarized', 'finalized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. note_tasks table
CREATE TABLE note_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_note_id UUID NOT NULL REFERENCES meeting_notes(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id),
  description TEXT NOT NULL,
  owner TEXT NOT NULL CHECK (owner IN ('me', 'partner', 'aws_internal')),
  owner_name TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  due_date DATE,
  source TEXT NOT NULL DEFAULT 'meeting' CHECK (source IN ('meeting', 'seed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_meeting_notes_partner_id ON meeting_notes(partner_id);
CREATE INDEX idx_meeting_notes_meeting_id ON meeting_notes(meeting_id);
CREATE INDEX idx_meeting_notes_status ON meeting_notes(status);
CREATE INDEX idx_note_tasks_meeting_note_id ON note_tasks(meeting_note_id);
CREATE INDEX idx_note_tasks_partner_id ON note_tasks(partner_id);
CREATE INDEX idx_note_tasks_status ON note_tasks(status);

-- 4. Reuse existing updated_at trigger
CREATE TRIGGER update_meeting_notes_updated_at
  BEFORE UPDATE ON meeting_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_note_tasks_updated_at
  BEFORE UPDATE ON note_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
