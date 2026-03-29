-- Migration 080: Deduplicate case-mismatched participants and enforce case-insensitive email uniqueness
--
-- Problem: The classifier path inserted emails with original casing (e.g., "Nikolay.Nikolaev@progress.com")
-- while AT sync normalized to lowercase ("nikolay.nikolaev@progress.com"). The case-sensitive UNIQUE
-- constraint allowed both, creating duplicate participant records with different UUIDs.
--
-- Fix: Merge duplicates (reassign references to canonical lowercase record, delete MixedCase record),
-- then replace the case-sensitive unique constraint with a case-insensitive unique index.

BEGIN;

-- ============================================================
-- Step 1: Reassign references from Record B (MixedCase) to Record A (lowercase)
-- Delete-before-reassign pattern: remove B references that would conflict, then reassign the rest
-- ============================================================

-- Duplicate set 1: taylor.tackett@ninjaone.com
-- Record A: e04265d2-21d1-4a69-b64a-a1bf75208507 (lowercase, airtable_sync)
-- Record B: fb86bff3-a325-4de1-9380-c08ab84efd6e (MixedCase, classifier)

DELETE FROM engagement_participants
  WHERE participant_id = 'fb86bff3-a325-4de1-9380-c08ab84efd6e'
    AND engagement_id IN (
      SELECT engagement_id FROM engagement_participants
      WHERE participant_id = 'e04265d2-21d1-4a69-b64a-a1bf75208507'
    );
UPDATE engagement_participants SET participant_id = 'e04265d2-21d1-4a69-b64a-a1bf75208507'
  WHERE participant_id = 'fb86bff3-a325-4de1-9380-c08ab84efd6e';

DELETE FROM meeting_participants
  WHERE participant_id = 'fb86bff3-a325-4de1-9380-c08ab84efd6e'
    AND meeting_id IN (
      SELECT meeting_id FROM meeting_participants
      WHERE participant_id = 'e04265d2-21d1-4a69-b64a-a1bf75208507'
    );
UPDATE meeting_participants SET participant_id = 'e04265d2-21d1-4a69-b64a-a1bf75208507'
  WHERE participant_id = 'fb86bff3-a325-4de1-9380-c08ab84efd6e';

DELETE FROM partner_participants
  WHERE participant_id = 'fb86bff3-a325-4de1-9380-c08ab84efd6e'
    AND partner_id IN (
      SELECT partner_id FROM partner_participants
      WHERE participant_id = 'e04265d2-21d1-4a69-b64a-a1bf75208507'
    );
UPDATE partner_participants SET participant_id = 'e04265d2-21d1-4a69-b64a-a1bf75208507'
  WHERE participant_id = 'fb86bff3-a325-4de1-9380-c08ab84efd6e';


-- Duplicate set 2: derrick.roberts@ninjaone.com
-- Record A: d6f2b456-ad43-4635-b483-5814155f920f (lowercase, airtable_sync)
-- Record B: ea0e830a-4c91-4e49-b5d6-e01f2ec0d411 (MixedCase, classifier)

DELETE FROM engagement_participants
  WHERE participant_id = 'ea0e830a-4c91-4e49-b5d6-e01f2ec0d411'
    AND engagement_id IN (
      SELECT engagement_id FROM engagement_participants
      WHERE participant_id = 'd6f2b456-ad43-4635-b483-5814155f920f'
    );
UPDATE engagement_participants SET participant_id = 'd6f2b456-ad43-4635-b483-5814155f920f'
  WHERE participant_id = 'ea0e830a-4c91-4e49-b5d6-e01f2ec0d411';

DELETE FROM meeting_participants
  WHERE participant_id = 'ea0e830a-4c91-4e49-b5d6-e01f2ec0d411'
    AND meeting_id IN (
      SELECT meeting_id FROM meeting_participants
      WHERE participant_id = 'd6f2b456-ad43-4635-b483-5814155f920f'
    );
UPDATE meeting_participants SET participant_id = 'd6f2b456-ad43-4635-b483-5814155f920f'
  WHERE participant_id = 'ea0e830a-4c91-4e49-b5d6-e01f2ec0d411';

DELETE FROM partner_participants
  WHERE participant_id = 'ea0e830a-4c91-4e49-b5d6-e01f2ec0d411'
    AND partner_id IN (
      SELECT partner_id FROM partner_participants
      WHERE participant_id = 'd6f2b456-ad43-4635-b483-5814155f920f'
    );
UPDATE partner_participants SET participant_id = 'd6f2b456-ad43-4635-b483-5814155f920f'
  WHERE participant_id = 'ea0e830a-4c91-4e49-b5d6-e01f2ec0d411';


