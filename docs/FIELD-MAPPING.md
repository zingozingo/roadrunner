# Roadrunner ↔ Airtable Field Mapping Guide

> **⚠️ DEPRECATED** — This document has been superseded by [`docs/entity-model.md`](entity-model.md), which includes all field mappings alongside schema definitions, sync directions, and ownership badges. This file is kept for historical reference only.

> **Last updated:** 2026-03-01
> **Airtable Base:** Steven Partners 2026 MCP (`appy9TT1LRJTAuQ4W`)

## How the Sync Works

Roadrunner connects to Airtable using **field IDs**, not field names. This means:

- **Safe to do in Airtable:** Rename fields, reorder fields, add new fields, change colors, add views
- **Requires field-maps.ts update:** Change a field's type, change select option values, delete a synced field, or add a new field you want Roadrunner to use
- **Key principle:** Field IDs are permanent. Names are cosmetic. Types are contracts.

All field ID constants live in `src/lib/sync/field-maps.ts`. This file is the single source of truth for what Roadrunner reads from and writes to Airtable.

## System Ownership

| System | Owns | Direction |
|--------|------|-----------|
| **Airtable** | Partners, Programs, Events, AWS Relationships (catalog data) | AT → RR (pull) |
| **Roadrunner** | Engagements, Meetings (activity data) | RR → AT (push) |

Catalog tables are read from Airtable into Roadrunner. Activity tables are written from Roadrunner to Airtable. This one-directional ownership prevents sync conflicts.

## Contact Format Convention

All contact fields use the universal format: `Name <email> (Title)`

- Missing email → `<—>` (em-dash placeholder)
- Missing title → `(—)` (em-dash placeholder)
- Parser: `src/lib/contact-parser.ts` (single source of truth)
- Role-based fields (PSA, Alliance Lead, etc.) store role in the Airtable column name, not in the contact string

Examples:
```
CJ Sturgess <sturgeci@amazon.com> (Partner Solutions Architect)
Julia Irion <juliai@spacelift.io> (—)
Jazz Totten <—> (—)
```

---

## Partners (AT → RR)

**Table:** `tbl9zC6nxfLEp8xUx` · **Sync constant:** `PTRF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Partner Name | `fldlE5L12oES6IQSO` | multilineText | `PTRF.name` | Primary field |
| What They Do | `fldnoDB2la8oLgrqR` | multilineText | `PTRF.whatTheyDo` | Partner description |
| Segment | `fldSoIAhWfmPgHzuc` | singleSelect | `PTRF.segment` | Security, DevOps, CloudOps, Observability, OT/IoT |
| Focus Area | `fldeW5BvDgSp1bLNX` | multipleSelects | `PTRF.focusArea` | DB stores as text[] |
| Alliance Lead | `fldLbBuiYhisMSqJu` | singleLineText | `PTRF.allianceLead` | Format: `Name <email> (Title)`. Partner-side alliance contact. |
| PSA | `fldp175r0XAz4Cwbj` | singleLineText | `PTRF.psa` | Format: `Name <email> (Title)`. AWS Partner Solutions Architect. |
| Account Manager | `fldLzr6Rn9hpciP70` | singleLineText | `PTRF.accountManager` | Format: `Name <email> (Title)`. AWS Account Manager. |
| PMM | `fldgGnuwXCM7EWOVq` | singleLineText | `PTRF.pmm` | Format: `Name <email> (Title)`. AWS Partner Marketing Manager. |
| Contacts | `fldwnagXCUQ0QIHDg` | multilineText | `PTRF.contacts` | Additional partner contacts. One per line, same format. |
| AWS Stickiness | `fldlCzNjHA3Ziuqtv` | multilineText | `PTRF.awsStickiness` | Narrative text about customer AWS adoption likelihood |
| Key AWS Services | `fldQwm8UtaNxAa9dI` | multipleSelects | `PTRF.keyAwsServices` | EC2, S3, Lambda, IAM, VPC, EKS, etc. DB stores as text[] |

**DB JSONB columns (populated from above fields during pull):**
- `aws_team` — JSONB array of `{name, email, title, role}` parsed from PSA, Account Manager, PMM
- `partner_contacts` — JSONB array of `{name, email, title, role}` parsed from Alliance Lead, Contacts

**Phase 3 complete:** Old scalar columns (`alliance_lead`, `psa`, `am`, `pmm`, etc.) have been dropped. Migration 048 removes all 12 legacy columns. JSONB arrays are the only contact data path.

**Airtable-only fields (not synced):** SPMS ID, Trailing 12 Months, Deployed on AWS, ISVa Status/Notes, PRM Status, all financial metrics (TCV, LARR, MDF), Listing Types, Pricing Model, Architecture, 2026 Partner Plans, MPOPP Funding, MDF Funding, Partner Programs (link), Partner Events (link), Meetings (reverse link), Partner Engagements (reverse link).

---

## Programs — Tier 1 Catalog (AT → RR)

**Table:** `tblpnW8ibVmkWi5Dt` · **Sync constant:** `PF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Program Name | `fldlJgX0tVWwA516E` | singleLineText | `PF.name` | Primary field |
| Type | `fldCd7TnUOgxnWmNt` | singleSelect | `PF.type` | Competency, Service Ready, SCA, Program, Funding, Channel, Enablement |
| Description | `fldHN5mCWH6lXmoY1` | multilineText | `PF.description` | |
| Requirements | `fldxxsFFMc649nZft` | multilineText | `PF.requirements` | |
| What It Unlocks | `fld4870bblJTGbAgn` | multilineText | `PF.whatItUnlocks` | MDF funding, badges, co-marketing, etc. |
| Lifecycle | `fldo04XmU7rQhwOVT` | singleLineText | `PF.lifecycle` | recurring, expiring, indefinite |
| Lifecycle Duration | `fldeExdR8irrzC5GV` | singleLineText | `PF.lifecycleDuration` | |
| Notes | `fldzsmhcQ0Z6Rnjhk` | multilineText | `PF.notes` | |

