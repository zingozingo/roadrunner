-- Migration 069: Drop engagement goal column
-- All code references removed in prior commit. Column data intentionally discarded.

ALTER TABLE engagements DROP COLUMN goal;
