-- Rename category → segment, sub_category → focus_area (text → text[])
-- Add aws_stickiness and key_aws_services columns

ALTER TABLE partners RENAME COLUMN category TO segment;
ALTER TABLE partners RENAME COLUMN sub_category TO focus_area;

ALTER TABLE partners
  ALTER COLUMN focus_area TYPE text[]
  USING CASE WHEN focus_area IS NOT NULL THEN ARRAY[focus_area] ELSE '{}' END;

ALTER TABLE partners
  ADD COLUMN aws_stickiness text,
  ADD COLUMN key_aws_services text[] NOT NULL DEFAULT '{}';
