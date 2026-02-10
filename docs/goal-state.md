# Relay — Goal State Specification

**Project Codename:** Roadrunner
**Owner:** Steven
**Version:** v0.2 target architecture
**Last Updated:** 2026-02-10

---

## 1. System Overview

Relay is a personal initiative tracker for an AWS Partner Development Manager. Forward an email to `inbox@relay.stevenromero.dev` and the system parses, classifies, and organizes it into an engagement — a tracked workstream with a specific partner toward a specific goal. Claude handles classification, summarization, and participant extraction. Programs and events are human-curated reference data that Claude matches against but never creates. The dashboard provides full CRUD, tag-based filtering, and an inbox for low-confidence classification review.

---

## 2. Entity Model

### Engagements (formerly Initiatives)

The primary unit of work. AI-created and managed. One partner, one goal, one email thread. Engagements are the only entity type Claude can create.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | AI-suggested on creation, user-editable |
| partner_name | text | Primary partner involved |
| status | text | `active` / `paused` / `closed` |
| current_state | text | 3-5 sentence executive briefing, updated on each new email |
| open_items | jsonb | `[{description, assignee, due_date, resolved}]` |
| tags | jsonb | String array. Freeform labels. Claude suggests, users edit. |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via trigger |
| closed_at | timestamptz | Nullable, set when status changes to `closed` |

Engagements have a lifecycle: `active` → `paused` or `closed`. Closed engagements are archived — searchable but not shown in active views or matched against new emails.

### Programs (seed-only)

Pre-seeded AWS programs and frameworks. Reference data that Claude matches against by ID. No AI creation. No user creation UI. Admin seed only.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | "AWS ISV Accelerate", "Security Competency" |
| description | text | What the program is, eligibility criteria narrative |
| eligibility | text | Nullable, structured eligibility notes |
| url | text | Nullable, link to program page |
| status | text | `active` / `archived` |
| renewal_cycle | text | Nullable. e.g. "6 months" for M-POP, "annual" for competencies |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Programs are relatively stable — ~15-20 records, rarely change. They represent named workstreams, certifications, go-to-market motions, or frameworks a partner can engage with.

### Events (seed-only)

Pre-seeded AWS events and milestones. Reference data that Claude matches against by ID. No AI creation. No user creation UI. Admin seed only.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | "AWS re:Invent 2026", "RSA Conference 2026" |
| type | text | `conference` / `summit` / `workshop` / `kickoff` / `trade_show` / `deadline` / `review_cycle` / `training` |
| start_date | date | Nullable if unknown |
| end_date | date | Nullable |
| date_precision | text | `exact` / `week` / `month` / `quarter` |
| location | text | Nullable |
| description | text | |
| source | text | Always `seed` for admin-created records |
| verified | boolean | Always `true` for seeds |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Events are shared calendar anchors — ~10-15 per year, updated annually. Conferences, summits, deadlines, review cycles. Not meetings, calls, or initiative-specific activities.

### Tags

Not a table. A JSONB string array on the engagements table. Freeform labels that cover anything that doesn't fit the entity model: campaigns ("FinServ Q2"), partner events ("Wiz Innovation Summit"), strategic labels ("exec-sponsored"), workflow states ("waiting-on-legal"), segments ("public-sector").

Claude suggests tags during classification. Users can add, remove, or edit tags freely. Tags are filterable in the engagement list view.

---

## 3. Entity Relationships

### entity_links

Connects engagements to programs and engagements to events. Bidirectional query support.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| source_type | text | `engagement` / `event` / `program` |
| source_id | uuid | |
| target_type | text | `engagement` / `event` / `program` |
| target_id | uuid | |
| relationship | text | `deadline`, `target`, `opportunity`, `qualifies_for`, `preparation_for`, `blocked_by`, `related` |
| context | text | Why this link exists |
| created_by | text | `ai` / `user` |
| created_at | timestamptz | |

Rules:
- Claude suggests links by referencing known entity IDs from the context it receives.
- No event↔program links. Programs and events don't relate to each other directly.
- Entity links are always engagement↔program or engagement↔event.
- Links are idempotent — dedup by source+target+relationship before insert.

### participant_links

Connects participants to engagements. Participants are people, shared across engagements.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| participant_id | uuid FK→participants | |
| entity_type | text | `engagement` |
| entity_id | uuid | |
| role | text | Nullable |
| created_at | timestamptz | |

UNIQUE INDEX on `(participant_id, entity_type, entity_id)`.

### participants

| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| email | text UNIQUE | Nullable — name-only participants allowed |
| name | text | |
| organization | text | Nullable |
| title | text | Nullable |
| notes | text | Nullable |
| created_at | timestamptz | |

Editing a participant is global — changes appear everywhere that participant is linked. Removing from an engagement deletes the participant_link only.

---

## 4. Classification Pipeline

### Flow

