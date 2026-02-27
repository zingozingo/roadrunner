-- Roadrunner live schema dump (from pg_catalog)
-- Generated: 2026-02-27T04:29:10.865Z
-- Source: supabase linked project (qdqdseuyjuyqgsjwizti)
-- Method: Direct query to pg_catalog via pg node driver
-- Tables: 14

CREATE TABLE public.approval_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  message_id uuid,
  engagement_id uuid,
  classification_result jsonb,
  resolved boolean DEFAULT false NOT NULL,
  resolved_at timestamp with time zone,
  resolution text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT approval_queue_type_check CHECK ((type = 'engagement_assignment'::text))
);

CREATE TABLE public.aws_relationships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  partner_name text,
  aws_org text,
  aws_service text,
  relationship_type text,
  primary_contact_name text,
  primary_contact_email text,
  aws_contact_emails text[] DEFAULT '{}'::text[] NOT NULL,
  notes text,
  airtable_record_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT aws_relationships_relationship_type_check CHECK (((relationship_type IS NULL) OR (relationship_type = ANY (ARRAY['Exec/Leader'::text, 'Product Team'::text, 'Program Team'::text, 'Seller'::text])))),
  UNIQUE (airtable_record_id)
);

CREATE TABLE public.engagement_aws_relationships (
  engagement_id uuid NOT NULL,
  aws_relationship_id uuid NOT NULL,
  PRIMARY KEY (engagement_id, aws_relationship_id),
  FOREIGN KEY (aws_relationship_id) REFERENCES aws_relationships(id) ON DELETE CASCADE,
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE
);

CREATE TABLE public.engagements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  partner_name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  closed_at timestamp with time zone,
  current_state text,
  tags jsonb DEFAULT '[]'::jsonb,
  pillar text,
  airtable_record_id text,
  partner_id uuid,
  topic text,
  goal text,
  engagement_type text,
  program_id uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
  CONSTRAINT engagements_pillar_check CHECK (((pillar IS NULL) OR (pillar = ANY (ARRAY['Co-Sell'::text, 'Co-Market'::text, 'Co-Build'::text])))),
  CONSTRAINT engagements_status_check CHECK ((status = ANY (ARRAY['active'::text, 'blocked'::text, 'completed'::text, 'archived'::text])))
);

CREATE TABLE public.entity_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  relationship text NOT NULL,
  context text,
  created_by text DEFAULT 'ai'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT entity_links_created_by_check CHECK ((created_by = ANY (ARRAY['ai'::text, 'user'::text]))),
  CONSTRAINT entity_links_source_type_check CHECK ((source_type = ANY (ARRAY['engagement'::text, 'event'::text, 'program'::text]))),
  CONSTRAINT entity_links_target_type_check CHECK ((target_type = ANY (ARRAY['engagement'::text, 'event'::text, 'program'::text])))
);

CREATE TABLE public.events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  start_date date,
  end_date date,
  location text,
  description text,
  source text DEFAULT 'email_extracted'::text NOT NULL,
  verified boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  host text,
  airtable_record_id text,
  geo text,
  sponsor_option boolean DEFAULT false NOT NULL,
  partner_day boolean DEFAULT false NOT NULL,
  partner_day_date date,
  PRIMARY KEY (id),
  CONSTRAINT events_geo_check CHECK (((geo IS NULL) OR (geo = ANY (ARRAY['NAMER'::text, 'EMEA'::text, 'APJ'::text, 'LATAM'::text, 'GCR'::text])))),
  CONSTRAINT events_source_check CHECK ((source = ANY (ARRAY['seed'::text, 'email_extracted'::text, 'user_created'::text]))),
  CONSTRAINT events_type_check CHECK ((type = ANY (ARRAY['conference'::text, 'summit'::text, 'workshop'::text, 'kickoff'::text, 'trade_show'::text, 'deadline'::text, 'review_cycle'::text, 'training'::text])))
);