**Airtable-only fields:** Meetings (reverse link), Partner Engagements (reverse link).

---

## Events (AT → RR)

**Table:** `tblPDGUSqSvn8mflJ` · **Sync constant:** `EF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Event Name | `fld1hURggkL0DTHnC` | singleLineText | `EF.name` | Primary field |
| Event Date | `fld62hHfwpOJw7nyZ` | date | `EF.date` | Start date |
| End Date | `fldTUy6jHj4KpR6SZ` | date | `EF.endDate` | |
| Location | `fldwjmRq0saFpFHao` | singleLineText | `EF.location` | |
| Format | `fldpuxeQ5DRhMwizr` | singleSelect | `EF.format` | conference, summit, workshop, trade_show, training |
| Host | `fldaDlidcRmUCvxFK` | singleLineText | `EF.host` | |
| Description | `fldTMiRJ7mqMzGqXY` | multilineText | `EF.description` | |
| GEO | `fld9idvQawFVNu5sa` | singleLineText | `EF.geo` | NAMER, EMEA, APJ, LATAM, GCR |
| Sponsor Option? | `fldyAVpfZbG1SaDJz` | checkbox | `EF.sponsorOption` | Whether partner sponsorship is available |
| Partner Day? | `fldTWZbQSEruQYdLe` | checkbox | `EF.partnerDay` | Whether event includes a Partner Summit/Day |
| Partner Day Date | `fldo8mDJ5vvXK5bu7` | date | `EF.partnerDayDate` | Date of Partner Day if different from main event |

**Airtable-only fields:** Partner Event Status (reverse link), Meetings (reverse link).

---

## AWS Relationships (AT → RR)

**Table:** `tblqVBssFsUeAt9bj` · **Sync constant:** `RF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Relationship Name | `fldeiFljVC5L61c3v` | singleLineText | `RF.name` | Primary field |
| AWS Org | `fldKSmvO7Lhr5v9Fy` | singleLineText | `RF.awsOrg` | Platform, Security, Observability, Analytics, Multicloud |
| AWS Service(s) | `fldiieBBkkAFYDOJC` | singleLineText | `RF.awsService` | |
| Relationship Type | `fld2cjVCECNIPGw2d` | singleSelect | `RF.type` | Exec/Leader, Product Team, Program Team, Seller |
| Lead Contact | `fldKELDdEYb8MsJCP` | singleLineText | `RF.leadContact` | Format: `Name <email> (Title)` |
| Team Contacts | `fld472yolP2ujyJ5w` | multilineText | `RF.teamContacts` | One per line, same format |
| Notes | `fldOcbNUrtfxjqiW5` | multilineText | `RF.notes` | |
| Roadrunner ID | `fldfZksUDfLbvVQMT` | singleLineText | — | Sync key written by RR |