```
Email → Mailgun webhook → /api/inbound
  │
  ├─ Parse forwarded thread → Message[]
  ├─ Dedup check (sender + subject + first 100 chars)
  ├─ Store messages in DB (unclassified)
  │
  ▼
Claude API (single call)
  │
  ├─ Context sent: all active engagements (with current_state),
  │                all programs (with IDs + descriptions),
  │                all events (with IDs + dates),
  │                the email content
  │
  ├─ Claude returns:
  │   - engagement_match: { id | null, name, confidence, is_new, partner_name }
  │   - matched_program_ids: string[]     ← IDs only, no creation
  │   - matched_event_ids: string[]       ← IDs only, no creation
  │   - entity_links: [{ source, target, relationship, context }]
  │   - participants: [{ name, email, org, role }]
  │   - current_state: string | null
  │   - open_items: [{ description, assignee, due_date }]
  │   - suggested_tags: string[]
  │
  ▼
Routing
  │
  ├─ Noise → skip, no entities extracted
  ├─ High confidence (≥0.85) + existing → auto-assign
  ├─ High confidence (≥0.85) + new → auto-create engagement
  ├─ Low confidence (<0.85) → create approval, send SMS notification
  │
  ▼
Persistence (single shared function)
  │
  ├─ Create or update engagement
  ├─ Update messages with classification result
  ├─ Create entity links (engagement↔program, engagement↔event)
  ├─ Upsert participants and participant_links
  └─ Merge open_items, update tags
```

### Key rules

- Claude NEVER sets `is_new: true` for events or programs. Only engagements can be new.
- Programs and events are matched by ID. Claude receives all IDs in the context and returns matched IDs directly.
- No name-based fuzzy resolution for programs or events. If Claude doesn't recognize a program/event from the context, it doesn't reference it.
- Entity links use IDs from Claude's response. No post-hoc name→ID mapping in application code.
- One persistence function handles all DB writes for both auto-assign and manual resolve paths.

---

## 5. What Was Removed (and Why)

### Event creation pathway
**v0.1 behavior:** Claude could set `is_new: true` on events_referenced. The classifier created `event_creation` approval queue entries. Users approved/denied via dashboard. Approved events were created via `findOrCreateEvent()`.

**Why removed:** Fabrication risk — Claude invented events from vague email language ("New York Summit 2026" from a passing mention). Duplicate events from fuzzy name matching failures. Complex approval flow for low-value entity creation. Events are a small, stable set (~10-15/year) better managed by a human.

### Program creation from classifier
**v0.1 behavior:** Claude could suggest new programs. `findOrCreateProgram()` auto-created them with case-insensitive dedup. No approval required.

**Why removed:** Duplication risk from fuzzy matching ("ISV Accelerate" vs "AWS ISV Accelerate Program"). Programs are curated reference data (~15-20 total), not something AI should create from email context. Admin seeding is more reliable.

### Event approval queue type
**v0.1 behavior:** `approval_queue` had `type: 'event_creation'` for pending event approvals, with `entity_data` JSONB containing the event suggestion.

**Why removed:** Unnecessary when events are seed-only. The approval queue simplifies to a single type: `initiative_assignment` (renamed to `engagement_assignment`).

### timeline_entries
**Removed in session 5.** Claude fabricated specific dates from vague email language. The JSONB column was added in migration 008, never reliably populated, dropped in migration 009.

### Dual summary/current_state write
**v0.1 behavior:** Both `summary` and `current_state` were written with the same value on every classification. `summary` was the legacy field, `current_state` was the structured replacement.

**Why removed:** Maintaining two fields with identical content is pointless. `current_state` is the source of truth. `summary` is dropped or kept as a read-only alias during migration.

---

## 6. Admin Seeding

Programs and events enter the system through admin-only interfaces. No AI creation. No user-facing creation forms on the main dashboard pages.

### Admin page
- Dashboard sidebar link: "Admin"
- Two sections: Programs and Events
- Each shows a table with inline editing
- Add/edit/archive (programs) or add/edit/delete (events)
- No bulk operations needed in the UI — small datasets

### Bulk import endpoint
- `POST /api/admin/seed/programs` — accepts JSON array of program records
- `POST /api/admin/seed/events` — accepts JSON array of event records
- Used for initial data load and annual refresh
- Upserts by name (case-insensitive) to avoid duplicates

### Data volumes
- Programs: ~15-20 records. Rarely changes. Examples: ISV Accelerate, Security Competency, Marketplace Co-Sell, M-POP.
- Events: ~10-15 per year. Updated annually before each calendar year, with mid-year additions as events are announced. Examples: re:Invent, re:Inforce, RSA Conference, partner summits.

---

## 7. UI Structure

### Sidebar navigation
- **Dashboard** — Summary cards: pending reviews, active engagements, upcoming events
- **Inbox** — Approval queue for low-confidence engagement assignments only (no event approvals)
- **Engagements** — List with tag filters, status groups, search
- **Programs** — Read-only list showing linked engagements
- **Events** — Read-only list showing linked engagements, dates, locations
- **Admin** — Seed management for programs and events (separate from main views)

