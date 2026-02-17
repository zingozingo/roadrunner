-- Backfill partner_id on engagements and meetings from partner_name → partners.name
-- Idempotent: only updates rows where partner_id IS NULL and a matching partner exists

UPDATE engagements e
SET    partner_id = p.id
FROM   partners p
WHERE  e.partner_name IS NOT NULL
  AND  e.partner_id IS NULL
  AND  lower(trim(e.partner_name)) = lower(trim(p.name));

UPDATE meetings m
SET    partner_id = p.id
FROM   partners p
WHERE  m.partner_name IS NOT NULL
  AND  m.partner_id IS NULL
  AND  lower(trim(m.partner_name)) = lower(trim(p.name));
