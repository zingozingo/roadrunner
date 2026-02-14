-- 013_add_forwarder_and_headers_to_messages.sql
-- Store forwarder identity and original email headers on messages.
--   forwarder_email/name: the PDM who forwarded this email to Relay
--   to_header/cc_header: original To and CC from the email

BEGIN;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarder_email text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarder_name text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_header text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS cc_header text;

COMMENT ON COLUMN messages.forwarder_email IS 'Email of the PDM who forwarded this message to Relay';
COMMENT ON COLUMN messages.forwarder_name IS 'Display name of the forwarder';
COMMENT ON COLUMN messages.to_header IS 'Original To header from the email';
COMMENT ON COLUMN messages.cc_header IS 'Original CC header from the email';

COMMIT;
