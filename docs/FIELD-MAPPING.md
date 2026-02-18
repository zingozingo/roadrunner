# Roadrunner ↔ Airtable Field Mapping Guide

> **Last updated:** 2026-02-18
> **Airtable Base:** Steven Partners 2026 MCP (`appy9TT1LRJTAuQ4W`)

## How the Sync Works

Roadrunner connects to Airtable using **field IDs**, not field names. This means:

- **Safe to do in Airtable:** Rename fields, reorder fields, add new fields, change colors, add views
- **Requires sync.ts update:** Change a field's type, change select option values, delete a synced field, or add a new field you want Roadrunner to use
- **Key principle:** Field IDs are permanent. Names are cosmetic. Types are contracts.

## System Ownership

| System | Owns | Direction |
|--------|------|-----------|
| **Airtable** | Partners, Programs, Events, AWS Relationships (catalog data) | AT → RR (pull) |
| **Roadrunner** | Engagements, Meetings (activity data) | RR → AT (push) |

Catalog tables are read from Airtable into Roadrunner. Activity tables are written from Roadrunner to Airtable. This one-directional ownership prevents sync conflicts.

---

## Partners (AT → RR)

**Table:** `tbl9zC6nxfLEp8xUx` · **Sync constant:** `PTRF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Partner Name | `fldlE5L12oES6IQSO` | multilineText | `PTRF.name` | Primary field |
| Segment | `fldSoIAhWfmPgHzuc` | singleSelect | `PTRF.segment` | Security, SecOps, DevOps, CloudOps, Observability, OT/IoT. **Renamed from Category 2026-02-18.** |
| Focus Area | `fldeW5BvDgSp1bLNX` | multipleSelects | `PTRF.focusArea` | Network Security, API Security, IaC, IT Management, etc. **Renamed from Sub-Category, converted text→multipleSelects 2026-02-18.** DB stores as text[]. |
| Alliance Lead | `fldN2yZtjwetyHJwI` | singleLineText | `PTRF.allianceLead` | |
| PSA | `fldNRDPljDlJZkbds` | singleSelect | `PTRF.psa` | 5 options |
| SPMS ID | `fld9gzD2CRM9NApUH` | number | `PTRF.spmsId` | |
| Alliance Lead Email | `fldgoSc6QMl6l1303` | email | `PTRF.allianceLeadEmail` | Used for email matching |
| Partner Contact Emails | `fldAEQSbi448tEjff` | multilineText | `PTRF.partnerContactEmails` | Semicolon-separated; used for email-to-partner matching |
| AWS Stickiness | `fldlCzNjHA3Ziuqtv` | multilineText | `PTRF.awsStickiness` | **New sync 2026-02-18.** Narrative text about customer AWS adoption likelihood. |
| Key AWS Services | `fldQwm8UtaNxAa9dI` | multipleSelects | `PTRF.keyAwsServices` | **New sync 2026-02-18.** EC2, S3, Lambda, IAM, VPC, EKS, CloudWatch, etc. DB stores as text[]. |

**Airtable-only fields (not synced):** AWS Account Manager, PMM, Trailing 12 Months, Deployed on AWS, ISVa Status/Notes, PRM Status, all financial metrics (TCV, LARR, MDF), 2026 Partner Plans, MPOPP Funding, Partner Programs (link), Partner Event Status (link), Meetings (reverse link), ARCH. (legacy link), Partner Engagements (reverse link).

**Note:** The `ARCH.` link field connects to the archived Partner Initiatives table. This is legacy — initiatives were replaced by engagements. Not breaking anything but is clutter you can delete when ready.

---

## Programs — Tier 1 Catalog (AT → RR)

**Table:** `tblpnW8ibVmkWi5Dt` · **Sync constant:** `PF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Program Name | `fldlJgX0tVWwA516E` | singleLineText | `PF.name` | Primary field |
| Type | `fldCd7TnUOgxnWmNt` | singleSelect | `PF.type` | |
| Description | `fldHN5mCWH6lXmoY1` | multilineText | `PF.description` | |
| Requirements | `fldxxsFFMc649nZft` | multilineText | `PF.requirements` | |
| Lifecycle | `fldo04XmU7rQhwOVT` | singleLineText | `PF.lifecycle` | |
| Lifecycle Duration | `fldeExdR8irrzC5GV` | singleLineText | `PF.lifecycleDuration` | |
| URL | `fldj2uk4rf4ifqGLH` | url | `PF.url` | |

