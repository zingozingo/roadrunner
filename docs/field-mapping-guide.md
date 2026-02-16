Airtable ↔ Roadrunner Field Mapping Guide
Generated 2026-02-16 — Based on live schema audit of both systems

How to Read This Document
Each synced entity has a complete field-by-field table showing:
Direction: Which system is authoritative (→ means "pushes to")
Transform: Any value conversion needed during sync
Status: ✅ Synced, ⏳ Planned, 🚫 Intentionally not synced, 📝 Data entry needed
Fields marked Airtable-only exist only in Airtable for strategic/operational use — they are never touched by sync. Fields marked Supabase-only exist only in Roadrunner for internal processing.

Entity 1: Programs
Sync direction: Airtable → Roadrunner (catalog pull) Trigger: Manual button click ("Sync from Airtable") Match strategy: airtable_record_id first, then name Record counts: 33 in both systems ✅
Airtable Field
Field ID
Supabase Column
Direction
Transform
Status
Program Name
fldlJgX0tVWwA516E
name
AT → RR
None
✅ Synced
Type
fldCd7TnUOgxnWmNt
type
AT → RR
Lowercase: "Competency"→"competency", "Service Ready"→"service_ready", "SCA"→"sca", "Program"→"program", "Credit Program"→"credit_program"
✅ Synced
Description
fldHN5mCWH6lXmoY1
description
AT → RR
None
✅ Synced
Requirements
fldxxsFFMc649nZft
eligibility
AT → RR
Field rename only (Requirements→eligibility)
✅ Synced
What It Unlocks
fld4870bblJTGbAgn
—
🚫
—
Not synced — Airtable-only strategic context
Lifecycle
fldo04XmU7rQhwOVT
lifecycle_type
AT → RR
None (values already lowercase in AT)
✅ Synced
Lifecycle Duration
fldeExdR8irrzC5GV
lifecycle_duration
AT → RR
None
✅ Synced
URL
fldj2uk4rf4ifqGLH
url
AT → RR
None
✅ Synced
Notes
fldzsmhcQ0Z6Rnjhk
—
🚫
—
Not synced — Airtable-only internal notes
record ID
—
airtable_record_id
AT → RR
Stored on first sync
✅ Synced
Partner Programs (link)
fldCb9opYD1m1I95B
—
🚫
—
Airtable-only link to Tier 2 enrollment
—
—
id (UUID)
Supabase-only
—
Internal primary key
—
—
verified
Supabase-only
—
Set true when seeded/synced
—
—
source
Supabase-only
—
Set to "seed" on sync
—
—
created_at / updated_at
Supabase-only
—
Auto-managed timestamps

Gaps: None. All meaningful fields are mapped.

Entity 2: Events
Sync direction: Airtable → Roadrunner (catalog pull) Trigger: Manual button click ("Sync from Airtable") Match strategy: airtable_record_id first, then name Record counts: 32 in both systems ✅
Airtable Field
Field ID
Supabase Column
Direction
Transform
Status
Event Name
fld1hURggkL0DTHnC
name
AT → RR
None
✅ Synced
Event Date
fld62hHfwpOJw7nyZ
start_date
AT → RR
Field rename (Event Date→start_date)
✅ Synced
End Date
fldTUy6jHj4KpR6SZ
end_date
AT → RR
None
✅ Synced
Location
fldwjmRq0saFpFHao
location
AT → RR
None
✅ Synced
Event Format
fldpuxeQ5DRhMwizr
type
AT → RR
Field rename. Values already lowercase in AT (conference, summit, workshop, trade_show, training, deadline, review_cycle, kickoff)
✅ Synced
Host
fldaDlidcRmUCvxFK
host
AT → RR
None
✅ Synced
Description
fldTMiRJ7mqMzGqXY
description
AT → RR
None
✅ Synced
record ID
—
airtable_record_id
AT → RR
Stored on first sync
✅ Synced
Partner Day?
fldTWZbQSEruQYdLe
—
🚫
—
Airtable-only operational field
Partner Day Date
fldo8mDJ5vvXK5bu7
—
🚫
—
Airtable-only operational field
Sponsor Option?
fldyAVpfZbG1SaDJz
—
🚫
—
Airtable-only operational field
Event Contact(s)
fldGiSKMTnsJ87BSb
—
🚫
—
Airtable-only operational field
Event Email
fld0Be6I2BJ76hHhm
—
🚫
—
Airtable-only operational field
Outreach Template
fldM2yJhVFU48Y0Ay
—
🚫
—
Airtable-only operational field
Partner Event Status (link)
fldzZHhJL93Z3U7yd
—
🚫
—
Airtable-only link to Tier 2 enrollment
Big Event Meetings (link)
fldkoNCXfHrvU1knw
—
🚫
—
Airtable-only link (meetings link to events, not reverse)
DEPRECATED - Event Type
fldIbtAEsNXmNRs4l
—
🚫
—
Legacy field — use Event Format instead
—
—
id (UUID)
Supabase-only
—
Internal primary key
—
—
verified
Supabase-only
—
Set true when seeded/synced
—
—
source
Supabase-only
—
Set to "seed" on sync
—
—
created_at / updated_at
Supabase-only
—
Auto-managed timestamps

