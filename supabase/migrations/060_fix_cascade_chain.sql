-- Migration 060: Fix FK cascade chain for meeting_notes and meetings
--
-- The cascade chain was broken: meeting_notes used NO ACTION for
-- meeting_id and partner_id, and meetings used SET NULL for partner_id.
-- This migration aligns FK behaviors so that:
--   - Delete partner → meetings CASCADE → meeting_notes CASCADE → tasks survive (SET NULL)
--   - Delete meeting → meeting_notes CASCADE → tasks survive (SET NULL)
--   - Delete engagement → meeting_notes.engagement_id SET NULL (notes survive)

BEGIN;

-- ================================================================
-- 1. meeting_notes.meeting_id: NO ACTION → CASCADE
--    (delete a meeting → its notes go too)
-- ================================================================
ALTER TABLE meeting_notes
  DROP CONSTRAINT meeting_notes_meeting_id_fkey;

ALTER TABLE meeting_notes
  ADD CONSTRAINT meeting_notes_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    ON DELETE CASCADE;

-- ================================================================
-- 2. meeting_notes.partner_id: NO ACTION → CASCADE
--    (delete a partner → their notes go too)
-- ================================================================
ALTER TABLE meeting_notes
  DROP CONSTRAINT meeting_notes_partner_id_fkey;

ALTER TABLE meeting_notes
  ADD CONSTRAINT meeting_notes_partner_id_fkey
    FOREIGN KEY (partner_id) REFERENCES partners(id)
    ON DELETE CASCADE;

-- ================================================================
-- 3. meeting_notes.engagement_id: NO ACTION → SET NULL
--    (delete an engagement → notes survive, lose the link)
-- ================================================================
ALTER TABLE meeting_notes
  DROP CONSTRAINT meeting_notes_engagement_id_fkey;

ALTER TABLE meeting_notes
  ADD CONSTRAINT meeting_notes_engagement_id_fkey
    FOREIGN KEY (engagement_id) REFERENCES engagements(id)
    ON DELETE SET NULL;

-- ================================================================
-- 4. meetings.partner_id: SET NULL → CASCADE
--    (delete a partner → their meetings go too)
-- ================================================================
ALTER TABLE meetings
  DROP CONSTRAINT meetings_partner_id_fkey;

ALTER TABLE meetings
  ADD CONSTRAINT meetings_partner_id_fkey
    FOREIGN KEY (partner_id) REFERENCES partners(id)
    ON DELETE CASCADE;

COMMIT;
