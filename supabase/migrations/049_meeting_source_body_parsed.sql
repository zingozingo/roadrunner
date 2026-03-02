-- Migration 049: Add 'body_parsed' to meetings source check constraint
-- Supports fallback meeting detection from plain-text email bodies
-- (e.g., Outlook "Original Appointment" blocks that lack ICS data)

ALTER TABLE meetings DROP CONSTRAINT meetings_source_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_source_check
  CHECK (source IN ('manual', 'ics_parsed', 'body_parsed'));
