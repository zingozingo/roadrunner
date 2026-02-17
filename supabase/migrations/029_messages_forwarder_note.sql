-- Add forwarder_note column to messages table.
-- Stores the PDM's annotation/note when forwarding an email to Relay.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarder_note text;
