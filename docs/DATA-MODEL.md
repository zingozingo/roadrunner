# Data Model

> Last updated: 2026-03-02 (removed meeting entity columns, engagement-hub enforcement)

## Overview

Roadrunner uses Supabase PostgreSQL with 13 tables. Data flows bidirectionally with Airtable:
- **Catalog tables** (partners, programs, events, aws_relationships): Airtable → Supabase via pull sync
- **Activity tables** (engagements, meetings): Supabase → Airtable via push sync
- **Internal tables** (participants, participant_links, entity_links, approval_queue, notes, messages): Roadrunner-only

Field mapping details: [FIELD-MAPPING.md](./FIELD-MAPPING.md)

## Tables

### partners
Source: Airtable (pull sync)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Partner company name |
| segment | text | Security, DevOps, CloudOps, Observability, OT/IoT |
| focus_area | text[] | Array of focus areas |
| what_they_do | text | Partner description |
| aws_stickiness | text | Narrative on customer AWS adoption likelihood |
| key_aws_services | text[] | EC2, S3, Lambda, etc. |
| aws_team | jsonb | Array of {name, email, title, role} — PSA, AM, PMM |
| partner_contacts | jsonb | Array of {name, email, title, role} — Alliance Lead + others |
| spms_id | integer | AWS partner ID |
| airtable_record_id | text | Sync key |
| created_at / updated_at | timestamptz | |

### engagements
Source: Roadrunner (push sync)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Engagement title |
| status | text | CHECK: active, blocked, completed, archived |
| pillar | text | CHECK: Co-Sell, Co-Market, Co-Build (nullable) |
| partner_id | uuid FK → partners | |
| partner_name | text | Denormalized; used when partner_id is null |
| program_id | uuid FK → programs | Nullable |
| engagement_type | text | |
| topic | text | AI-generated topic summary |
| goal | text | AI-generated goal |
| current_state | text | AI-generated evolving state narrative |
| closed_at | timestamptz | Set when status → archived |
| airtable_record_id | text | Sync key |
| created_at / updated_at | timestamptz | |

### messages
Source: Roadrunner (internal)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| engagement_id | uuid FK → engagements | Set during classification |
| sender_name | text | Parsed from email headers |
| sender_email | text | |
| sent_at | timestamptz | |
| subject | text | |
| body_text | text | Cleaned email body |
| body_raw | text | Full email body (body-plain from Mailgun) |
| content_type | text | engagement_email, meeting_invite, mixed, noise |
| classification_confidence | float | Claude's self-assessed confidence |
| linked_entities | jsonb | Array of {type, id, relationship} |
| forwarded_at | timestamptz | When the email was received by Roadrunner |
| pending_review | boolean | True if in approval queue |
| classification_result | jsonb | Full Claude response stored for debugging |
| forwarder_email | text | Email of the person who forwarded to Roadrunner |
| forwarder_name | text | Name of the forwarder |
| forwarder_note | text | Substantive text added by forwarder (signature-stripped) |
| to_header | text | Original To header |
| cc_header | text | Original CC header |
| created_at | timestamptz | |

### meetings
Source: Roadrunner (push sync)

> **Engagement-centric:** Meetings inherit Program, Event, and AWS Relationship connections from their parent engagement. Only `engagement_id` drives the Airtable link. Partner is retained directly on meetings for display convenience.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text | Meeting title |
| engagement_id | uuid FK → engagements | ON DELETE SET NULL. Required for AT push — meetings without an engagement are not synced to Airtable. |
| partner_id | uuid FK → partners | ON DELETE SET NULL. Retained for query convenience; NOT used for AT push. |
| partner_name | text | Denormalized; used when partner_id is null. NOT used for AT push. |
| message_id | uuid FK → messages | Source email; not synced to AT |
| status | text | scheduled, completed, cancelled, did_not_occur |
| meeting_date | date | |
| start_time / end_time | text | |
| location | text | |
| organizer_email | text | Extracted from ICS ORGANIZER |
| organizer_name | text | From ICS ORGANIZER |
| attendees | jsonb | Array of {name, email} |
| ics_uid | text UNIQUE | Calendar event unique ID for dedup/update |
| sequence | integer | ICS SEQUENCE for update ordering |
| is_recurring | boolean | True if ICS contains RRULE |
| source | text NOT NULL | "manual" or "ics_parsed" |
| notes | text | |
| airtable_record_id | text UNIQUE | |
| created_at / updated_at | timestamptz | |

### programs
Source: Airtable (pull sync)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Program name |
| type | text | Competency, Service Ready, SCA, Program, Funding, Channel, Enablement |
| description | text | |
| requirements | text | |
| what_it_unlocks | text | MDF funding, badges, etc. |
| lifecycle_type | text | recurring, expiring, indefinite |
| lifecycle_duration | text | |
| notes | text | |
| airtable_record_id | text | Sync key |
| created_at / updated_at | timestamptz | |

