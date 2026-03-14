-- Roadrunner schema (derived from migrations 001-061)
-- Generated: 2026-03-14
-- Tables: 19 (18 active + 1 legacy)
--
-- Canonical field-level reference: docs/entity-model.md

-- ============================================================
-- CATALOG TABLES (Airtable → Roadrunner, pull only)
-- ============================================================

CREATE TABLE public.partners (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  segment text,
  focus_area text[],
  spms_id integer,
  airtable_record_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  aws_stickiness text,
  key_aws_services text[] DEFAULT '{}'::text[] NOT NULL,
  what_they_do text,
  aws_team jsonb DEFAULT '[]'::jsonb,
  partner_contacts jsonb DEFAULT '[]'::jsonb,
  -- Profile fields (migration 052)
  architecture text,
  listing_types text[],
  pricing_model text[],
  isva_status text,
  deployed_on_aws text,
  prm_status text,
  crm_status text,
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

CREATE TABLE public.relationships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  org text,                                             -- renamed from aws_org (migration 058)
  service text,                                         -- renamed from aws_service (migration 058)
  relationship_type text,
  contacts jsonb DEFAULT '[]'::jsonb,                   -- transitional artifact (decision 178)
  notes text,
  airtable_record_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  org_type text,                                        -- added migration 058
  PRIMARY KEY (id),
  CONSTRAINT relationships_relationship_type_check CHECK (((relationship_type IS NULL) OR (relationship_type = ANY (ARRAY['Exec/Leader'::text, 'Product Team'::text, 'Program Team'::text, 'Seller'::text])))),
  CONSTRAINT relationships_org_type_check CHECK (((org_type IS NULL) OR (org_type = ANY (ARRAY['internal'::text, 'third_party'::text])))),
  UNIQUE (airtable_record_id)
);

-- ============================================================
-- ACTIVITY TABLES (Roadrunner → Airtable, push only)
-- ============================================================

CREATE TABLE public.engagements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  closed_at timestamp with time zone,
  current_state text,
  pillar text,
  airtable_record_id text,
  partner_id uuid,
  topic text,
  goal text,
  program_id uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
  CONSTRAINT engagements_pillar_check CHECK (((pillar IS NULL) OR (pillar = ANY (ARRAY['Co-Sell'::text, 'Co-Market'::text, 'Co-Build'::text])))),
  CONSTRAINT engagements_status_check CHECK ((status = ANY (ARRAY['active'::text, 'planned'::text, 'blocked'::text, 'completed'::text, 'archived'::text])))
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

CREATE TABLE public.meetings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  engagement_id uuid,
  status text DEFAULT 'scheduled'::text NOT NULL,
  meeting_date date,
  start_time text,
  end_time text,
  location text,
  organizer_email text,
  organizer_name text,
  attendees jsonb DEFAULT '[]'::jsonb NOT NULL,         -- transitional artifact (decision 178)
  ics_uid text,
  source text DEFAULT 'ics_parsed'::text NOT NULL,
  notes text,
  airtable_record_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  message_id uuid,
  partner_id uuid,
  sequence integer,
  is_recurring boolean DEFAULT false,
  meeting_type text,                                    -- added migration 055
  PRIMARY KEY (id),
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  CONSTRAINT meetings_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'ics_parsed'::text]))),
  CONSTRAINT meetings_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'did_not_occur'::text]))),
  CONSTRAINT meetings_meeting_type_check CHECK (((meeting_type IS NULL) OR (meeting_type = ANY (ARRAY['Partner Cadence Call'::text, 'Co-Build Cadence'::text, 'Co-Market Cadence'::text, 'SCA Review'::text, 'QBR'::text, 'Product Team Sync'::text, 'Co-Sell Cadence'::text, 'Co-Sell Strategy'::text, 'Executive Meeting'::text])))),
  UNIQUE (airtable_record_id),
  UNIQUE (ics_uid)
);