**Airtable-only fields:** Meetings (reverse link from Meetings.Program).

---

## Events (AT → RR)

**Table:** `tblPDGUSqSvn8mflJ` · **Sync constant:** `EF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Event Name | `fld1hURggkL0DTHnC` | singleLineText | `EF.name` | Primary field |
| Date | `fld62hHfwpOJw7nyZ` | date | `EF.date` | Start date |
| End Date | `fldTUy6jHj4KpR6SZ` | date | `EF.endDate` | |
| Location | `fldwjmRq0saFpFHao` | singleLineText | `EF.location` | |
| Format | `fldpuxeQ5DRhMwizr` | singleSelect | `EF.format` | |
| Host | `fldaDlidcRmUCvxFK` | singleLineText | `EF.host` | |
| Description | `fldTMiRJ7mqMzGqXY` | multilineText | `EF.description` | |

**Airtable-only fields:** Meetings (reverse link), Partner Event Status (reverse link).

---

## AWS Relationships (AT → RR)

**Table:** `tblqVBssFsUeAt9bj` · **Sync constant:** `RF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Relationship Name | `fldeiFljVC5L61c3v` | singleLineText | `RF.name` | Primary field |
| AWS Org | `fldKSmvO7Lhr5v9Fy` | singleLineText | `RF.awsOrg` | |
| AWS Service | `fldiieBBkkAFYDOJC` | singleLineText | `RF.awsService` | |
| Relationship Type | `fld2cjVCECNIPGw2d` | singleSelect | `RF.type` | Exec/Leader, Product Team, Program Team, Seller |
| Primary Contact(s) | `fldhCrECNQ0uBA2tD` | singleLineText | `RF.primaryContact` | |
| Primary Contact Email | `fldoWXiosjUJBPDqF` | email | `RF.primaryContactEmail` | Used for email matching |
| AWS Contact Emails | `fldEu6kRhcn1929CA` | singleLineText | `RF.awsContactEmails` | Comma-separated; used for email matching |
| Notes | `fldOcbNUrtfxjqiW5` | multilineText | `RF.notes` | |
| Roadrunner ID | `fldfZksUDfLbvVQMT` | singleLineText | — | Sync key written by RR |

**Airtable-only fields:** AWS Contacts, Last Touch, How We Connected, Partner Programs (link), Partner Event Status (link), Partner Engagements (reverse link), Meetings (reverse link).

**Note:** `How We Connected` and `Last Touch` exist in Airtable but are NOT synced to Roadrunner despite appearing in a previous version of this guide. They are Airtable-only manual fields.

---

## Partner Engagements (RR → AT)