CREATE TABLE public.meeting_aws_relationships (
  meeting_id uuid NOT NULL,
  aws_relationship_id uuid NOT NULL,
  PRIMARY KEY (meeting_id, aws_relationship_id),
  FOREIGN KEY (aws_relationship_id) REFERENCES aws_relationships(id) ON DELETE CASCADE,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE public.meetings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  engagement_id uuid,
  partner_name text,
  meeting_type text,
  status text DEFAULT 'scheduled'::text NOT NULL,
  meeting_date date,
  start_time text,
  end_time text,
  location text,
  organizer_email text,
  attendees jsonb DEFAULT '[]'::jsonb NOT NULL,
  ics_uid text,
  source text DEFAULT 'ics_parsed'::text NOT NULL,
  notes text,
  airtable_record_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  message_id uuid,
  partner_id uuid,
  program_id uuid,
  event_id uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
  CONSTRAINT meetings_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'ics_parsed'::text]))),
  CONSTRAINT meetings_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'did_not_occur'::text]))),
  UNIQUE (airtable_record_id),
  UNIQUE (ics_uid)
);

CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  engagement_id uuid,
  sender_name text,
  sender_email text,
  sent_at timestamp with time zone,
  subject text,
  body_text text,
  body_raw text,
  content_type text,
  classification_confidence double precision,
  linked_entities jsonb DEFAULT '[]'::jsonb NOT NULL,
  forwarded_at timestamp with time zone DEFAULT now() NOT NULL,
  pending_review boolean DEFAULT false NOT NULL,
  classification_result jsonb,
  forwarder_email text,
  forwarder_name text,
  to_header text,
  cc_header text,
  forwarder_note text,
  PRIMARY KEY (id),
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL,
  CONSTRAINT messages_content_type_check CHECK (((content_type IS NULL) OR (content_type = ANY (ARRAY['engagement_email'::text, 'meeting_invite'::text, 'mixed'::text, 'noise'::text]))))
);

CREATE TABLE public.notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  engagement_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE
);

CREATE TABLE public.participant_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  participant_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  role text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (participant_id) REFERENCES participants(id),
  CONSTRAINT participant_links_entity_type_check CHECK ((entity_type = ANY (ARRAY['engagement'::text, 'event'::text])))
);

CREATE TABLE public.participants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text,
  name text,
  organization text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  title text,
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE public.partners (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  segment text,
  focus_area text[],
  alliance_lead text,
  alliance_lead_email text,
  psa text,
  spms_id integer,
  partner_contact_emails text[],
  airtable_record_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  aws_stickiness text,
  key_aws_services text[] DEFAULT '{}'::text[] NOT NULL,
  what_they_do text,
  psa_email text,
  account_manager text,
  account_manager_email text,
  pmm text,
  pmm_email text,
  PRIMARY KEY (id),
  UNIQUE (airtable_record_id),
  UNIQUE (spms_id)
);

CREATE TABLE public.programs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  requirements text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  lifecycle_type text DEFAULT 'indefinite'::text NOT NULL,
  lifecycle_duration text,
  type text,
  airtable_record_id text,
  what_it_unlocks text,
  notes text,
  PRIMARY KEY (id),
  CONSTRAINT programs_lifecycle_type_check CHECK ((lifecycle_type = ANY (ARRAY['indefinite'::text, 'recurring'::text, 'expiring'::text]))),
  CONSTRAINT programs_type_check CHECK (((type IS NULL) OR (type = ANY (ARRAY['Competency'::text, 'Service Ready'::text, 'SCA'::text, 'Program'::text, 'Credit Program'::text, 'Funding'::text, 'Channel'::text, 'Enablement'::text]))))
);

