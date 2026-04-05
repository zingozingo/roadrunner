-- Migration 086: Align events and partner_event_participations with Airtable restructure.
--
-- Events: add event_url, internal_links, archived; drop partner_day boolean
-- (partner_day_date is now the sole indicator); update type CHECK to remove
-- deadline/review_cycle/kickoff, add webinar/roundtable.
--
-- Partner Event Participations: add sponsoring boolean; drop contacts_attending;
-- update status CHECK to interested/invited/registered/attended/declined
-- (sponsoring is now an orthogonal checkbox, not a status value).

-- ============================================================
-- EVENTS TABLE
-- ============================================================

-- 1. Add new columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS internal_links TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop partner_day boolean (partner_day_date remains as sole indicator)
ALTER TABLE events DROP COLUMN IF EXISTS partner_day;

-- 3. Update type CHECK constraint
--    Old: conference, summit, workshop, kickoff, trade_show, deadline, review_cycle, training
--    New: conference, summit, workshop, trade_show, training, webinar, roundtable
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('conference', 'summit', 'workshop', 'trade_show', 'training', 'webinar', 'roundtable'));

-- ============================================================
-- PARTNER EVENT PARTICIPATIONS TABLE
-- ============================================================

-- 4. Add sponsoring boolean
ALTER TABLE partner_event_participations ADD COLUMN IF NOT EXISTS sponsoring BOOLEAN NOT NULL DEFAULT false;

-- 5. Drop contacts_attending
ALTER TABLE partner_event_participations DROP COLUMN IF EXISTS contacts_attending;

-- 6. Update status CHECK constraint
--    Old: invited, registered, sponsoring, confirming
--    New: interested, invited, registered, attended, declined
ALTER TABLE partner_event_participations DROP CONSTRAINT IF EXISTS partner_event_participations_status_check;
ALTER TABLE partner_event_participations ADD CONSTRAINT partner_event_participations_status_check
  CHECK (status IS NULL OR status IN ('interested', 'invited', 'registered', 'attended', 'declined'));