**Table:** `tblTC491AUVcrKvq2` · **Sync constant:** `ENF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Name | `fldxq7bsx8PuRvodp` | singleLineText | `ENF.name` | Primary field |
| Pillar | `fldvxfxhOPDGr5jBA` | singleSelect | `ENF.pillar` | |
| Priority | `fld4N2kKPFJEqwYtN` | singleSelect | `ENF.priority` | |
| Status | `fldUAOu4GG1Wme5OJ` | singleSelect | `ENF.status` | |
| Tags | `fldkgcbEZZSJv0cbN` | multipleSelects | `ENF.tags` | |
| Notes | `flduVQ9wp3XXVUiwo` | multilineText | `ENF.notes` | Merge pattern (appends, doesn't overwrite) |
| Roadrunner ID | `fldJJ8ZlwhePawiEl` | singleLineText | `ENF.roadrunnerId` | Sync key |
| Partner | `fld8MJU06GPUU0iy6` | multipleRecordLinks | `ENF.partner` | Link to Partners table |
| AWS Stakeholders | `fldLVPbg7iyz0Nli9` | multilineText | `ENF.awsStakeholders` | **New sync 2026-02-18.** Newline-separated names from participants table. `@amazon.com` email or "AWS"/"Amazon" org. |
| Partner Stakeholders | `fldj6vaWwDKJy6aci` | multilineText | `ENF.partnerStakeholders` | **New sync 2026-02-18.** Newline-separated names from participants table. Org matches engagement partner_name. |
| Third Parties | `flduajBotnT6x5ZXD` | multilineText | `ENF.thirdParties` | **New sync 2026-02-18.** Newline-separated names. Everyone else (excluding system/relay/user addresses). |

**Airtable-only fields:** AWS Relationships (reverse link), Meetings (reverse link).

---

## Meetings (RR → AT)

**Table:** `tbl6LsEqSvEZgqBdW` · **Sync constant:** `MF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Meeting Name | `fldcbatIDunJ00dLp` | singleLineText | `MF.meetingName` | **Primary field.** Was formula, converted to writable text 2026-02-18. RR writes `meeting.title`. |
| Event | `fldT96Imgc7CFDBEX` | multipleRecordLinks | `MF.event` | Link to Events table |
| Partner | `fldZjCUMpBtgpU13X` | multipleRecordLinks | `MF.partner` | Link to Partners table |
| Meeting Type | `fldGWa1MFoqoc89qC` | singleSelect | `MF.meetingType` | Executive Meeting, Specialized Meeting, GTM Meeting, Product Team Relationship |
| Status | `fldpXlLugkUgQsjcr` | singleSelect | `MF.status` | Scheduling, Invites Sent, Confirmed, Completed, Did Not Occur |
| Meeting Date | `fldx9ZrIMundEMUko` | date | `MF.meetingDate` | |
| AWS Contact(s) | `fldOVCmwhiisY8bDo` | singleLineText | `MF.awsContacts` | Text from attendee split (system addresses filtered) |
| Partner Contact(s) | `fldJira79g9xWNTte` | singleLineText | `MF.partnerContacts` | Text from attendee split (system addresses filtered) |
| Notes | `fldzGUipu36EA9rax` | multilineText | — | **Airtable-only** as of 2026-02-18. Not pushed by Roadrunner; manual scratch space. |
| Engagement | `fld2TczwxJXZLUwpW` | multipleRecordLinks | `MF.engagement` | Link to Partner Engagements |
| AWS Relationships | `fldeDCWtZx7YoyYR6` | multipleRecordLinks | `MF.awsRelationships` | Link to AWS Relationships |
| Program | `fldqhPAGvYppRZgCS` | multipleRecordLinks | `MF.program` | **New 2026-02-18.** Link to Programs catalog (Tier 1). |
| Start Time | `fldifWilEYICfifXz` | singleLineText | `MF.startTime` | |
| End Time | `fldV78rQbzDhVK9NO` | singleLineText | `MF.endTime` | |
| Location | `fldTyiMYT48aCHttx` | singleLineText | `MF.location` | |
| Source | `fld2RW78vS1T91bab` | singleLineText | `MF.source` | "manual" or "ics_parsed" |
| Roadrunner ID | `fldLveS95zGGVU4j1` | singleLineText | `MF.roadrunnerId` | Sync key |
| ICS UID | `fldNb83l5XLtz8J9k` | singleLineText | `MF.icsUid` | Calendar event unique ID |

**Match strategy (3-tier):**
1. `airtable_record_id` — exact record match (existing synced records)
2. `roadrunnerId` — Roadrunner UUID match
3. `title + meeting_date` — fallback for manually-created Airtable records

**Meeting types supported:**
- **Event meetings** — linked to Event + Partner (re:Invent, summits)
- **Program meetings** — linked to Program + Partner (competency reviews, program calls)
- **Standalone engagement meetings** — linked to Engagement + Partner only (general partner calls)

---

## Supabase Meetings Table (DB Schema)

For reference, the Supabase `meetings` table columns and their Airtable counterparts:

| DB Column | DB Type | Airtable Field | Notes |
|-----------|---------|----------------|-------|
| `id` | uuid PK | — | Internal only |
| `title` | text NOT NULL | Meeting Name (`MF.meetingName`) | Written to primary field |
| `engagement_id` | uuid FK→engagements | Engagement (`MF.engagement`) | Resolved to AT record ID |
| `event_id` | uuid FK→events | Event (`MF.event`) | Resolved to AT record ID |
| `partner_id` | uuid FK→partners | Partner (`MF.partner`) | Resolved to AT record ID |
| `partner_name` | text | — | Legacy; used for partner matching when partner_id is null |
| `program_id` | uuid FK→programs | Program (`MF.program`) | **New migration 032.** Resolved to AT record ID |
| `message_id` | uuid FK→messages | — | Links meeting to source email; not synced to AT |
| `meeting_type` | text | Meeting Type (`MF.meetingType`) | |
| `status` | text NOT NULL | Status (`MF.status`) | CHECK: 5 values |
| `meeting_date` | date | Meeting Date (`MF.meetingDate`) | |
| `start_time` | text | Start Time (`MF.startTime`) | |
| `end_time` | text | End Time (`MF.endTime`) | |
| `location` | text | Location (`MF.location`) | |
| `organizer_email` | text | — | Not synced to AT |
| `attendees` | jsonb | AWS/Partner Contact(s) split | Array of {name, email}; split into two text fields |
| `ics_uid` | text UNIQUE | ICS UID (`MF.icsUid`) | |
| `source` | text NOT NULL | Source (`MF.source`) | "manual" or "ics_parsed" |
| `notes` | text | — | Not synced to AT. Used for manual meetings only; ICS-parsed meetings leave null. |
| `airtable_record_id` | text UNIQUE | — | AT record ID for sync matching |
| `created_at` | timestamptz | — | |
| `updated_at` | timestamptz | — | Auto-updated via trigger |

---

## Tables NOT Synced to Roadrunner

These Airtable tables exist in the base but are purely Airtable-managed:

| Table | Purpose |
|-------|---------|
| Partner Programs (`tbl1CPtbVzQvRN8LA`) | Tier 2 enrollment records (per-partner program status) |
| Partner Events (`tblYljQDnXwjTDy2T`) | Per-partner event attendance/status |
| Partner Plans 2026 (`tbligbfCTvpCkG7tS`) | Annual partner plans |
| MPOPP Funding 2026 (`tbl2ilHOaXYsgxqFY`) | Marketplace funding tracking |
| MDF Funding 2026 (`tblRSsochM23QGQpS`) | Marketing development fund tracking |
| ARCH. (`tblyuSSG76oL0OlsF`) | Archived Partner Initiatives (legacy, replaced by Engagements) |

---

## Inverse Link Field Renames (2026-02-18)

All stale "Big Event Meetings" and "Event Meetings" reverse link fields were renamed to "Meetings" across synced tables to reflect broader meeting scope:

| Table | Old Name | New Name | Field ID |
|-------|----------|----------|----------|
| Partners | Big Event Meetings | Meetings | `fldRsH7eI2YhP67eg` |
| Events | Big Event Meetings | Meetings | `fldkoNCXfHrvU1knw` |
| Partner Engagements | Event Meetings | Meetings | `fldqM0QO5VWjhmvw3` |
| AWS Relationships | Event Meetings | Meetings | `fldTyEGdlnaCxftOt` |
| Programs | *(auto-created)* | Meetings | `fldFjEvIHYp12TXzF` |

---

## Attendee Filtering (2026-02-18)

The attendee split logic in sync.ts filters out system addresses before classifying contacts as AWS or partner:

**Filtered addresses:**
- `*@relay.stevenromero.dev` — Roadrunner forwarding address
- `*salesforce*` — Salesforce system emails
- Any email matching `isUserEmail()` from user-config.ts (corpmail, PRVS, personal aliases)

Remaining attendees are split: `@amazon.com` → AWS Contact(s), everything else → Partner Contact(s).