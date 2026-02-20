-- 1. Add geo to events
ALTER TABLE events ADD COLUMN geo text;
ALTER TABLE events ADD CONSTRAINT events_geo_check
  CHECK (geo IS NULL OR geo IN ('NAMER','EMEA','APJ','LATAM','GCR'));

-- 2. Add what_they_do to partners
ALTER TABLE partners ADD COLUMN what_they_do text;

-- 3. Expand program type CHECK constraint
ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_type_check;
ALTER TABLE programs ADD CONSTRAINT programs_type_check
  CHECK (type IS NULL OR type IN ('Competency','Service Ready','SCA','Program','Credit Program','Funding','Channel','Enablement'));
