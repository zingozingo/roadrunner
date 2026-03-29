-- Drop the Relationships system (dissolution per North Star Part 5).
-- Contacts already exist in participants table via prior sync.
-- Order: junction tables first, then main table.

DROP TABLE IF EXISTS relationship_participants CASCADE;
DROP TABLE IF EXISTS engagement_relationships CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;
