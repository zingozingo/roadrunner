ALTER TABLE approval_queue DROP COLUMN IF EXISTS options_sent;
ALTER TABLE approval_queue DROP COLUMN IF EXISTS sms_sent;
ALTER TABLE approval_queue DROP COLUMN IF EXISTS sms_sent_at;