### Engagements list page
- Grouped by status: active, paused, closed
- Tag filter chips at top — click to filter by tag
- Each card shows: name, partner, status badge, tag pills, last updated
- Links to detail page

### Engagement detail page
- Header: name, partner, status badge, tags (editable)
- Current state card (3-5 sentence briefing)
- Open items card (with resolve/edit actions)
- Linked entities: program and event chips
- Participants list (with edit/unlink)
- Email thread (collapsible)
- Metadata sidebar: created, updated, closed dates

### Programs page (read-only)
- List of all programs with status, description, linked engagement count
- Click through to see which engagements are linked
- No create/edit buttons — admin only

### Events page (read-only)
- List of all events with type, dates, location, linked engagement count
- Click through to see which engagements are linked
- No create/edit buttons — admin only

### Admin page
- Programs table: name, description, eligibility, url, renewal_cycle, status. Inline edit. Add new.
- Events table: name, type, dates, location, description. Inline edit. Add new.
- Bulk import buttons (upload JSON)

### Inbox page
- Single approval type: engagement assignment
- Each card shows: email preview, confidence bar, AI suggestion, options
- Actions: select option, create new engagement, skip
- No event approval cards

---

## 8. Migration Path

High-level steps from v0.1 to goal state. Not ordered — dependencies exist between some steps.

### Database
- Rename `initiatives` table → `engagements` (or add view/alias)
- Add `tags jsonb DEFAULT '[]'` column to engagements
- Add `renewal_cycle text` column to programs
- Add `updated_at timestamptz` column to programs and events (if missing)
- Drop `summary` column from engagements (or keep as computed alias for `current_state`)
- Update `entity_links` check constraints: `initiative` → `engagement` in source_type/target_type
- Update `participant_links` check constraints: `initiative` → `engagement` in entity_type
- Update `approval_queue`: remove `event_creation` type support, rename references
- Clean up any orphaned `event_creation` approval records

### Classifier
- Remove event creation logic from `applyClassificationResult()`
- Remove program creation logic from `applyClassificationResult()`
- Remove `createEntityLinks()` name-based resolution — replace with ID-based linking
- Extract shared persistence function used by both auto-assign and resolve paths
- Update routing logic: no `hasNewTrackSuggestions` check (programs can't be new)

### Prompt
- Remove event creation instructions and `is_new` field for events
- Remove program creation instructions and `is_new` field for programs
- Change events/programs to return matched IDs only (arrays of strings)
- Add `suggested_tags` to response format
- Rename "initiative" → "engagement" throughout
- Simplify entity_links to use IDs directly instead of names

### Resolve route
- Remove `handleEventApproval()` function
- Remove `event_creation` branch
- Use shared persistence function instead of `persistClassificationEntities()`
- Rename initiative references → engagement

### UI
- Rename "Initiatives" → "Engagements" in sidebar, page titles, URLs
- Add tag display and editing to engagement cards and detail page
- Add tag filter to engagements list page
- Simplify programs page to read-only (remove any edit buttons)
- Simplify events page to read-only (remove any edit buttons)
- Add Admin page with program and event management
- Remove EventApprovalCard component
- Update InboxClient to handle single approval type only
- Update Sidebar navigation

### API routes
- Rename `/api/initiatives/` → `/api/engagements/` (keep redirect from old path)
- Add `/api/admin/seed/programs` and `/api/admin/seed/events`
- Remove event creation from `/api/reviews/resolve`
- Audit and remove unused routes (debug-inbound, digest stub)

---

## 9. Principles

1. **AI creates engagements only.** Programs and events are human-curated reference data. Claude matches to them but never creates them.

2. **Empty fields are better than fabricated fields.** If Claude doesn't know a date, leave it null. If there's no clear action item, return an empty array. Never invent data to fill a slot.

3. **One persistence path, not two.** A single shared function handles all DB writes after classification — whether the email was auto-assigned or manually resolved. Same code, same behavior, same bugs (or lack thereof).

4. **Tags are the escape valve.** Anything that doesn't fit the entity model — campaigns, partner events, strategic labels, workflow states — becomes a tag. Tags are cheap, freeform, and filterable.

5. **Ground truth sources only.** Email text, admin input, and calendar data (.ics, future) are the only valid sources. No synthesized dates, no inferred meetings, no fabricated events.

6. **Claude matches by ID.** Programs and events have stable UUIDs. Claude receives them in context and returns matched IDs. No name-based fuzzy resolution in application code. If Claude can't match, it doesn't reference.

7. **Connect, don't create.** The AI is biased toward linking new information to existing entities rather than spawning new ones. This applies doubly to programs and events, which it cannot create at all.

8. **Editable everything.** Users can rename engagements, reassign messages, correct participants, edit tags, close items, override any AI decision. The AI proposes, the user disposes.