-- Duplicate set 3: nikolay.nikolaev@progress.com
-- Record A: 23e34210-358f-40de-bc1e-2619cf791c1c (lowercase, airtable_sync)
-- Record B: 2d5cd67a-989e-41d3-b775-ab0f8133e903 (MixedCase, classifier)

DELETE FROM engagement_participants
  WHERE participant_id = '2d5cd67a-989e-41d3-b775-ab0f8133e903'
    AND engagement_id IN (
      SELECT engagement_id FROM engagement_participants
      WHERE participant_id = '23e34210-358f-40de-bc1e-2619cf791c1c'
    );
UPDATE engagement_participants SET participant_id = '23e34210-358f-40de-bc1e-2619cf791c1c'
  WHERE participant_id = '2d5cd67a-989e-41d3-b775-ab0f8133e903';

DELETE FROM meeting_participants
  WHERE participant_id = '2d5cd67a-989e-41d3-b775-ab0f8133e903'
    AND meeting_id IN (
      SELECT meeting_id FROM meeting_participants
      WHERE participant_id = '23e34210-358f-40de-bc1e-2619cf791c1c'
    );
UPDATE meeting_participants SET participant_id = '23e34210-358f-40de-bc1e-2619cf791c1c'
  WHERE participant_id = '2d5cd67a-989e-41d3-b775-ab0f8133e903';

DELETE FROM partner_participants
  WHERE participant_id = '2d5cd67a-989e-41d3-b775-ab0f8133e903'
    AND partner_id IN (
      SELECT partner_id FROM partner_participants
      WHERE participant_id = '23e34210-358f-40de-bc1e-2619cf791c1c'
    );
UPDATE partner_participants SET participant_id = '23e34210-358f-40de-bc1e-2619cf791c1c'
  WHERE participant_id = '2d5cd67a-989e-41d3-b775-ab0f8133e903';


-- Duplicate set 4: erzan.uygur@ninjaone.com
-- Record A: 4e034852-953d-423a-ade7-9d323716d92a (lowercase, airtable_sync)
-- Record B: 59eaa886-4d99-49db-baff-c5a5e54b1462 (MixedCase, classifier)

DELETE FROM engagement_participants
  WHERE participant_id = '59eaa886-4d99-49db-baff-c5a5e54b1462'
    AND engagement_id IN (
      SELECT engagement_id FROM engagement_participants
      WHERE participant_id = '4e034852-953d-423a-ade7-9d323716d92a'
    );
UPDATE engagement_participants SET participant_id = '4e034852-953d-423a-ade7-9d323716d92a'
  WHERE participant_id = '59eaa886-4d99-49db-baff-c5a5e54b1462';

DELETE FROM meeting_participants
  WHERE participant_id = '59eaa886-4d99-49db-baff-c5a5e54b1462'
    AND meeting_id IN (
      SELECT meeting_id FROM meeting_participants
      WHERE participant_id = '4e034852-953d-423a-ade7-9d323716d92a'
    );
UPDATE meeting_participants SET participant_id = '4e034852-953d-423a-ade7-9d323716d92a'
  WHERE participant_id = '59eaa886-4d99-49db-baff-c5a5e54b1462';

DELETE FROM partner_participants
  WHERE participant_id = '59eaa886-4d99-49db-baff-c5a5e54b1462'
    AND partner_id IN (
      SELECT partner_id FROM partner_participants
      WHERE participant_id = '4e034852-953d-423a-ade7-9d323716d92a'
    );
UPDATE partner_participants SET participant_id = '4e034852-953d-423a-ade7-9d323716d92a'
  WHERE participant_id = '59eaa886-4d99-49db-baff-c5a5e54b1462';


-- ============================================================
-- Step 2: Delete the 4 duplicate Record B rows
-- ============================================================

DELETE FROM participants WHERE id IN (
  'fb86bff3-a325-4de1-9380-c08ab84efd6e',
  'ea0e830a-4c91-4e49-b5d6-e01f2ec0d411',
  '2d5cd67a-989e-41d3-b775-ab0f8133e903',
  '59eaa886-4d99-49db-baff-c5a5e54b1462'
);


-- ============================================================
-- Step 3: Replace case-sensitive unique constraint with case-insensitive unique index
-- ============================================================

-- Drop the auto-generated case-sensitive constraint from CREATE TABLE
ALTER TABLE participants DROP CONSTRAINT participants_email_key;

-- Create case-insensitive unique index — prevents future duplicates at the DB level
CREATE UNIQUE INDEX participants_email_lower_idx ON participants (lower(email));

COMMIT;