-- Indexes
CREATE UNIQUE INDEX approval_queue_pkey ON public.approval_queue USING btree (id);
CREATE UNIQUE INDEX aws_relationships_airtable_record_id_key ON public.aws_relationships USING btree (airtable_record_id);
CREATE UNIQUE INDEX aws_relationships_pkey ON public.aws_relationships USING btree (id);
CREATE UNIQUE INDEX engagement_aws_relationships_pkey ON public.engagement_aws_relationships USING btree (engagement_id, aws_relationship_id);
CREATE UNIQUE INDEX entity_links_pkey ON public.entity_links USING btree (id);
CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);
CREATE INDEX idx_approval_queue_unresolved ON public.approval_queue USING btree (resolved) WHERE (resolved = false);
CREATE INDEX idx_aws_relationships_partner_name ON public.aws_relationships USING btree (partner_name);
CREATE INDEX idx_aws_relationships_primary_contact_email ON public.aws_relationships USING btree (primary_contact_email);
CREATE INDEX idx_engagement_aws_rel_relationship ON public.engagement_aws_relationships USING btree (aws_relationship_id);
CREATE UNIQUE INDEX idx_engagements_airtable_record_id ON public.engagements USING btree (airtable_record_id) WHERE (airtable_record_id IS NOT NULL);
CREATE INDEX idx_engagements_partner_id ON public.engagements USING btree (partner_id);
CREATE INDEX idx_entity_links_source ON public.entity_links USING btree (source_type, source_id);
CREATE INDEX idx_entity_links_target ON public.entity_links USING btree (target_type, target_id);
CREATE UNIQUE INDEX idx_events_airtable_record_id ON public.events USING btree (airtable_record_id) WHERE (airtable_record_id IS NOT NULL);
CREATE INDEX idx_meeting_aws_rel_relationship ON public.meeting_aws_relationships USING btree (aws_relationship_id);
CREATE INDEX idx_meetings_engagement_id ON public.meetings USING btree (engagement_id);
CREATE INDEX idx_meetings_event_id ON public.meetings USING btree (event_id);
CREATE INDEX idx_meetings_meeting_date ON public.meetings USING btree (meeting_date);
CREATE INDEX idx_meetings_message_id ON public.meetings USING btree (message_id);
CREATE INDEX idx_meetings_partner_id ON public.meetings USING btree (partner_id);
CREATE INDEX idx_meetings_program_id ON public.meetings USING btree (program_id);
CREATE INDEX idx_messages_engagement_id ON public.messages USING btree (engagement_id);
CREATE INDEX idx_messages_forwarded_at ON public.messages USING btree (forwarded_at);
CREATE INDEX idx_messages_pending_review ON public.messages USING btree (pending_review) WHERE (pending_review = true);
CREATE INDEX idx_participant_links_entity ON public.participant_links USING btree (entity_type, entity_id);
CREATE INDEX idx_participant_links_participant ON public.participant_links USING btree (participant_id);
CREATE UNIQUE INDEX idx_participant_links_unique ON public.participant_links USING btree (participant_id, entity_type, entity_id);
CREATE INDEX idx_partners_name ON public.partners USING btree (name);
CREATE INDEX idx_partners_segment ON public.partners USING btree (segment);
CREATE UNIQUE INDEX idx_programs_airtable_record_id ON public.programs USING btree (airtable_record_id) WHERE (airtable_record_id IS NOT NULL);
CREATE UNIQUE INDEX initiatives_pkey ON public.engagements USING btree (id);
CREATE UNIQUE INDEX meeting_aws_relationships_pkey ON public.meeting_aws_relationships USING btree (meeting_id, aws_relationship_id);
CREATE UNIQUE INDEX meetings_airtable_record_id_key ON public.meetings USING btree (airtable_record_id);
CREATE UNIQUE INDEX meetings_ics_uid_key ON public.meetings USING btree (ics_uid);
CREATE UNIQUE INDEX meetings_pkey ON public.meetings USING btree (id);
CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);
CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (id);
CREATE UNIQUE INDEX participant_links_pkey ON public.participant_links USING btree (id);
CREATE UNIQUE INDEX participants_email_key ON public.participants USING btree (email);
CREATE UNIQUE INDEX participants_pkey ON public.participants USING btree (id);
CREATE UNIQUE INDEX partners_airtable_record_id_key ON public.partners USING btree (airtable_record_id);
CREATE UNIQUE INDEX partners_pkey ON public.partners USING btree (id);
CREATE UNIQUE INDEX partners_spms_id_key ON public.partners USING btree (spms_id);
CREATE UNIQUE INDEX programs_pkey ON public.programs USING btree (id);
