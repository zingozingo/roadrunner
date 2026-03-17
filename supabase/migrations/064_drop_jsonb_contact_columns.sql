-- Drop JSONB contact columns now that all reads use the participants registry.
-- partners.aws_team, partners.partner_contacts → partner_participants join table
-- relationships.contacts → relationship_participants join table
-- meetings.attendees → meeting_participants join table

ALTER TABLE partners DROP COLUMN IF EXISTS aws_team;
ALTER TABLE partners DROP COLUMN IF EXISTS partner_contacts;
ALTER TABLE relationships DROP COLUMN IF EXISTS contacts;
ALTER TABLE meetings DROP COLUMN IF EXISTS attendees;