### events
Source: Airtable (pull sync)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Event name |
| type | text | conference, summit, workshop, trade_show, training, kickoff, deadline, review_cycle |
| start_date / end_date | date | |
| location | text | |
| host | text | |
| description | text | |
| geo | text | NAMER, EMEA, APJ, LATAM, GCR |
| sponsor_option | boolean | |
| partner_day | boolean | |
| partner_day_date | date | |
| verified | boolean DEFAULT false | |
| airtable_record_id | text | Sync key |
| created_at / updated_at | timestamptz | |

### aws_relationships
Source: Airtable (pull sync)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Relationship name (e.g., "Taylor Murphy - ISV SA") |
| relationship_type | text | Exec/Leader, Product Team, Program Team, Seller |
| aws_org | text | Platform, Security, Observability, etc. |
| aws_service | text | |
| contacts | jsonb | Array of {name, email, title} — Lead + team contacts |
| notes | text | |
| airtable_record_id | text | Sync key |
| created_at / updated_at | timestamptz | |

### participants
Source: Roadrunner (internal)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| email | text | Nullable; UNIQUE when present |
| organization | text | Company or org name |
| title | text | Job title |
| notes | text | |
| created_at | timestamptz | |

### participant_links
Junction: participants ↔ entities (polymorphic)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| participant_id | uuid FK → participants | |
| entity_type | text NOT NULL | 'engagement' or 'event' |
| entity_id | uuid NOT NULL | FK to engagements or events |
| role | text | Role in the context of this entity |
| created_at | timestamptz | |

### entity_links
Junction: generic M:M between engagements, events, and programs

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| source_type | text NOT NULL | 'engagement', 'event', or 'program' |
| source_id | uuid NOT NULL | |
| target_type | text NOT NULL | 'engagement', 'event', or 'program' |
| target_id | uuid NOT NULL | |
| relationship | text NOT NULL | Describes the link (e.g., "preparation", "follow-up") |
| context | text | Optional context for why entities are linked |
| created_by | text NOT NULL | 'ai' or 'user' |
| created_at | timestamptz | |

### engagement_aws_relationships
Junction: engagements ↔ aws_relationships

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| engagement_id | uuid FK → engagements | ON DELETE CASCADE |
| aws_relationship_id | uuid FK → aws_relationships | ON DELETE CASCADE |
| created_at | timestamptz | |

### approval_queue
Source: Roadrunner (internal)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| type | text NOT NULL | Always 'engagement_assignment' (CHECK constraint) |
| message_id | uuid FK → messages | ON DELETE SET NULL |
| engagement_id | uuid FK → engagements | ON DELETE SET NULL |
| classification_result | jsonb | The proposed classification |
| options_sent | jsonb | Legacy (Twilio removed) — always null on new rows |
| sms_sent | boolean | Legacy — always false on new rows |
| sms_sent_at | timestamptz | Legacy |
| resolved | boolean NOT NULL | False = pending review |
| resolved_at | timestamptz | |
| resolution | text | How it was resolved |
| created_at | timestamptz | |

### notes
Source: Roadrunner (internal)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| engagement_id | uuid FK → engagements | ON DELETE CASCADE |
| content | text | |
| created_at / updated_at | timestamptz | |

## Contact Architecture

All contacts use the universal format: `Name <email> (Title)`
- Parser: `src/lib/contact-parser.ts`
- Missing email: `<—>`, missing title: `(—)`
- Partners: `aws_team` (PSA, AM, PMM) + `partner_contacts` (Alliance Lead + others)
- AWS Relationships: `contacts` (Lead + team)
- See [FIELD-MAPPING.md](./FIELD-MAPPING.md) for Airtable field ID mappings

## Sync Architecture

### Sync Order

1. **Pull catalog** (AT → RR): Partners → Programs → Events → AWS Relationships
2. **Push activity** (RR → AT): Engagements → Meetings

### Match Strategies

**Engagements:** Match by `airtable_record_id` (existing) or `roadrunnerId` field in Airtable, then by name.

**Meetings (3-tier):**
1. `airtable_record_id` — exact record match
2. `roadrunnerId` — Roadrunner UUID match
3. `title + meeting_date` — fallback for manually-created Airtable records

### Auto-Push

Engagements and meetings are pushed to Airtable immediately on create, update, or delete (awaited, not fire-and-forget). Bulk sync available via `/api/sync` as a safety net.

## Migrations

50 migrations in `supabase/migrations/` (001–050). Key recent:
- 043: Dropped legacy `initiatives_status_check` constraint
- 046: Added `sequence`, `is_recurring` to meetings; dropped `meeting_type`; updated status CHECK
- 047: Added JSONB contact columns (`aws_team`, `partner_contacts`, `contacts`, `organizer_name`)
- 048: Dropped 12 legacy scalar contact columns
- 049: Added `body_parsed` to meetings source CHECK constraint
- 050: Dropped `meeting_aws_relationships` table, `event_id`/`program_id` from meetings, tightened source CHECK (removed `body_parsed`)
