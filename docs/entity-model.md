# Roadrunner Entity Model

> **Last updated**: 2026-03-14 (Post-contact-registry, post-task-promotion, post-relationship-rename)
> 18 active tables · 62 migrations · 5 Airtable-only tables (future)

---

## System Ownership Legend

| Badge | Meaning |
|-------|---------|
| **AT** | Airtable-owned — source of truth lives in Airtable, pulled into Supabase |
| **RR** | Roadrunner-owned — source of truth lives in Supabase, pushed to Airtable |
| **RR-only** | Roadrunner-only — no Airtable representation |
| **AT-only** | Airtable-only — not yet in Supabase (planned for future sync) |
| **LEGACY** | Replaced and dropped — historical reference only |

---

## Ring Overview

```mermaid
graph TB
    subgraph RING1["Ring 1: Catalog (AT → RR)"]
        PARTNERS[Partners]
        PROGRAMS[Programs]
        EVENTS[Events]
        RELATIONSHIPS[Relationships]
    end

    subgraph RING2["Ring 2: Activity (RR-owned)"]
        ENGAGEMENTS[Engagements]
        MEETINGS[Meetings]
        MEETING_NOTES[Meeting Notes]
        TASKS[Tasks]
        MESSAGES[Messages]
        APPROVAL_QUEUE[Approval Queue]
        PARTNER_CONTEXT[Partner Context]
    end

    subgraph PEOPLE["People Registry (cross-cutting)"]
        PARTICIPANTS[Participants]
        PP[partner_participants]
        MP[meeting_participants]
        EP[engagement_participants]
        RP[relationship_participants]
    end

    subgraph JUNCTIONS["Connections (cross-cutting)"]
        EL[Entity Links]
        ER[Engagement Relationships]
    end

    subgraph RING3["Ring 3: Posture (AT-only — future)"]
        PARTNER_PROGRAMS[Partner Programs]
        PARTNER_EVENTS[Partner Events]
        PARTNER_PLANS[Partner Plans 2026]
        MPOPP[MPOPP Funding]
        MDF[MDF Funding]
    end

    PARTNERS --- RING2
    PARTICIPANTS --- PP & MP & EP & RP
    EL --- RING1
    EL --- RING2
    RING3 --- PARTNERS
    RING3 --- RING1
```

---

## Ring 1: Catalog (Airtable → Roadrunner)

Reference data that changes slowly. AT-owned, pulled into Supabase via Sync Catalogs. The nouns everything else references.

```mermaid
erDiagram
    PARTNERS {
        uuid id PK
        text name
        text segment
        text airtable_record_id UK
    }
    PROGRAMS {
        uuid id PK
        text name
        text type
        text lifecycle_type
        text airtable_record_id UK
    }
    EVENTS {
        uuid id PK
        text name
        text type
        date start_date
        text geo
        text airtable_record_id UK
    }
    RELATIONSHIPS {
        uuid id PK
        text name
        text relationship_type
        text org_type
        text airtable_record_id UK
    }
```

---

### PARTNERS (Synced — AT-owned catalog, pulled into RR)

**Airtable Table:** `tbl9zC6nxfLEp8xUx` · **Sync constant:** `PTRF`

| Field | SB Type | AT Type | Owner | Sync | AT Field ID | UI |
|-------|---------|---------|-------|------|-------------|-----|
| id | uuid PK | — | RR | — | — | all partner pages |
| name | text NOT NULL | multilineText | AT | ← AT | fldlE5L12oES6IQSO | partner list, detail, sidebar |
| segment | text | singleSelect (6 options) | AT | ← AT | fldSoIAhWfmPgHzuc | partner list, detail |
| focus_area | text[] | multipleSelects (25 options) | AT | ← AT | fldeW5BvDgSp1bLNX | partner detail |
| spms_id | integer UNIQUE | number | AT | ← AT | fld9gzD2CRM9NApUH | — |
| what_they_do | text | multilineText | AT | ← AT | fldnoDB2la8oLgrqR | partner detail, notes context |
| aws_stickiness | text | multilineText | AT | ← AT | fldlCzNjHA3Ziuqtv | notes context |
| key_aws_services | text[] NOT NULL | multipleSelects (29 options) | AT | ← AT | fldQwm8UtaNxAa9dI | partner detail, notes context |
| architecture | text | singleSelect (3 options) | AT | ← AT | fldjzkMqOVIaProi2 | partner detail, notes context |
| listing_types | text[] | multipleSelects (5 options) | AT | ← AT | fldV5OAuGxca1hDW8 | partner detail, notes context |
| pricing_model | text[] | multipleSelects (6 options) | AT | ← AT | fldkStAdCBT16HJPS | partner detail, notes context |
| isva_status | text | singleSelect (2 options) | AT | ← AT | fldHYucRg9ZIJ6PWI | partner detail |
| deployed_on_aws | text | singleSelect (4 options) | AT | ← AT | fldNtBO1Wlh9mOL0c | partner detail |
| prm_status | text | singleSelect (3 options) | AT | ← AT | fldDV1UhZjAuR1Xxl | partner detail |
| crm_status | text | multilineText | AT | ← AT | fldPdisuSJruZqLbo | partner detail |
| aws_team | jsonb (RoleContact[]) | singleLineText ×3 (PSA, AM, PMM) | AT | ← AT | fldp175r0XAz4Cwbj, fldLzr6Rn9hpciP70, fldgGnuwXCM7EWOVq | partner detail, notes context |
| partner_contacts | jsonb (RoleContact[]) | singleLineText + multilineText (Alliance Lead, Contacts) | AT | ← AT | fldLbBuiYhisMSqJu, fldwnagXCUQ0QIHDg | partner detail, notes context |
| airtable_record_id | text UNIQUE | — | RR | — | — | — |
| created_at | timestamptz | — | RR | — | — | — |
| updated_at | timestamptz | — | RR | — | — | — |

