-- Migration 019: Junction table linking engagements to AWS relationships (many-to-many)

CREATE TABLE engagement_aws_relationships (
  engagement_id       uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  aws_relationship_id uuid NOT NULL REFERENCES aws_relationships(id) ON DELETE CASCADE,
  PRIMARY KEY (engagement_id, aws_relationship_id)
);

CREATE INDEX idx_engagement_aws_rel_relationship ON engagement_aws_relationships(aws_relationship_id);
