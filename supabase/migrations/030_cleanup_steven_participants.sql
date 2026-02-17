-- Consolidate duplicate Steven/forwarder participant records into one canonical record.
-- Root cause: pre-fix classifications created records with PRVS emails, SES corpmail
-- tracking IDs, and the wrong name ("Steven Terme" inferred from "sterme").
--
-- Idempotent: safe to run multiple times (ON CONFLICT, NOT EXISTS guards).

DO $$
DECLARE
  canonical_id UUID;
  stale_ids UUID[];
BEGIN
  -- Ensure the canonical record exists with correct data.
  -- If sterme@amazon.com already exists, update it; otherwise insert.
  INSERT INTO participants (id, name, email, organization, title)
  VALUES (gen_random_uuid(), 'Steven Romero', 'sterme@amazon.com', 'Amazon Web Services', 'Partner Development Manager')
  ON CONFLICT (email) DO UPDATE SET
    name = 'Steven Romero',
    organization = 'Amazon Web Services',
    title = 'Partner Development Manager';

  -- Get the canonical record ID
  SELECT id INTO canonical_id FROM participants WHERE email = 'sterme@amazon.com' LIMIT 1;

  -- Find all stale Steven records (PRVS, corpmail, gmail test, wrong name)
  SELECT array_agg(id) INTO stale_ids FROM participants
  WHERE id != canonical_id
  AND (
    email LIKE 'prvs=%sterme@amazon.com'      -- PRVS-wrapped variants
    OR email LIKE '%@corpmail.amazon.com'      -- SES tracking IDs
    OR email = 'stevenromero0817@gmail.com'    -- test data
    OR name IN ('Steven Terme', 'PDM Forwarder')
  );

  IF stale_ids IS NOT NULL THEN
    -- Repoint participant_links from stale records to canonical,
    -- but only where the canonical doesn't already have a link for that entity.
    UPDATE participant_links SET participant_id = canonical_id
    WHERE participant_id = ANY(stale_ids)
    AND NOT EXISTS (
      SELECT 1 FROM participant_links pl2
      WHERE pl2.participant_id = canonical_id
      AND pl2.entity_id = participant_links.entity_id
      AND pl2.entity_type = participant_links.entity_type
    );

    -- Delete leftover duplicate links that couldn't be repointed
    DELETE FROM participant_links WHERE participant_id = ANY(stale_ids);

    -- Delete the stale participant records
    DELETE FROM participants WHERE id = ANY(stale_ids);

    RAISE NOTICE 'Cleaned up % stale Steven participant records', array_length(stale_ids, 1);
  ELSE
    RAISE NOTICE 'No stale Steven participant records found — already clean';
  END IF;
END $$;