Gaps: None. The 8 Airtable-only fields are intentionally not synced — they're operational event management fields (partner day logistics, sponsorship, outreach) that have no Roadrunner equivalent.

Entity 3: AWS Relationships
Sync direction: Airtable → Roadrunner (catalog pull) Trigger: Manual button click ("Sync from Airtable") Match strategy: airtable_record_id first, then name Record counts: 7 in both systems ✅
Airtable Field
Field ID
Supabase Column
Direction
Transform
Status
Relationship Name
fldeiFljVC5L61c3v
name
AT → RR
None
✅ Synced
Partners (link)
fldJHZfq28s58iuwX
partner_name
AT → RR
Resolve linked record ID → partner name via Partners table lookup
✅ Synced
AWS Contacts
fld3SvuwKc1pP7LaF
—
🚫
—
Human-readable names only. Not synced — use Primary Contact instead
AWS Org
fldKSmvO7Lhr5v9Fy
aws_org
AT → RR
None
✅ Synced
AWS Service
fldiieBBkkAFYDOJC
aws_service
AT → RR
None
✅ Synced
Relationship Type
fld2cjVCECNIPGw2d
relationship_type
AT → RR
Lowercase + underscore: "Exec/Leader"→"exec_leader", "Product Team"→"product_team", "Program Team"→"program_team", "Seller"→"seller"
✅ Synced
Primary Contact
fldhCrECNQ0uBA2tD
primary_contact
AT → RR
None (name text)
✅ Synced
Primary Contact Email
fldoWXiosjUJBPDqF
primary_contact_email
AT → RR
None
📝 Data entry needed — all 7 records empty
AWS Contact Emails
fldEu6kRhcn1929CA
aws_contact_emails
AT → RR
Parse comma-separated string → text[] array
📝 Data entry needed — all 7 records empty
Strength
fld5nwBVIb7rKBUhj
strength
AT → RR
Lowercase: "Strong"→"strong", "Building"→"building", "New"→"new", "Deferred"→"deferred"
✅ Synced
Notes
fldOcbNUrtfxjqiW5
notes
AT → RR
None
✅ Synced
How We Connected
fldgMwKmWfwbjB7Ou
how_we_connected
AT → RR
None
✅ Synced
Roadrunner ID
fldfZksUDfLbvVQMT
id
RR → AT
⚠️ Field exists but NOT currently synced — catalog sync doesn't push Roadrunner IDs back to AT
⏳ Planned
record ID
—
airtable_record_id
AT → RR
Stored on first sync
✅ Synced
Last Touch (date)
fld6pCNOjZ1UHk3Dj
—
🚫
—
Airtable-only — manual tracking of last interaction date
Partner Programs (link)
fldw0EXGcNUYRewjQ
—
🚫
—
Airtable-only link to Tier 2 enrollment
Partner Initiatives (link)
fldK8th5w7UOsNfvE
—
🚫
—
Airtable-only link to archived initiatives
Partner Event Status (link)
fldCiOsJ0ZnpfIwPq
—
🚫
—
Airtable-only link to Tier 2 enrollment
Partner Engagements (link)
fldPU8tywD13QLWtV
—
🚫
—
Airtable-only reverse link (engagements reference relationships, not reverse)
Event Meetings (link)
fldTyEGdlnaCxftOt
—
🚫
—
Airtable-only reverse link
—
—
created_at / updated_at
Supabase-only
—
Auto-managed timestamps

Gaps:
📝 PRIMARY CONTACT EMAIL + AWS CONTACT EMAILS — Empty on all 7 records. This is the #1 data entry task. The classifier cannot match @amazon.com addresses to relationship teams until these are populated. Populate in Airtable, then run sync to pull into Supabase.


