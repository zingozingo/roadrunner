-- Structured initiative data: replace free-text summary parsing with discrete fields
ALTER TABLE initiatives ADD COLUMN current_state text;
ALTER TABLE initiatives ADD COLUMN timeline_entries jsonb DEFAULT '[]';
ALTER TABLE initiatives ADD COLUMN open_items jsonb DEFAULT '[]';