CREATE TABLE public.meeting_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  partner_id uuid NOT NULL,
  meeting_id uuid,
  engagement_id uuid,
  note_type text NOT NULL DEFAULT 'meeting'::text,
  title text,
  meeting_date date,
  date_range_start date,
  date_range_end date,
  raw_notes text NOT NULL,
  ai_summary text,
  ai_tasks jsonb,
  context_snapshot jsonb,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL,
  CONSTRAINT meeting_notes_note_type_check CHECK ((note_type = ANY (ARRAY['meeting'::text, 'seed'::text]))),
  CONSTRAINT meeting_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'complete'::text])))
);

CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  meeting_note_id uuid,
  partner_id uuid NOT NULL,
  description text NOT NULL,
  owner text NOT NULL,
  owner_name text,
  status text NOT NULL DEFAULT 'open'::text,
  due_date date,
  origin text NOT NULL DEFAULT 'manual'::text,
  owner_participant_id uuid,                            -- added migration 059
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (meeting_note_id) REFERENCES meeting_notes(id) ON DELETE SET NULL,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_participant_id) REFERENCES participants(id) ON DELETE SET NULL,
  CONSTRAINT tasks_owner_check CHECK ((owner = ANY (ARRAY['me'::text, 'internal'::text, 'partner'::text, 'third_party'::text]))),
  CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text]))),
  CONSTRAINT tasks_origin_check CHECK ((origin = ANY (ARRAY['ai_extracted'::text, 'manual'::text])))
);

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

-- ============================================================
-- CONTACT REGISTRY (canonical person store + join tables)
-- ============================================================

CREATE TABLE public.participants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text,
  name text,
  organization text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  title text,
  org_type text,                                        -- added migration 057
  source text,                                          -- added migration 057
  updated_at timestamp with time zone DEFAULT now() NOT NULL,  -- added migration 057
  PRIMARY KEY (id),
  UNIQUE (email),
  CONSTRAINT participants_org_type_check CHECK (((org_type IS NULL) OR (org_type = ANY (ARRAY['internal'::text, 'partner'::text, 'third_party'::text])))),
  CONSTRAINT participants_source_check CHECK (((source IS NULL) OR (source = ANY (ARRAY['airtable_sync'::text, 'ics_parsed'::text, 'classifier'::text, 'manual'::text]))))
);

CREATE TABLE public.partner_participants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  partner_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  role text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE (partner_id, participant_id, role)
);

CREATE TABLE public.meeting_participants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  meeting_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  role text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE (meeting_id, participant_id)
);

CREATE TABLE public.engagement_participants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  engagement_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  role text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE (engagement_id, participant_id)
);

CREATE TABLE public.relationship_participants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  relationship_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  role text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE (relationship_id, participant_id)
);

-- ============================================================
-- JUNCTION / LINK TABLES
-- ============================================================

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

CREATE TABLE public.engagement_relationships (
  engagement_id uuid NOT NULL,
  relationship_id uuid NOT NULL,
  PRIMARY KEY (engagement_id, relationship_id),
  FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
  FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE
);

CREATE TABLE public.partner_context (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  partner_id uuid NOT NULL,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'scratchpad'::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  CONSTRAINT partner_context_source_check CHECK ((source = ANY (ARRAY['scratchpad'::text, 'ai_synthesis'::text, 'seed_dump'::text])))
);

-- ============================================================
-- LEGACY TABLES (to be dropped — decision 169)
-- ============================================================

-- notes table dropped in migration 061 (decision 179)

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

-- ============================================================
-- INDEXES
-- ============================================================

-- approval_queue
CREATE INDEX idx_approval_queue_unresolved ON public.approval_queue USING btree (resolved) WHERE (resolved = false);

-- engagements
CREATE UNIQUE INDEX idx_engagements_airtable_record_id ON public.engagements USING btree (airtable_record_id) WHERE (airtable_record_id IS NOT NULL);
CREATE INDEX idx_engagements_partner_id ON public.engagements USING btree (partner_id);

-- entity_links
CREATE INDEX idx_entity_links_source ON public.entity_links USING btree (source_type, source_id);
CREATE INDEX idx_entity_links_target ON public.entity_links USING btree (target_type, target_id);

