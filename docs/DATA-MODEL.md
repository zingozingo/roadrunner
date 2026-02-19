# Roadrunner — Data Model

## System Ownership

| System | Owns | Sync Direction |
|--------|------|----------------|
| **Airtable** | Partners, Programs, Events, AWS Relationships | AT → RR (pull) |
| **Roadrunner** | Engagements, Meetings, Messages, Approval Queue | RR → AT (push, engagements + meetings only) |

Catalog tables are read from Airtable into Roadrunner. Activity tables are written from Roadrunner to Airtable. This one-directional ownership per entity prevents sync conflicts.

For the complete field-level mapping between Airtable and Supabase, see [FIELD-MAPPING.md](FIELD-MAPPING.md).

---

## Catalog Entities (Airtable → Roadrunner)

### Partners

ISV companies in the portfolio. Classified by operational segment and focus area.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| segment | text | Security, SecOps, DevOps, CloudOps, Observability, OT/IoT |
| focus_area | text[] | Multiple select: Network Security, API Security, IaC, IT Management, etc. |
| alliance_lead | text | Partner-side alliance manager |
| alliance_lead_email | text | Used for email-to-partner matching |
| psa | text | AWS Partner Solutions Architect |
| spms_id | integer | AWS SPMS identifier |
| partner_contact_emails | text | Semicolon-separated; used for email-to-partner matching |
| aws_stickiness | text | Narrative: how likely is a customer to use more AWS services |
| key_aws_services | text[] | EC2, S3, Lambda, Security Hub, etc. |
| airtable_record_id | text UNIQUE | Airtable record ID for sync |
| created_at / updated_at | timestamptz | |

### Programs (Tier 1 — Catalog)

AWS partner programs. This is the canonical list of available programs.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| type | text | singleSelect from Airtable |
| status | text | |
| description | text | |
| eligibility | text | Requirements/eligibility criteria |
| lifecycle_type | text | |
| lifecycle_duration | text | |
| url | text | Program documentation URL |
| airtable_record_id | text UNIQUE | |
| created_at / updated_at | timestamptz | |

**Note:** There is also a Tier 2 "Partner Programs" table in Airtable (per-partner enrollment status). This is NOT synced to Roadrunner — it's Airtable-only.

### Events

Shared calendar anchors: conferences, summits, workshops, partner days.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| type | text | Conference, Summit, Workshop, Partner Day, etc. |
| description | text | |
| start_date / end_date | date | |
| location | text | |
| host | text | |
| source | text | "seed", "email_extracted", or "user_created" |
| verified | boolean DEFAULT false | |
| airtable_record_id | text UNIQUE | |
| created_at / updated_at | timestamptz | |

**Events ARE:** Shared calendar anchors that multiple partners might attend — re:Invent, AWS Summits, partner-hosted conferences, industry events.

**Events are NOT:** Meetings within a single engagement (a call, a review, a demo), vague future intentions ("we should meet next week"), or unconfirmed scheduling negotiations.

### AWS Relationships

Named relationships with AWS people or teams. Decoupled from single-partner ownership — a relationship can be linked to multiple engagements across partners.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | e.g., "Taylor Murphy - ISV SA" |
| relationship_type | text | Exec/Leader, Product Team, Program Team, Seller |
| aws_org | text | |
| aws_service | text | |
| primary_contact_name | text | |
| primary_contact_email | text | Used for email matching |
| aws_contact_emails | text[] | Array; used for email matching |
| notes | text | |
| airtable_record_id | text UNIQUE | |
| created_at / updated_at | timestamptz | |

---

## Activity Entities (Roadrunner → Airtable)

### Engagements

The core entity. A trackable workstream with a partner, created and evolved by AI classification.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | AI-generated, user-editable |
| partner_id | uuid FK→partners | |
| partner_name | text | Denormalized; used when partner_id is null |
| status | text NOT NULL | planned, active, paused, completed, archived |
| current_state | text | Living summary — updated with each new email |
| open_items | jsonb | Array of {description, assignee, due_date} extracted from emails |
| pillar | text | Co-Sell, Co-Market, Co-Build |
| priority | text | Mandated, High, Normal, Opportunistic |
| tags | jsonb | Freeform string array — the escape valve for anything that doesn't fit the entity model |
| closed_at | timestamptz | |
| airtable_record_id | text UNIQUE | |
| created_at / updated_at | timestamptz | |

**Tags usage:** Campaigns ("FinServ Q2"), partner events ("Wiz Innovation Summit"), strategic labels ("exec-sponsored"), workflow states ("waiting-on-legal"), segments ("public-sector"). Not a table — a JSONB string array on the engagement.

### Meetings

Calendar events extracted from ICS attachments or created manually. Three types supported:

1. **Event meetings** — linked to Event + Partner (re:Invent prep, summit follow-up)
2. **Program meetings** — linked to Program + Partner (competency reviews, program calls)
3. **Standalone engagement meetings** — linked to Engagement + Partner only

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text NOT NULL | Written to Airtable "Meeting Name" primary field |
| engagement_id | uuid FK→engagements | ON DELETE SET NULL |
| event_id | uuid FK→events | ON DELETE SET NULL |
| partner_id | uuid FK→partners | ON DELETE SET NULL |
| partner_name | text | Denormalized; used when partner_id is null |
| program_id | uuid FK→programs | ON DELETE SET NULL |
| message_id | uuid FK→messages | Source email; not synced to AT |
| meeting_type | text | Executive, Specialized, GTM, Product Team Relationship |
| status | text NOT NULL | Scheduling, Invites Sent, Confirmed, Completed, Did Not Occur |
| meeting_date | date | |
| start_time / end_time | text | |
| location | text | |
| organizer_email | text | |
| attendees | jsonb | Array of {name, email} |
| ics_uid | text UNIQUE | Calendar event unique ID for dedup |
| source | text NOT NULL | "manual" or "ics_parsed" |
| notes | text | Not synced to AT (see ADR-001). ICS-parsed meetings leave null; manual-only scratch space. |
| airtable_record_id | text UNIQUE | |
| created_at / updated_at | timestamptz | |

---

## Internal Entities (Roadrunner Only — Not Synced)

### Messages

Raw emails stored for reference and audit trail. Deduplication is handled at the application layer via Mailgun message ID checks before insertion.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| engagement_id | uuid FK→engagements | Set during classification |
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

### Approval Queue

Low-confidence classifications waiting for human review.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| type | text NOT NULL | Always 'engagement_assignment' (CHECK constraint) |
| message_id | uuid FK→messages | ON DELETE SET NULL |
| engagement_id | uuid FK→engagements | ON DELETE SET NULL |
| classification_result | jsonb | The proposed classification |
| options_sent | jsonb | Legacy (Twilio removed) — always null on new rows |
| sms_sent | boolean | Legacy — always false on new rows |
| sms_sent_at | timestamptz | Legacy |
| resolved | boolean NOT NULL | False = pending review |
| resolved_at | timestamptz | |
| resolution | text | How it was resolved |
| created_at | timestamptz | |

### Participants

People mentioned in emails. Shared across engagements via participant_links. Participant type (aws, partner, other) is not stored — it's inferred from email domain during classification and sync.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| email | text | Nullable (migration 007); UNIQUE when present |
| organization | text | Company or org name |
| title | text | Job title |
| notes | text | |
| created_at | timestamptz | |

### Participant Links

Polymorphic junction table: which participants are involved in which engagements or events.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| participant_id | uuid FK→participants | |
| entity_type | text NOT NULL | 'engagement' or 'event' |
| entity_id | uuid NOT NULL | FK to engagements or events |
| role | text | Role in the context of this entity |
| created_at | timestamptz | |

### Entity Links

Generic many-to-many junction between engagements, events, and programs.

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

### Meeting ↔ AWS Relationships (Junction)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| meeting_id | uuid FK→meetings | ON DELETE CASCADE |
| aws_relationship_id | uuid FK→aws_relationships | ON DELETE CASCADE |
| created_at | timestamptz | |

---

## Sync Architecture

### Sync Order

1. **Pull catalog** (AT → RR): Partners → Programs → Events → AWS Relationships
2. **Push activity** (RR → AT): Engagements → Meetings

### Match Strategies

**Engagements:** Match by `airtable_record_id` (existing) or `roadrunnerId` field in Airtable + partner resolution.

**Meetings (3-tier):**
1. `airtable_record_id` — exact record match
2. `roadrunnerId` — Roadrunner UUID match
3. `title + meeting_date` — fallback for manually-created Airtable records

### Auto-Push Hooks

Engagements auto-push to Airtable on: create, update (name/status/pillar/priority/tags/notes), delete.

Meetings auto-push on: create, update (any field), delete, relationship link changes.

### Linked Record Resolution

When pushing to Airtable, Roadrunner resolves UUIDs to Airtable record IDs:
- `partner_id` → lookup partner's `airtable_record_id` → write to Partner link field
- `event_id` → lookup event's `airtable_record_id` → write to Event link field
- `program_id` → lookup program's `airtable_record_id` → write to Program link field
- `engagement_id` → lookup engagement's `airtable_record_id` → write to Engagement link field
- AWS Relationships → lookup via junction table → write to AWS Relationships link field

### Attendee Filtering

Before splitting attendees into AWS vs. partner contacts, these are filtered out:
- `*@relay.stevenromero.dev` — Roadrunner forwarding address
- `*salesforce*` — Salesforce system emails
- Any email matching `isUserEmail()` from user-config.ts

Remaining: `@amazon.com` → AWS Contact(s), everything else → Partner Contact(s).