**DB JSONB column:** `contacts` — array of `{name, email, title}` parsed from Lead Contact + Team Contacts.

**Airtable-only fields:** Partner Engagements (reverse link), Meetings (reverse link).

---

## Partner Engagements (RR → AT)

**Table:** `tblTC491AUVcrKvq2` · **Sync constant:** `ENF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Name | `fldxq7bsx8PuRvodp` | singleLineText | `ENF.name` | Primary field |
| Pillar | `fldvxfxhOPDGr5jBA` | singleSelect | `ENF.pillar` | Co-Sell, Co-Market, Co-Build |
| Status | `fldUAOu4GG1Wme5OJ` | singleSelect | `ENF.status` | Active, Blocked, Completed, Archived |
| Notes | `flduVQ9wp3XXVUiwo` | multilineText | `ENF.notes` | Merge pattern (appends `=== Roadrunner Activity Summary ===`, doesn't overwrite) |
| Roadrunner ID | `fldJJ8ZlwhePawiEl` | singleLineText | `ENF.roadrunnerId` | Sync key |
| Partner | `fldkYNE9C0UcdnGCL` | multipleRecordLinks | `ENF.partner` | Link to Partners table |
| Program | `fldZ4IqdSvuEXgp83` | multipleRecordLinks | `ENF.program` | Link to Programs catalog. Resolved from `engagements.program_id` FK. |
| AWS Relationships | `fldhVQTAP2wucnzNC` | multipleRecordLinks | `ENF.awsRelationships` | Link to AWS Relationships. Resolved from `engagement_aws_relationships` junction table. |
| Event | `fldscmkRoT65oa6Oy` | multipleRecordLinks | `ENF.event` | Link to Events table. Resolved from entity_links (source_type='engagement', target_type='event'). |
| AWS Stakeholders | `fldLVPbg7iyz0Nli9` | multilineText | `ENF.awsStakeholders` | Newline-separated. `@amazon.com` email or "AWS"/"Amazon" org. |
| Partner Stakeholders | `fldj6vaWwDKJy6aci` | multilineText | `ENF.partnerStakeholders` | Newline-separated. Org matches engagement partner name. |
| Third Parties | `flduajBotnT6x5ZXD` | multilineText | `ENF.thirdParties` | Everyone else (excluding system/relay/user addresses). |

**Airtable-only fields:** Meetings (reverse link).

---

## Meetings (RR → AT)

**Table:** `tbl6LsEqSvEZgqBdW` · **Sync constant:** `MF`

| Airtable Field | Field ID | Type | Sync Key | Notes |
|----------------|----------|------|----------|-------|
| Meeting Name | `fldcbatIDunJ00dLp` | singleLineText | `MF.meetingName` | Primary field |
| Engagement | `fld2TczwxJXZLUwpW` | multipleRecordLinks | `MF.engagement` | Link to Partner Engagements — THE link. All other connections inherited via AT lookups. |
| Status | `fldpXlLugkUgQsjcr` | singleSelect | `MF.status` | Scheduled, Completed, Cancelled, Did Not Occur. DB stores lowercase; sync maps via `MEETING_STATUS_MAP`. |
| Meeting Date | `fldx9ZrIMundEMUko` | date | `MF.meetingDate` | |
| AWS Stakeholders | `fldOVCmwhiisY8bDo` | multilineText | `MF.awsStakeholders` | `@amazon.com` or AWS/Amazon org attendees. Newline-separated. |
| Partner Stakeholders | `fldJira79g9xWNTte` | multilineText | `MF.partnerStakeholders` | Org matches meeting's partner name. Newline-separated. |
| Third Parties | `fldhU8nE7uGE1agML` | multilineText | `MF.thirdParties` | Non-AWS, non-partner meeting attendees. Newline-separated. |
| Start Time | `fldifWilEYICfifXz` | singleLineText | `MF.startTime` | |
| End Time | `fldV78rQbzDhVK9NO` | singleLineText | `MF.endTime` | |
| Location | `fldTyiMYT48aCHttx` | singleLineText | `MF.location` | |
| Source | `fld2RW78vS1T91bab` | singleLineText | `MF.source` | "manual" or "ics_parsed" |
| Roadrunner ID | `fldLveS95zGGVU4j1` | singleLineText | `MF.roadrunnerId` | Sync key |
| ICS UID | `fldNb83l5XLtz8J9k` | singleLineText | `MF.icsUid` | Calendar event unique ID |

**Partner, Program, and Event are displayed in AT via lookup fields from the Engagement link. They are not directly pushed by Roadrunner.**

**Engagement gate:** Meetings without an `engagement_id` are not pushed to Airtable. ICS-parsed meetings are created before classification runs; once classification links them to an engagement, the push fires.

**Match strategy (3-tier):**
1. `airtable_record_id` — exact record match (existing synced records)
2. `roadrunnerId` — Roadrunner UUID match
3. `title + meeting_date` — fallback for manually-created Airtable records

**Airtable-only fields (not synced by Roadrunner):**
- Meeting Type (`fldGWa1MFoqoc89qC`) — singleSelect for manual classification in AT
- Notes (`fldzGUipu36EA9rax`) — manual scratch space, not pushed by RR

**Partner matching:** `createMeetingFromICS()` deterministically matches attendee email domains against the partner catalog before classification runs.

---

## Attendee Filtering

The attendee split logic filters out system addresses before classifying contacts into three buckets (AWS, Partner, Third Party):

**Filtered addresses:**
- `*@relay.stevenromero.dev` — Roadrunner forwarding address
- `*salesforce*` — Salesforce system emails
- Any email matching `isUserEmail()` from user-config.ts (corpmail, PRVS, personal aliases)

Remaining attendees are split into three buckets:
- `@amazon.com` or AWS/Amazon org → **AWS Stakeholders**
- Org matches the engagement/meeting partner name → **Partner Stakeholders**
- Everyone else → **Third Parties**

This three-bucket pattern is consistent across both Engagements and Meetings.

---

## Tables NOT Synced to Roadrunner

| Table | Table ID | Purpose |
|-------|----------|---------|
| Partner Programs | `tbl1CPtbVzQvRN8LA` | Per-partner program enrollment status |
| Partner Events | `tblYljQDnXwjTDy2T` | Per-partner event attendance/status |
| Partner Plans 2026 | `tbligbfCTvpCkG7tS` | Annual partner plans with targets |
| MPOPP Funding 2026 | `tbl2ilHOaXYsgxqFY` | Marketplace funding tracking |
| MDF Funding 2026 | `tblRSsochM23QGQpS` | Marketing development fund tracking |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-01 | Renamed meeting attendee fields for consistency with engagements (AWS Stakeholders, Partner Stakeholders). Added Third Parties field. Three-bucket attendee split. |
| 2026-03-01 | Removed Partner, Program, Event, AWS Relationships direct links from Meetings. Replaced with AT lookup fields from Engagement. Added engagement gate to meeting push. |
| 2026-03-01 | Added Event linked record field to Partner Engagements. Resolved from entity_links table during push. |
| 2026-03-01 | Removed 4 dead field ID constants from AWS Relationships (primaryContact, primaryContactEmail, awsContactEmails, partners) — deleted from AT during Phase 2, dead in code since Phase 3. |
| 2026-03-01 | **Full rewrite.** Updated Partners (9 old fields → 5 unified contact fields + whatTheyDo + contacts), AWS Relationships (added leadContact, teamContacts, marked legacy fields), Events (added geo, sponsorOption, partnerDay, partnerDayDate), Programs (removed ghost URL, added whatItUnlocks, notes). Added contact format convention section. |
| 2026-02-28 | Contact standardization: universal `Name <email> (Title)` format. Old separate name+email fields deleted from AT. |
| 2026-02-27 | Fixed stale Partner/Meeting link field IDs. Added Program + AWS Relationships links to Engagements. |
| 2026-02-18 | Added event fields (geo, sponsor, partner day). Renamed inverse link fields. Meeting Name converted from formula to writable text. |