-- events
CREATE UNIQUE INDEX idx_events_airtable_record_id ON public.events USING btree (airtable_record_id) WHERE (airtable_record_id IS NOT NULL);

-- meetings
CREATE INDEX idx_meetings_engagement_id ON public.meetings USING btree (engagement_id);
CREATE INDEX idx_meetings_meeting_date ON public.meetings USING btree (meeting_date);
CREATE INDEX idx_meetings_message_id ON public.meetings USING btree (message_id);
CREATE INDEX idx_meetings_partner_id ON public.meetings USING btree (partner_id);

-- messages
CREATE INDEX idx_messages_engagement_id ON public.messages USING btree (engagement_id);
CREATE INDEX idx_messages_forwarded_at ON public.messages USING btree (forwarded_at);
CREATE INDEX idx_messages_pending_review ON public.messages USING btree (pending_review) WHERE (pending_review = true);

-- meeting_notes
CREATE INDEX idx_meeting_notes_partner_id ON public.meeting_notes USING btree (partner_id);
CREATE INDEX idx_meeting_notes_meeting_id ON public.meeting_notes USING btree (meeting_id);
CREATE INDEX idx_meeting_notes_status ON public.meeting_notes USING btree (status);

-- tasks
CREATE INDEX idx_tasks_meeting_note_id ON public.tasks USING btree (meeting_note_id);
CREATE INDEX idx_tasks_partner_id ON public.tasks USING btree (partner_id);
CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX idx_tasks_owner_participant_id ON public.tasks USING btree (owner_participant_id);

-- participants
CREATE INDEX idx_participants_org_type ON public.participants USING btree (org_type);

-- partner_participants
CREATE INDEX idx_partner_participants_partner ON public.partner_participants USING btree (partner_id);
CREATE INDEX idx_partner_participants_participant ON public.partner_participants USING btree (participant_id);

-- meeting_participants
CREATE INDEX idx_meeting_participants_meeting ON public.meeting_participants USING btree (meeting_id);
CREATE INDEX idx_meeting_participants_participant ON public.meeting_participants USING btree (participant_id);

-- engagement_participants
CREATE INDEX idx_engagement_participants_engagement ON public.engagement_participants USING btree (engagement_id);
CREATE INDEX idx_engagement_participants_participant ON public.engagement_participants USING btree (participant_id);

-- relationship_participants
CREATE INDEX idx_relationship_participants_relationship ON public.relationship_participants USING btree (relationship_id);
CREATE INDEX idx_relationship_participants_participant ON public.relationship_participants USING btree (participant_id);

-- relationships
CREATE INDEX idx_relationships_org_type ON public.relationships USING btree (org_type);

-- engagement_relationships
CREATE INDEX idx_engagement_rel_relationship ON public.engagement_relationships USING btree (relationship_id);

-- partner_context
CREATE INDEX idx_partner_context_partner ON public.partner_context USING btree (partner_id);
CREATE INDEX idx_partner_context_source ON public.partner_context USING btree (partner_id, source);

-- partners
-- partners
CREATE INDEX idx_partners_name ON public.partners USING btree (name);
CREATE INDEX idx_partners_segment ON public.partners USING btree (segment);

-- programs
CREATE UNIQUE INDEX idx_programs_airtable_record_id ON public.programs USING btree (airtable_record_id) WHERE (airtable_record_id IS NOT NULL);

-- participant_links (legacy)
CREATE INDEX idx_participant_links_entity ON public.participant_links USING btree (entity_type, entity_id);
CREATE INDEX idx_participant_links_participant ON public.participant_links USING btree (participant_id);
CREATE UNIQUE INDEX idx_participant_links_unique ON public.participant_links USING btree (participant_id, entity_type, entity_id);

-- ============================================================
-- TRIGGERS (updated_at auto-maintenance)
-- ============================================================

-- Shared trigger function (created in early migration, used by all tables with updated_at)
-- CREATE OR REPLACE FUNCTION update_updated_at() ...

-- Applied to: engagements, partners, meetings, relationships, events, programs,
--             meeting_notes, tasks, participants, partner_context