> **TRANSITIONAL**: `aws_team` and `partner_contacts` JSONB columns are being replaced by `partner_participants` join table (Decision #178). Will be dropped after contact registry UI rewire.

**AT fields NOT in Supabase (planned for future sync):**

| AT Field | AT Type | AT Field ID | Plan |
|----------|---------|-------------|------|
| Trailing 12 Months ($) | number | fldop0elollTQ3fnA | sync later |
| 2024 MP TCV ($) | number | fld6BOKL7CmXdmR2D | sync later |
| 2024 LARR ($) | number | fldjI3nMg5ich9DKL | sync later |
| 2025 MP TCV YTD ($) | number | fldM1iuzmDdLT3axX | sync later |
| 2025 LARR YTD ($) | number | fld1uD9SHVZvnU5wR | sync later |
| 2025 MP TCV Target ($) | number | fld5C6rHOzZVu6MXw | sync later |
| 2026 MP TCV Projected Annual | formula | fldQwP5RFGW3fhuAb | sync later (read-only) |
| 2026 LARR Projected Annual | formula | fldlw3f03ebKd5Jpf | sync later (read-only) |
| 2026 MP TCV YTD ($) | number | fldPjzGNolAHbLrlE | sync later |
| 2026 LARR YTD ($) | number | fld9I88K1ijili8Af | sync later |
| MPOPP Funding | linkedRecord → MPOPP Funding | fld1NCw566nVkuRZQ | sync later (with table) |
| MDF Spent | number | fldxFdsp3DiWrIeXa | sync later |
| MDF Funding 2026 | linkedRecord → MDF Funding | fldkU6G8mr0oRvlIE | sync later (with table) |
| MDF Total Allocated | rollup | fld5EmiUardg2DBjA | sync later (read-only) |
| MDF Remaining | formula | fldp57wu1hlHVZtJL | sync later (read-only) |
| Partner Plans 2026 | linkedRecord → Partner Plans | fldeeaBJPf3V3aJK3 | sync later (with table) |
| Partner Engagements | linkedRecord → Engagements | fldQYMSnTe8Y5HmxL | computed (reverse link) |

---

### PROGRAMS (Synced — AT-owned catalog, pulled into RR)

**Airtable Table:** `tblpnW8ibVmkWi5Dt` · **Sync constant:** `PF`

| Field | SB Type | AT Type | Owner | Sync | AT Field ID | UI |
|-------|---------|---------|-------|------|-------------|-----|
| id | uuid PK | — | RR | — | — | program detail |
| name | text NOT NULL | singleLineText | AT | ← AT | fldlJgX0tVWwA516E | program list, detail, classifier |
| type | text CHECK (8 options) | singleSelect (8 options) | AT | ← AT | fldCd7TnUOgxnWmNt | program list, detail, classifier |
| description | text | multilineText | AT | ← AT | fldHN5mCWH6lXmoY1 | program detail, classifier |
| requirements | text | multilineText | AT | ← AT | fldxxsFFMc649nZft | program detail, classifier |
| what_it_unlocks | text | multilineText | AT | ← AT | fld4870bblJTGbAgn | program detail |
| notes | text | multilineText | AT | ← AT | fldzsmhcQ0Z6Rnjhk | — |
| lifecycle_type | text NOT NULL CHECK (indefinite, recurring, expiring) | singleSelect (3 options) | AT | ← AT | fldo04XmU7rQhwOVT | program detail |
| lifecycle_duration | text | singleLineText | AT | ← AT | fldeExdR8irrzC5GV | program detail |
| airtable_record_id | text UNIQUE | — | RR | — | — | — |
| created_at | timestamptz | — | RR | — | — | — |
| updated_at | timestamptz | — | RR | — | — | — |

**AT fields NOT in Supabase:**

| AT Field | AT Type | AT Field ID | Plan |
|----------|---------|-------------|------|
| Partner Engagements | linkedRecord → Engagements | fldotD0TG22LiWMPF | computed (reverse link) — no action needed |

---

### EVENTS (Synced — AT-owned catalog, pulled into RR)

**Airtable Table:** `tblPDGUSqSvn8mflJ` · **Sync constant:** `EF`

| Field | SB Type | AT Type | Owner | Sync | AT Field ID | UI |
|-------|---------|---------|-------|------|-------------|-----|
| id | uuid PK | — | RR | — | — | event detail |
| name | text NOT NULL | multilineText | AT | ← AT | fld1hURggkL0DTHnC | event list, detail, classifier |
| type | text NOT NULL CHECK (8 options) | singleSelect (8 options) | AT | ← AT | fldpuxeQ5DRhMwizr | event list, detail |
| start_date | date | date (Event Date) | AT | ← AT | fld62hHfwpOJw7nyZ | event list, detail, classifier |
| end_date | date | date | AT | ← AT | fldTUy6jHj4KpR6SZ | event detail |
| location | text | multilineText | AT | ← AT | fldwjmRq0saFpFHao | event detail |
| host | text | singleLineText | AT | ← AT | fldaDlidcRmUCvxFK | event detail |
| description | text | multilineText | AT | ← AT | fldTMiRJ7mqMzGqXY | event detail, classifier |
| geo | text CHECK (NAMER, EMEA, APJ, LATAM, GCR) | singleSelect (5 options) | AT | ← AT | fld9idvQawFVNu5sa | event list, detail |
| sponsor_option | boolean | checkbox | AT | ← AT | fldyAVpfZbG1SaDJz | event detail |
| partner_day | boolean | checkbox | AT | ← AT | fldTWZbQSEruQYdLe | event detail |
| partner_day_date | date | date | AT | ← AT | fldo8mDJ5vvXK5bu7 | event detail |
| source | text NOT NULL CHECK (seed, email_extracted, user_created) | — | RR | — | — | — |
| verified | boolean | — | RR | — | — | — |
| airtable_record_id | text UNIQUE | — | RR | — | — | — |
| created_at | timestamptz | — | RR | — | — | — |
| updated_at | timestamptz | — | RR | — | — | — |

**AT fields NOT in Supabase:**

| AT Field | AT Type | AT Field ID | Plan |
|----------|---------|-------------|------|
| Partner Event Status | linkedRecord → Partner Events | fldzZHhJL93Z3U7yd | sync later (with Partner Events table) |
| Partner Engagements | linkedRecord → Engagements | fldJkZBe4oR3oezUH | computed (reverse link) — no action needed |

---

### RELATIONSHIPS (Synced — AT-owned catalog, pulled into RR)

**Airtable Table:** `tblqVBssFsUeAt9bj` · **Sync constant:** `RF`

*Table renamed from `aws_relationships` in migration 058. Columns `aws_org` → `org`, `aws_service` → `service` (Decision #173).*

| Field | SB Type | AT Type | Owner | Sync | AT Field ID | UI |
|-------|---------|---------|-------|------|-------------|-----|
| id | uuid PK | — | RR | — | — | relationship detail |
| name | text NOT NULL | singleLineText | AT | ← AT | fldeiFljVC5L61c3v | relationship list, detail |
| org | text | singleLineText | AT | ← AT | fldKSmvO7Lhr5v9Fy | relationship detail |
| service | text | singleLineText | AT | ← AT | fldiieBBkkAFYDOJC | relationship detail |
| relationship_type | text CHECK (4 options) | singleSelect (4 options) | AT | ← AT | fld2cjVCECNIPGw2d | relationship detail |
| org_type | text CHECK (internal, third_party) | — | RR | — | — | — |
| contacts | jsonb (RoleContact[]) | singleLineText + multilineText (Lead Contact, Team Contacts) | AT | ← AT | fldKELDdEYb8MsJCP, fld472yolP2ujyJ5w | relationship detail |
| notes | text | multilineText | AT | ← AT | fldOcbNUrtfxjqiW5 | — |
| airtable_record_id | text UNIQUE | — | RR | — | — | — |
| created_at | timestamptz | — | RR | — | — | — |
| updated_at | timestamptz | — | RR | — | — | — |

> **TRANSITIONAL**: `contacts` JSONB column is being replaced by `relationship_participants` join table (Decision #178). Will be dropped after contact registry UI rewire.

**AT fields NOT in Supabase:**

| AT Field | AT Type | AT Field ID | Plan |
|----------|---------|-------------|------|
| Partner Engagements | linkedRecord → Engagements | fldPU8tywD13QLWtV | computed (reverse link) — no action needed |
| Roadrunner ID | singleLineText | fldfZksUDfLbvVQMT | exists but not currently pushed |

---

## Ring 2: Activity (Roadrunner-owned)

The PDM's daily work. Fast-changing, RR-owned, pushed to Airtable. Engagement is the hub that organizes work streams; meetings are temporal events; notes and tasks are the outputs.

```mermaid
erDiagram
    PARTNERS ||--o{ ENGAGEMENTS : "has many"
    PARTNERS ||--o{ MEETINGS : "has many (CASCADE)"
    PARTNERS ||--o{ MEETING_NOTES : "has many (CASCADE)"
    PARTNERS ||--o{ TASKS : "has many (CASCADE)"
    PARTNERS ||--o{ PARTNER_CONTEXT : "has many (CASCADE)"
    ENGAGEMENTS ||--o{ MEETINGS : "has many"
    ENGAGEMENTS ||--o{ MESSAGES : "has many"
    ENGAGEMENTS ||--o{ MEETING_NOTES : "optional context (SET NULL)"
    MEETINGS ||--o| MEETING_NOTES : "1-to-1 (CASCADE)"
    MEETING_NOTES ||--o{ TASKS : "extracts (SET NULL)"
    MESSAGES ||--o| APPROVAL_QUEUE : "may queue"
    MESSAGES ||--o| MEETINGS : "ICS source"

    PARTNERS {
        uuid id PK
        text name
        text segment
    }
    ENGAGEMENTS {
        uuid id PK
        text name
        text status
        uuid partner_id FK
        text pillar
        text topic
        text goal
        text current_state
    }
    MEETINGS {
        uuid id PK
        text title
        uuid engagement_id FK
        uuid partner_id FK
        text status
        text meeting_type
        date meeting_date
    }
    MEETING_NOTES {
        uuid id PK
        uuid partner_id FK
        uuid meeting_id FK
        uuid engagement_id FK
        text note_type
        text status
    }
    TASKS {
        uuid id PK
        uuid partner_id FK
        uuid meeting_note_id FK
        text description
        text owner
        uuid owner_participant_id FK
        text origin
        text status
    }
    MESSAGES {
        uuid id PK
        uuid engagement_id FK
        text subject
        text content_type
    }
    APPROVAL_QUEUE {
        uuid id PK
        uuid message_id FK
        uuid engagement_id FK
        boolean resolved
    }
    PARTNER_CONTEXT {
        uuid id PK
        uuid partner_id FK
        text content
        text source
    }
```

---

### ENGAGEMENTS (Synced — RR-owned activity, pushed to AT)

**Airtable Table:** `tblTC491AUVcrKvq2` · **Sync constant:** `ENF`

| Field | SB Type | AT Type | Owner | Sync | AT Field ID | UI |
|-------|---------|---------|-------|------|-------------|-----|
| id | uuid PK | — | RR | → AT (as Roadrunner ID) | fldJJ8ZlwhePawiEl | engagement detail |
| name | text NOT NULL | singleLineText | RR | → AT | fldxq7bsx8PuRvodp | engagement list, detail, inbox |
| status | text NOT NULL CHECK (planned, active, blocked, completed, archived) | singleSelect (5 options) | RR | → AT | fldUAOu4GG1Wme5OJ | engagement list, detail |
| partner_id | uuid FK → partners | linkedRecord → Partners | RR | → AT (resolved to AT record) | fldkYNE9C0UcdnGCL | engagement list, detail |
| pillar | text CHECK (Co-Sell, Co-Market, Co-Build) | singleSelect (3 options) | RR | → AT | fldvxfxhOPDGr5jBA | engagement list, detail |
| topic | text | singleLineText | RR | → AT | fldDRMrtkVHOdDYVy | engagement detail |
| goal | text | multilineText | RR | → AT | fld1yU46baF052MHd | engagement detail |
| current_state | text | multilineText (merged into Notes) | RR | → AT | flduVQ9wp3XXVUiwo | engagement detail |
| program_id | uuid FK → programs | linkedRecord → Programs | RR | → AT (resolved to AT record) | fldZ4IqdSvuEXgp83 | engagement detail |
| closed_at | timestamptz | — | RR | — | — | — |
| airtable_record_id | text UNIQUE | — | RR | — | — | — |
| created_at | timestamptz | — | RR | — | — | — |
| updated_at | timestamptz | — | RR | — | — | — |

**AT fields computed from RR data (not stored in Supabase):**

| AT Field | AT Type | AT Field ID | Source |
|----------|---------|-------------|--------|
| AWS Stakeholders | multilineText | fldLVPbg7iyz0Nli9 | computed from engagement_participants (role=aws) |
| Partner Stakeholders | multilineText | fldj6vaWwDKJy6aci | computed from engagement_participants (role=partner) |
| Third Parties | multilineText | flduajBotnT6x5ZXD | computed from engagement_participants (role=third_party) |
| AWS Relationships | linkedRecord → Relationships | fldhVQTAP2wucnzNC | pushed from engagement_relationships junction |
| Event | linkedRecord → Events | fldscmkRoT65oa6Oy | pushed from entity_links (engagement→event) |
| Meetings | linkedRecord → Meetings | fldqM0QO5VWjhmvw3 | computed (reverse link from Meetings.Engagement) |

---

### MEETINGS (Synced — RR-owned activity, pushed to AT)

**Airtable Table:** `tbl6LsEqSvEZgqBdW` · **Sync constant:** `MF`

*`partner_id` FK behavior changed to CASCADE in migration 060.*

| Field | SB Type | AT Type | Owner | Sync | AT Field ID | UI |
|-------|---------|---------|-------|------|-------------|-----|
| id | uuid PK | — | RR | → AT (as Roadrunner ID) | fldLveS95zGGVU4j1 | meeting detail |
| title | text NOT NULL | singleLineText | RR | → AT | fldcbatIDunJ00dLp | meeting list, detail, timeline |
| engagement_id | uuid FK → engagements (SET NULL) | linkedRecord → Engagements | RR | → AT | fld2TczwxJXZLUwpW | meeting detail |
| partner_id | uuid FK → partners (CASCADE) | — (lookup through engagement) | RR | — | — | meeting list, detail |
| message_id | uuid FK → messages (SET NULL) | — | RR | — | — | — |
| status | text NOT NULL CHECK (scheduled, completed, cancelled, did_not_occur) | singleSelect (4 options) | RR | → AT | fldpXlLugkUgQsjcr | meeting list, detail |
| meeting_type | text CHECK (9 options) | singleSelect (9 options) | ↔ | → AT | fldGWa1MFoqoc89qC | meeting detail |
| meeting_date | date | date | RR | → AT | fldx9ZrIMundEMUko | meeting list, detail, timeline |
| start_time | text | singleLineText | RR | → AT | fldifWilEYICfifXz | meeting detail |
| end_time | text | singleLineText | RR | → AT | fldV78rQbzDhVK9NO | meeting detail |
| location | text | singleLineText | RR | → AT | fldTyiMYT48aCHttx | meeting detail |
| organizer_email | text | — | RR | — (internal) | — | — |
| organizer_name | text | — | RR | — (internal) | — | — |
| attendees | jsonb | — | RR | — (computed to stakeholder fields) | — | meeting detail |
| ics_uid | text UNIQUE | singleLineText | RR | → AT | fldNb83l5XLtz8J9k | — |
| sequence | integer | — | RR | — (internal) | — | — |
| is_recurring | boolean | — | RR | — (internal) | — | — |
| source | text CHECK (manual, ics_parsed) | singleSelect (2 options) | RR | → AT | fld2RW78vS1T91bab | — |
| notes | text | multilineText | RR | → AT | fldzGUipu36EA9rax | meeting detail |
| airtable_record_id | text UNIQUE | — | RR | — | — | — |
| created_at | timestamptz | — | RR | — | — | — |
| updated_at | timestamptz | — | RR | — | — | — |

**AT fields computed from RR data:**

| AT Field | AT Type | AT Field ID | Source |
|----------|---------|-------------|--------|
| AWS Stakeholders | multilineText | fldOVCmwhiisY8bDo | computed from attendees JSONB |
| Partner Stakeholders | multilineText | fldJira79g9xWNTte | computed from attendees JSONB |
| Third Parties | multilineText | fldhU8nE7uGE1agML | computed from attendees JSONB |
| Event (from Engagement) | lookup | fldAP7a1eRiunKFta | AT lookup through Engagement link |
| Program (from Engagement) | lookup | fldVsQxvytcpw0XmB | AT lookup through Engagement link |
| AWS Relationships (from Engagement) | lookup | fldBFEFAWK2SXghpo | AT lookup through Engagement link |
| Partner (from Engagement) | lookup | fldnhuK2el6fsBjVd | AT lookup through Engagement link |

### Attendee Bucketing Logic (used for AT stakeholder fields)

Both Engagements and Meetings push three computed text fields (AWS Stakeholders, Partner Stakeholders, Third Parties) to Airtable. The bucketing logic in `push.ts`:

**Excluded addresses** (filtered before bucketing):
- `*@relay.stevenromero.dev` — Roadrunner forwarding address
- `*salesforce*` — Salesforce system emails
- Any email matching `isUserEmail()` from `user-config.ts` (corpmail, PRVS, personal aliases)

**Bucket rules** (applied to remaining attendees):
- `@amazon.com` or org contains "AWS"/"Amazon" → **AWS Stakeholders**
- Org matches the engagement/meeting partner name → **Partner Stakeholders**
- Everyone else → **Third Parties**

Output format: one `Name <email> (Title)` per line (universal contact format).

---

### MEETING_NOTES (Roadrunner-only)

*FK cascade behaviors corrected in migration 060: `meeting_id` CASCADE, `partner_id` CASCADE, `engagement_id` SET NULL. `meeting_id` is now actively populated (Decision #148).*

| Field | SB Type | Owner | UI |
|-------|---------|-------|-----|
| id | uuid PK | RR | meeting detail (inline NoteWorkspace) |
| partner_id | uuid NOT NULL FK → partners (CASCADE) | RR | notes list, detail |
| meeting_id | uuid FK → meetings (CASCADE) | RR | notes detail |
| engagement_id | uuid FK → engagements (SET NULL) | RR | notes detail |
| note_type | text NOT NULL CHECK (meeting, seed) | RR | notes list |
| title | text | RR | notes list, detail |
| meeting_date | date | RR | notes list, detail |
| date_range_start | date | RR | notes detail (seed type) |
| date_range_end | date | RR | notes detail (seed type) |
| raw_notes | text NOT NULL | RR | notes detail (collapsible) |
| ai_summary | text | RR | notes detail |
| ai_tasks | jsonb | RR | — (superseded by tasks table) |
| context_snapshot | jsonb | RR | — (audit trail) |
| status | text NOT NULL CHECK (draft, complete) | RR | notes list, detail |
| created_at | timestamptz | RR | — |
| updated_at | timestamptz | RR | — |

---

### TASKS (Roadrunner-only)

*Renamed from `note_tasks` in migration 059. Promoted to partner-level entity. `owner_participant_id` FK added in migration 059. (Decisions #170-172, #174-175)*

| Field | SB Type | Owner | UI |
|-------|---------|-------|-----|
| id | uuid PK | RR | notes detail, partner detail, /tasks |
| meeting_note_id | uuid FK → meeting_notes (SET NULL) | RR | notes detail |
| partner_id | uuid NOT NULL FK → partners (CASCADE) | RR | partner detail, /tasks |
| description | text NOT NULL | RR | notes detail |
| owner | text NOT NULL CHECK (me, internal, partner, third_party) | RR | notes detail |
| owner_name | text | RR | notes detail |
| owner_participant_id | uuid FK → participants (SET NULL) | RR | — |
| status | text NOT NULL CHECK (open, done, cancelled) | RR | notes detail |
| due_date | date | RR | notes detail |
| origin | text NOT NULL CHECK (ai_extracted, manual) | RR | notes detail |
| created_at | timestamptz | RR | — |
| updated_at | timestamptz | RR | — |

---

### MESSAGES (Roadrunner-only)

| Field | SB Type | Owner | UI |
|-------|---------|-------|-----|
| id | uuid PK | RR | inbox, message detail |
| engagement_id | uuid FK → engagements (SET NULL) | RR | inbox, engagement timeline |
| sender_name | text | RR | inbox card |
| sender_email | text | RR | inbox card |
| sent_at | timestamptz | RR | inbox card |
| subject | text | RR | inbox card, engagement timeline |
| body_text | text | RR | message detail |
| body_raw | text | RR | — (debug) |
| content_type | text CHECK (engagement_email, meeting_invite, mixed, noise) | RR | inbox |
| classification_confidence | double precision | RR | inbox |
| classification_result | jsonb | RR | inbox, debug |
| linked_entities | jsonb | RR | — |
| forwarded_at | timestamptz NOT NULL | RR | inbox |
| pending_review | boolean NOT NULL | RR | inbox |
| forwarder_email | text | RR | inbox |
| forwarder_name | text | RR | inbox |
| forwarder_note | text | RR | inbox |
| to_header | text | RR | — |
| cc_header | text | RR | — |

---

### APPROVAL_QUEUE (Roadrunner-only)

| Field | SB Type | Owner | UI |
|-------|---------|-------|-----|
| id | uuid PK | RR | inbox |
| type | text NOT NULL CHECK (engagement_assignment) | RR | inbox |
| message_id | uuid FK → messages (SET NULL) | RR | inbox |
| engagement_id | uuid FK → engagements (SET NULL) | RR | inbox |
| classification_result | jsonb | RR | inbox |
| resolved | boolean NOT NULL DEFAULT false | RR | inbox |
| resolved_at | timestamptz | RR | — |
| resolution | text | RR | — |
| created_at | timestamptz | RR | — |

Partial index: `idx_approval_queue_unresolved WHERE resolved = false`

---

### PARTNER_CONTEXT (Roadrunner-only)

*New table added in migration 056. Scratchpad entries are wired into AI context pipeline as "PARTNER CONTEXT (PDM NOTES)" section. (Decisions #163-165)*

| Field | SB Type | Owner | UI |
|-------|---------|-------|-----|
| id | uuid PK | RR | partner detail (PartnerScratchpad) |
| partner_id | uuid NOT NULL FK → partners (CASCADE) | RR | partner detail |
| content | text NOT NULL | RR | partner detail |
| source | text NOT NULL CHECK (scratchpad, ai_synthesis, seed_dump) | RR | — |
| created_at | timestamptz | RR | — |
| updated_at | timestamptz | RR | — |

Indexes: `idx_partner_context_partner` (partner_id), `idx_partner_context_source` (partner_id, source)

---

## People & Connections (Cross-Cutting)

The participant registry is the single source of truth for every person in the system. 4 dedicated join tables connect people to entities with FK CASCADE enforcement. Entity links and engagement relationships connect Activity to Catalog at the engagement level.

```mermaid
erDiagram
    PARTICIPANTS ||--o{ PARTNER_PARTICIPANTS : "linked"
    PARTICIPANTS ||--o{ MEETING_PARTICIPANTS : "attended"
    PARTICIPANTS ||--o{ ENGAGEMENT_PARTICIPANTS : "involved"
    PARTICIPANTS ||--o{ RELATIONSHIP_PARTICIPANTS : "member"
    PARTNERS ||--o{ PARTNER_PARTICIPANTS : "team"
    MEETINGS ||--o{ MEETING_PARTICIPANTS : "attendees"
    ENGAGEMENTS ||--o{ ENGAGEMENT_PARTICIPANTS : "stakeholders"
    RELATIONSHIPS ||--o{ RELATIONSHIP_PARTICIPANTS : "contacts"
    ENGAGEMENTS ||--o{ ENTITY_LINKS : "source"
    PROGRAMS ||--o{ ENTITY_LINKS : "target"
    EVENTS ||--o{ ENTITY_LINKS : "target"
    ENGAGEMENTS ||--o{ ENGAGEMENT_RELATIONSHIPS : "junction"
    RELATIONSHIPS ||--o{ ENGAGEMENT_RELATIONSHIPS : "junction"

    PARTICIPANTS {
        uuid id PK
        text email UK
        text name
        text organization
        text title
        text org_type
        text source
    }
    PARTNER_PARTICIPANTS {
        uuid id PK
        uuid partner_id FK
        uuid participant_id FK
        text role
    }
    MEETING_PARTICIPANTS {
        uuid id PK
        uuid meeting_id FK
        uuid participant_id FK
        text role
    }
    ENGAGEMENT_PARTICIPANTS {
        uuid id PK
        uuid engagement_id FK
        uuid participant_id FK
        text role
    }
    RELATIONSHIP_PARTICIPANTS {
        uuid id PK
        uuid relationship_id FK
        uuid participant_id FK
        text role
    }
    ENTITY_LINKS {
        uuid id PK
        text source_type
        uuid source_id
        text target_type
        uuid target_id
        text created_by
    }
    ENGAGEMENT_RELATIONSHIPS {
        uuid engagement_id PK
        uuid relationship_id PK
    }
```

---

### PARTICIPANTS (Roadrunner-only — canonical person registry)

*`org_type`, `source`, and `updated_at` added in migration 057 (Decision #176).*

| Field | SB Type | Owner | UI |
|-------|---------|-------|-----|
| id | uuid PK | RR | — |
| email | text UNIQUE | RR | — |
| name | text | RR | — |
| organization | text | RR | — |
| title | text | RR | — |
| org_type | text CHECK (internal, partner, third_party) | RR | — |
| source | text CHECK (airtable_sync, ics_parsed, classifier, manual) | RR | — |
| notes | text | RR | — |
| created_at | timestamptz | RR | — |
| updated_at | timestamptz | RR | — |

---

### PARTNER_PARTICIPANTS (Roadrunner-only — contact registry join)

*New table added in migration 057 (Decision #176).*

| Field | SB Type | Owner | Notes |
|-------|---------|-------|-------|
| id | uuid PK | RR | — |
| partner_id | uuid NOT NULL FK → partners (CASCADE) | RR | — |
| participant_id | uuid NOT NULL FK → participants (CASCADE) | RR | — |
| role | text | RR | Alliance Lead, PSA, AM, PMM, Contact, etc. |
| created_at | timestamptz | RR | — |

UNIQUE constraint: `(partner_id, participant_id, role)`

---

### MEETING_PARTICIPANTS (Roadrunner-only — contact registry join)

*New table added in migration 057 (Decision #176).*

| Field | SB Type | Owner | Notes |
|-------|---------|-------|-------|
| id | uuid PK | RR | — |
| meeting_id | uuid NOT NULL FK → meetings (CASCADE) | RR | — |
| participant_id | uuid NOT NULL FK → participants (CASCADE) | RR | — |
| role | text | RR | — |
| created_at | timestamptz | RR | — |

UNIQUE constraint: `(meeting_id, participant_id)`

---

### ENGAGEMENT_PARTICIPANTS (Roadrunner-only — contact registry join)

*New table added in migration 057 (Decision #176).*

| Field | SB Type | Owner | Notes |
|-------|---------|-------|-------|
| id | uuid PK | RR | — |
| engagement_id | uuid NOT NULL FK → engagements (CASCADE) | RR | — |
| participant_id | uuid NOT NULL FK → participants (CASCADE) | RR | — |
| role | text | RR | — |
| created_at | timestamptz | RR | — |

UNIQUE constraint: `(engagement_id, participant_id)`

---

### RELATIONSHIP_PARTICIPANTS (Roadrunner-only — contact registry join)

*New table added in migration 057 (Decision #176).*

| Field | SB Type | Owner | Notes |
|-------|---------|-------|-------|
| id | uuid PK | RR | — |
| relationship_id | uuid NOT NULL FK → relationships (CASCADE) | RR | — |
| participant_id | uuid NOT NULL FK → participants (CASCADE) | RR | — |
| role | text | RR | Lead Contact, Team Contact |
| created_at | timestamptz | RR | — |

UNIQUE constraint: `(relationship_id, participant_id)`

---

### ENTITY_LINKS (Roadrunner-only — polymorphic junction)

| Field | SB Type | Owner | Notes |
|-------|---------|-------|-------|
| id | uuid PK | RR | — |
| source_type | text NOT NULL CHECK (engagement, event, program) | RR | — |
| source_id | uuid NOT NULL | RR | no FK constraint (polymorphic) |
| target_type | text NOT NULL CHECK (engagement, event, program) | RR | — |
| target_id | uuid NOT NULL | RR | no FK constraint (polymorphic) |
| relationship | text NOT NULL | RR | e.g., "relates_to", "part_of" |
| context | text | RR | — |
| created_by | text NOT NULL CHECK (ai, user) | RR | — |
| created_at | timestamptz | RR | — |

---

### ENGAGEMENT_RELATIONSHIPS (Roadrunner-only — junction)

*Renamed from `engagement_aws_relationships` in migration 058. Column `aws_relationship_id` → `relationship_id` (Decision #173).*

| Field | SB Type | Owner | Notes |
|-------|---------|-------|-------|
| engagement_id | uuid PK FK → engagements (CASCADE) | RR | composite PK |
| relationship_id | uuid PK FK → relationships (CASCADE) | RR | composite PK |

---

## Ring 3: Posture (Airtable-Only — Future Sync)

Where each partner stands — program achievements, event participation, revenue goals, and funding. AT-only today. These connect partners to catalog entities (Programs, Events) with per-partner status, unlike entity_links which connect engagements to catalog entities. When pulled into Roadrunner, these become the foundation for the slot registry and strategic AI context.

```mermaid
erDiagram
    PARTNERS ||--o{ PARTNER_PROGRAMS : "enrolled in"
    PROGRAMS ||--o{ PARTNER_PROGRAMS : "has enrollments"
    PARTNERS ||--o{ PARTNER_EVENTS : "attending"
    EVENTS ||--o{ PARTNER_EVENTS : "has registrations"
    PARTNERS ||--o| PARTNER_PLANS : "has plan"
    PARTNERS ||--o{ MPOPP_FUNDING : "receives"
    PARTNERS ||--o{ MDF_FUNDING : "receives"

    PARTNER_PROGRAMS {
        text program_id
        text partner
        text status
        date date_achieved
    }
    PARTNER_EVENTS {
        text partner
        text status
        text contacts_attending
    }
    PARTNER_PLANS {
        text plan_name
        text plan_status
        number tcv_goal
        number larr_goal
    }
    MPOPP_FUNDING {
        text partner FK
        text track
        currency allocated
        currency spent
    }
    MDF_FUNDING {
        text partners FK
        number allocated
        number utilized
        text source
    }
```

---

### PARTNER_PROGRAMS (Airtable-only — future: slot registry)

**Airtable Table:** `tbl1CPtbVzQvRN8LA`

| AT Field | AT Type | AT Field ID | Future RR Role |
|----------|---------|-------------|----------------|
| Program ID | multilineText | fldmaD6ZTY7XvXkjw | identifier |
| Partner | singleLineText | fldXXpf6zyDLLAKOz | FK → partners |
| Type | singleSelect (4 options: Competency, Service Ready, Program, Credit Program) | fldu4oNGIHu7h5et5 | type |
| Status | singleSelect (7 options: Not Started, In Progress, Submitted, Approved, Interested, Denied, Expired) | flddDihdNtRaLgYqn | status tracking |
| Date Achieved | date | fldJNF6KO3Osq2AWg | completion date |
| AWS Stakeholder | multilineText | fldi0bBVH4VHkjIM3 | contacts |
| Notes | multilineText | fldqpulJjUKcro1xM | notes |
| 2026 Partner Plans | linkedRecord → Partner Plans | fldI8TaeHhb8Hk1bI | plan linking |

---

### PARTNER_EVENTS (Airtable-only — future: event tracking)

**Airtable Table:** `tblYljQDnXwjTDy2T`

| AT Field | AT Type | AT Field ID | Future RR Role |
|----------|---------|-------------|----------------|
| Invitation Record | formula (Event - Partner) | fldvhMnIPETioD6FN | display name |
| Partner | singleLineText | fldFA6221VhsyXG1v | FK → partners |
| Events | linkedRecord → Events | fldIsEwvRqaszKMCh | FK → events |
| Event Date (from Events) | lookup | fld7C5aJOuhcE5rsb | computed |
| Status | singleSelect (4 options: Invited, Registered, Sponsoring, Confirming) | fldWjFeK3yyLo4N5U | status tracking |
| Partner Contacts Attending | multilineText | fldtQthUjkw0028us | contacts |
| Notes | multilineText | fldQHj66TZ81TSaMc | notes |
| Partner Plans 2026 | linkedRecord → Partner Plans | fldBsfehaCJfvME9m | plan linking |

---

### PARTNER_PLANS_2026 (Airtable-only — future: strategic context)

**Airtable Table:** `tbligbfCTvpCkG7tS`

| AT Field | AT Type | AT Field ID | Future RR Role |
|----------|---------|-------------|----------------|
| Plan Name | formula (Partner + "2026 Plan") | fld8WW26jMTipRwc2 | display name |
| Plan Status | singleSelect (4: Not Started, In Progress, Submitted, Complete) | fld1hwUnzk1tHLqdJ | status |
| Email Sent with Instructions | singleSelect (Yes/No) | fldr7TFQ8IPDan19z | checklist item |
| Plan Created in Salesforce | singleSelect (Yes/No) | fldeGvhBjNlQeBAcQ | checklist item |
| 2026 MP TCV Goal ($) | number | fldJwFIRzYit9MsQe | target |
| 2026 LARR Goal ($) | number | fldAS4Qa8F39qc7La | target |
| Target Programs | linkedRecord → Partner Programs | fld9UUmULOrgJxdc8 | program goals |
| Target Event Registrations | linkedRecord → Partner Events | fld3hGKaEN7HXpPlx | event goals |
| Misc Goals | multilineText | fldh0gI8cShpNfFhV | freeform goals |
| 2026 MP TCV Target Attainment % | formula | flddScDP9XH3Gb4aX | computed metric |
| 2026 MP TCV YTD ($) | lookup from Partners | fldGyj4UM6YHFDKt3 | computed metric |
| 2026 LARR YTD ($) | lookup from Partners | fld2dmmMrFbd02pJl | computed metric |
| Performance Trend | formula (Strong Growth/On Track/At Risk/Critical) | fldi2JZ8YmwTGln5C | computed status |
| Notes | multilineText | fld9z7ghsIKLeOZ1c | notes |
| Partner Link | linkedRecord → Partners | fldqMc1SjdklIRzFX | FK → partners |
| Months Elapsed 2026 | formula | fldSqwJsKwAAvmA3o | helper |
| Expected Progress % | formula | fldABf0iLPAu3JFZc | computed metric |

---

### MPOPP_FUNDING_2026 (Airtable-only — future: financial context)

**Airtable Table:** `tbl2ilHOaXYsgxqFY`

| AT Field | AT Type | AT Field ID | Future RR Role |
|----------|---------|-------------|----------------|
| Funding Name | formula (Partner + Track) | fldiNSPR6lOc2qn3M | display name |
| Partner | linkedRecord → Partners | fldc3HBSHS2Di8XLd | FK → partners |
| Status | singleSelect (5: Applied, Approved, Rejected, Disbursed, NEEDS ACTION) | fldoNQTpGZMd5Sfkx | status |
| Half | singleSelect (H1, H2) | fld2TO49NsfmAwuZ2 | period |
| Track | singleSelect (Activate, Grow) | fldIbH2P4N7L3abAB | track type |
| Allocated Amount | currency | fldTTVjneQKD2yrX0 | amount |
| Spent Amount | currency | fldll9GvapXWdsYvs | amount |
| Remaining | formula | fldYO4ycGgcnaOGVW | computed |
| Notes | multilineText | fldMo9eIV9KEGRdkE | notes |

---

### MDF_FUNDING_2026 (Airtable-only — future: financial context)

**Airtable Table:** `tblRSsochM23QGQpS`

| AT Field | AT Type | AT Field ID | Future RR Role |
|----------|---------|-------------|----------------|
| MDF Record Name | singleLineText | fldz2AadUnmO0Ynoa | display name |
| Partners | linkedRecord → Partners | fld1L71zH44Z4Wrbx | FK → partners |
| Amount Allocated | number | fldISPaiE4oJkekwb | amount |
| Amount Utilized | number | fldaF5qh9pcdDuS9g | amount |
| Date Allocated | date | flddUPAjoPAI3dENU | date |
| Notes | multilineText | fldmypPKmpusuNOwA | notes |
| Source | singleSelect (Competency/Service Ready, Custom) | fld8Itb42n6GqCXRE | source type |
| Recurrence | singleSelect (One-Time, Reloads Next Year) | fldpxpkBoOGoLfcAa | recurrence |

---

## Legacy (Pending Removal)

### PARTICIPANT_LINKS (LEGACY — DROPPED)

**DROPPED** in migration 062. All code rewired to use engagement_participants (Chunks A+B, 2026-03-14). Table no longer exists. Was a polymorphic junction table (`participant_id`, `entity_type`, `entity_id`, `role`) replaced by 4 dedicated join tables (Decisions #169, #180).

| Field | SB Type | Owner | Notes |
|-------|---------|-------|-------|
| id | uuid PK | RR | — |
| participant_id | uuid NOT NULL FK → participants | RR | — |
| entity_type | text NOT NULL CHECK (engagement, event) | RR | — |
| entity_id | uuid NOT NULL | RR | no FK constraint (polymorphic) |
| role | text | RR | e.g., "aws", "partner", "third_party" |
| created_at | timestamptz | RR | — |

UNIQUE index on `(participant_id, entity_type, entity_id)`

> **Note:** The `notes` table was dropped in migration 061 (Decision #179). All note functionality flows through `meeting_notes`.

---

## CASCADE Behavior

| Source Table | FK Column | Target Table | On Delete | Rationale |
|---|---|---|---|---|
| engagements | partner_id | partners | SET NULL | Engagement survives partner cleanup |
| engagements | program_id | programs | SET NULL | Engagement survives program cleanup |
| meetings | partner_id | partners | CASCADE | Partner is gravity |
| meetings | engagement_id | engagements | SET NULL | Meeting survives engagement close |
| meetings | message_id | messages | SET NULL | Meeting survives message cleanup |
| meeting_notes | meeting_id | meetings | CASCADE | Notes die with meeting |
| meeting_notes | partner_id | partners | CASCADE | Partner is gravity |
| meeting_notes | engagement_id | engagements | SET NULL | Notes survive engagement close |
| tasks | partner_id | partners | CASCADE | Partner is gravity |
| tasks | meeting_note_id | meeting_notes | SET NULL | Tasks survive note deletion |
| tasks | owner_participant_id | participants | SET NULL | Tasks survive contact cleanup |
| messages | engagement_id | engagements | SET NULL | Messages survive engagement close |
| partner_context | partner_id | partners | CASCADE | Context dies with partner |
| approval_queue | message_id | messages | SET NULL | Queue survives message cleanup |
| approval_queue | engagement_id | engagements | SET NULL | Queue survives engagement close |
| partner_participants | partner_id | partners | CASCADE | Both sides cascade |
| partner_participants | participant_id | participants | CASCADE | Both sides cascade |
| meeting_participants | meeting_id | meetings | CASCADE | Both sides cascade |
| meeting_participants | participant_id | participants | CASCADE | Both sides cascade |
| engagement_participants | engagement_id | engagements | CASCADE | Both sides cascade |
| engagement_participants | participant_id | participants | CASCADE | Both sides cascade |
| relationship_participants | relationship_id | relationships | CASCADE | Both sides cascade |
| relationship_participants | participant_id | participants | CASCADE | Both sides cascade |
| engagement_relationships | engagement_id | engagements | CASCADE | Both sides cascade |
| engagement_relationships | relationship_id | relationships | CASCADE | Both sides cascade |
| entity_links | (polymorphic) | (no FK) | N/A | App-level cleanup required |

---

## What's Next

| Connection | Status | Priority |
|---|---|---|
| Contact registry UI rewire (JSONB → join tables) | Open — all 4 write paths complete, 17 JSONB read locations across 10 files remain | Next |
| participant_links drop | **Done** — migration 062 | ✅ |
| JSONB column drops (aws_team, partner_contacts, contacts) | Blocked by UI rewire | Next |
| Manual meeting quick-capture | Open | Next |
| Brain synthesis (AI Call 3) | partner_context table ready | Soon |
| Seed notes → scratchpad migration | Open | Soon |
| Classifier partner-level routing | Open | Soon |
| Ring 3 pull sync (Partner Programs, Events, Plans, Funding) | Not started | Later |
| Slot registry v1 | Not started | Later |
| Financial fields on partners table | Not started | Later |
| ~~Tasks on partner detail~~ | ~~Query by partner_id~~ | **Done** |
| ~~Open tasks in writing sidebar~~ | ~~Query by partner_id, status=open~~ | **Done** |
| ~~Cross-partner task dashboard~~ | ~~New /tasks page~~ | **Done** |
| ~~Meeting → Note auto-linking~~ | ~~meeting_id FK populated (Decision #148)~~ | **Done** |