⏳ ROADRUNNER ID — Field exists in Airtable but not written during catalog sync. The catalog sync (AT→RR) stores AT record IDs in Supabase but doesn't push Supabase UUIDs back to Airtable. Low priority — the airtable_record_id is the primary sync key and works fine one-way. Could add a reverse write in a future iteration.


How Email Matching Will Work (Classifier Flow)
Email forwarded from jason.garman@amazon.com
    ↓
Classifier checks aws_relationships.aws_contact_emails across all 7 records
    ↓
Finds match: ["jason.garman@amazon.com"] on "AI / API Security Team"
    ↓
Links the engagement to this AWS Relationship via junction table
    ↓
Steven sees: "This engagement involves the AI / API Security Team"

What you need to enter for each of the 7 relationships:
Relationship
Primary Contact
Emails to Add
AI / API Security Team
Jason Garman
jason.garman@amazon.com
Edge Services / WAF Team
Mysty Lawrence
mysty.lawrence@amazon.com
Infor AWS Team
(none set)
(add when known)
Multicloud Team
Ellie Tamari
ellie.tamari@amazon.com
Observability Team
Frank Schwarzenau
frank.schwarzenau@amazon.com, igor.sedukhin@amazon.com
OpenSearch Team
Stefan Tabacaru
stefan.tabacaru@amazon.com
Workspaces/Appstream Team
(AWS Contacts says Ella Gille)
ella.gille@amazon.com

Note: Verify exact email formats — Amazon sometimes uses firstname.lastname, first.last, or aliases.

Entity 4: Partner Engagements
Sync direction: Roadrunner → Airtable (activity push) Trigger: Auto fire-and-forget on create/update + manual bulk push button Match strategy: airtable_record_id first, then Roadrunner ID field, then name + partner_name Record counts: 37 in Airtable (manually created), 0 in Supabase (pre-classification)
Supabase Column
Airtable Field
Field ID
Direction
Transform
Status
name
Name
fldxq7bsx8PuRvodp
RR → AT
None
✅ Synced
pillar
Pillar
fldvxfxhOPDGr5jBA
RR → AT
Values match directly: "Co-Sell", "Co-Market", "Co-Build"
✅ Synced
priority
Priority
fld4N2kKPFJEqwYtN
RR → AT
Values match directly: "Mandated", "High", "Normal", "Opportunistic"
✅ Synced
status
Status
fldUAOu4GG1Wme5OJ
RR → AT
Map: "planned"→"Planned", "active"→"Active", "paused"→"Blocked", "completed"→"Completed", "archived"→"Archived"
✅ Synced
tags (text[])
Tags
fldkgcbEZZSJv0cbN
RR → AT
Join array with ", " for comma-separated text
✅ Synced
partner_name
Partner (link)
fld8MJU06GPUU0iy6
RR → AT
Resolve name → Partners table record ID → send as [recordId]
✅ Synced
current_state + open_items
Notes
flduVQ9wp3XXVUiwo
RR → AT
Merge into Notes with === Roadrunner Activity Summary === marker. Never overwrites manual notes.
✅ Synced
id (UUID)
Roadrunner ID
fldJJ8ZlwhePawiEl
RR → AT
Stored on first push
✅ Synced
airtable_record_id
record ID
—
AT → RR
Stored after create/match
✅ Synced
—
Start Date
fldZ2E9NxdcXOsqwr
🚫
—
Airtable-only — strategic planning date
—
Target Completion
fldJA9czwRJoQ2CYI
🚫
—
Airtable-only — strategic planning date
—
AWS Stakeholders
fldLVPbg7iyz0Nli9
🚫
—
Airtable-only — manually curated
—
Partner Stakeholders
fldj6vaWwDKJy6aci
🚫
—
Airtable-only — manually curated
—
Third Parties
flduajBotnT6x5ZXD
🚫
—
Airtable-only — manually curated
—
Attachments
fldRmF3G5thoMcJ7Y
🚫
—
Airtable-only — manual file uploads
—
Related Program (link)
fldoZx1XmHMd33XPZ
🚫
—
Airtable-only — links to Tier 2 Partner Programs enrollment
—
2026 Partner Plans (link)
fld828T04BpU7mZTm
🚫
—
Airtable-only — links to annual plans
—
AWS Relationships (link)
fldhVQTAP2wucnzNC
🚫
—
Airtable-only — linked via Airtable UI (Roadrunner has junction table separately)
—
Event Meetings (link)
fldqM0QO5VWjhmvw3
🚫
—
Airtable-only — reverse link from meetings
created_at / updated_at
—
—
Supabase-only
—
Auto-managed timestamps
summary
—
—
Supabase-only
—
Short email-derived summary (folded into Notes via current_state for AT)

