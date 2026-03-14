-- Decision #169/#180: Replace polymorphic participant_links with dedicated join tables.
-- Chunks A+B rewired all code (classifier pipeline, push, phase1, UI) to use engagement_participants.
-- Zero code references remain. Zero rows in table. Safe to drop.
DROP TABLE IF EXISTS participant_links;
