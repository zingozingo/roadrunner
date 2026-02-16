-- Migration 020: Junction table linking meetings to AWS relationships (many-to-many)

CREATE TABLE meeting_aws_relationships (
  meeting_id          uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  aws_relationship_id uuid NOT NULL REFERENCES aws_relationships(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, aws_relationship_id)
);

CREATE INDEX idx_meeting_aws_rel_relationship ON meeting_aws_relationships(aws_relationship_id);