Gaps:
None. Status mapping is complete — Supabase now has all 5 values (planned, active, paused, completed, archived) matching Airtable (Planned, Active, Blocked, Completed, Archived). Migration 025 added the missing values.


Airtable-only fields are NEVER overwritten — this is enforced in the push logic. The sync only sends the fields listed as ✅ Synced.



Entity 5: Meetings
Sync direction: Roadrunner → Airtable (activity push) Trigger: ⏳ Not yet built — will follow engagement push pattern Match strategy: airtable_record_id first, then Roadrunner ID field, then title + date Record counts: 0 in both systems (no meetings created yet)
Supabase Column
Airtable Field
Field ID
Direction
Transform
Status
title
Event Name (formula)
fldcbatIDunJ00dLp
🚫
—
Formula field — auto-generated from Event + Partner + Type. Not writable.
event_id (FK)
Event (link)
fldT96Imgc7CFDBEX
RR → AT
Resolve event_id → events.airtable_record_id → send as [recordId]
⏳ Planned
partner_name
Partner (link)
fldZjCUMpBtgpU13X
RR → AT
Resolve name → Partners table record ID → send as [recordId]
⏳ Planned
meeting_type
Meeting Type
fldGWa1MFoqoc89qC
RR → AT
Values match directly: "Executive Meeting", "GTM Meeting", "Product Team Relationship", "Specialized Meeting"
⏳ Planned
status
Status
fldpXlLugkUgQsjcr
RR → AT
Values match directly: "Scheduling", "Invites Sent", "Confirmed", "Completed", "Did Not Occur"
⏳ Planned
meeting_date
Meeting Date
fldx9ZrIMundEMUko
RR → AT
None (date format)
⏳ Planned
attendees (JSONB)
AWS Contact(s)
fldOVCmwhiisY8bDo
RR → AT
Extract attendees where org contains "AWS" or "Amazon" → join names as text
⏳ Planned
attendees (JSONB)
Partner Contact(s)
fldJira79g9xWNTte
RR → AT
Extract attendees where org is partner → join names as text
⏳ Planned
notes
Notes
fldzGUipu36EA9rax
RR → AT
None (or use marker pattern like engagements)
⏳ Planned
engagement_id (FK)
Engagement (link)
fld2TczwxJXZLUwpW
RR → AT
Resolve engagement_id → engagements.airtable_record_id → send as [recordId]
⏳ Planned
start_time
Start Time
fldifWilEYICfifXz
RR → AT
None (text)
⏳ Planned
end_time
End Time
fldV78rQbzDhVK9NO
RR → AT
None (text)
⏳ Planned
location
Location
fldTyiMYT48aCHttx
RR → AT
None
⏳ Planned
source
Source
fld2RW78vS1T91bab
RR → AT
Values match directly: "manual", "ics_parsed"
⏳ Planned
id (UUID)
Roadrunner ID
fldLveS95zGGVU4j1
RR → AT
Stored on first push
⏳ Planned
ics_uid
ICS UID
fldNb83l5XLtz8J9k
RR → AT
None
⏳ Planned
airtable_record_id
record ID
—
AT → RR
Stored after create/match
⏳ Planned
—
AWS Relationships (link)
fldeDCWtZx7YoyYR6
⏳
Resolve via meeting_aws_relationships junction → airtable_record_ids → [recordId, ...]
⏳ Planned

Key challenge for meetings sync: The attendees JSONB field in Supabase stores structured data [{name, email, organization, role}], but Airtable has two separate plain text fields: "AWS Contact(s)" and "Partner Contact(s)". The sync needs to split attendees by organization and format as text.
Airtable's "Event Name" is a formula field (concatenates Event + Partner + Meeting Type) — it's read-only and doesn't need to be set during sync.

Entities NOT Synced (Airtable-Only)
These tables exist only in Airtable and have no Roadrunner equivalent. They are strategic/operational tables managed entirely through the Airtable UI.
Airtable Table
Purpose
Why Not Synced
Partners
Master partner records
Roadrunner uses partner_name text field — resolved to Partner record ID during sync push. No need for full partner records in Supabase.
Partner Programs (Tier 2)
Partner × Program enrollment status
Tracks which partners are pursuing which programs and their progress. Strategic tracking managed in Airtable.
Partner Events (Tier 2)
Partner × Event status
Tracks invitation/registration/sponsoring per partner per event. Operational event management in Airtable.
Partner Plans 2026
Annual planning
Goals, targets, OKRs per partner. Purely strategic.
MPOPP Funding
Credit program funding
Financial tracking. Airtable-only.
MDF Funding
Marketing development funds
Financial tracking. Airtable-only.
ARCH. (Archived Initiatives)
Historical
Renamed and hidden. Replaced by Partner Engagements.


Supabase-Only Tables (No Airtable Equivalent)
These tables exist only in Roadrunner for internal processing.
Supabase Table
Purpose
Why Not in Airtable
messages
Raw email storage
Every forwarded email's full content. Too granular for Airtable.
participants
Email participants extracted from messages
Auto-extracted from/to/cc. Internal to classification pipeline.
participant_links
Junction: participants ↔ engagements
Internal relationship tracking.
entity_links
Polymorphic junction: engagements ↔ programs/events
Roadrunner's way of linking engagements to catalog entities. Airtable handles this via its own link fields.
approval_queue
SMS/dashboard approval flow
Engagement assignment review queue for low-confidence classifications.
notes
Internal notes on engagements
Different from Airtable Notes field — these are per-message classification notes.
engagement_aws_relationships
Junction: engagements ↔ relationships
Supabase junction table. Airtable handles via its own link field.
meeting_aws_relationships
Junction: meetings ↔ relationships
Supabase junction table. Airtable handles via its own link field.


Value Mapping Reference
Program Types
Airtable Value
Supabase Value
Competency
competency
Service Ready
service_ready
SCA
sca
Program
program
Credit Program
credit_program

Event Formats
Values are already lowercase in both systems: conference, summit, workshop, trade_show, training, deadline, review_cycle, kickoff
Relationship Types
Airtable Value
Supabase Value
Exec/Leader
exec_leader
Product Team
product_team
Program Team
program_team
Seller
seller

Relationship Strength
Airtable Value
Supabase Value
Strong
strong
Building
building
New
new
Deferred
deferred

Engagement Status
Supabase Value
Airtable Value
Notes
planned
Planned
✅ Mapped
active
Active
✅ Mapped
paused
Blocked
✅ Mapped
completed
Completed
✅ Mapped
archived
Archived
✅ Mapped

Engagement Pillar
Values match directly in both systems: Co-Sell, Co-Market, Co-Build
Engagement Priority
Values match directly in both systems: Mandated, High, Normal, Opportunistic
Meeting Types
Values match directly in both systems: Executive Meeting, GTM Meeting, Product Team Relationship, Specialized Meeting
Meeting Status
Values match directly in both systems: Scheduling, Invites Sent, Confirmed, Completed, Did Not Occur
Meeting Source
Values match directly in both systems: manual, ics_parsed

Action Items
Immediate (Before Next Build Session)
📝 Populate AWS Contact Emails — Add email addresses to all 7 AWS Relationships records in Airtable (Primary Contact Email + AWS Contact Emails fields). Then run sync to pull into Supabase. Required for classifier email matching.


~~⚠️ Add "planned" and "archived" to engagement status~~ ✅ Done — Migration 025 aligned Supabase to 5 values (planned, active, paused, completed, archived). Status mapping updated in sync.


Next Build Session
⏳ Build meetings sync (RR→AT) — Follow engagement push pattern. Field mapping is fully defined above. Key challenges: attendees JSONB → split text fields, event_id resolution via airtable_record_id, engagement_id resolution.


~~⏳ Build ICS parsing~~ ✅ Done — ICS parser extracts meetings from body-calendar field, inline VCALENDAR in body-plain, or .ics file attachments. Creates meeting records with source='ics_parsed' and message_id FK for provenance. Feeds into meetings sync.


⏳ Classifier prompt: inject relationships context — Add aws_contact_emails to classifier prompt so Claude can match @amazon.com addresses to teams.


Future Considerations
⏳ Push Roadrunner IDs to Airtable for catalog entities — Currently catalog sync only stores AT record IDs in Supabase, not the reverse. Low priority since airtable_record_id is the primary sync key.


⏳ Bidirectional strategic field sync — Should Airtable edits to Start Date, Stakeholders, etc. flow back to Roadrunner? Currently one-way. May not be needed if Airtable remains the strategic editing surface.



This document should be updated whenever fields are added, removed, or sync behavior changes.

