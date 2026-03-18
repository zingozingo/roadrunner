# Entity Catalog

Layout specs and field mappings for all 7 entity types in Roadrunner.

---

## Entity Overview

| Entity | List Layout | Detail Layout | Groups By |
|---|---|---|---|
| Partners | Flat rows in `<details>` | Two-column (3fr / 2fr) | segment |
| Engagements | Flat rows in `<details>` | Two-column (3fr / 2fr) | status |
| Meetings | Flat rows in `<details>` | Two-column (3fr / 2fr) | time (Upcoming/Past/TBD) |
| Programs | Flat rows in `<details>` | Single-column | type (8 categories) |
| Events | Flat rows in `<details>` | Single-column | time → month |
| Relationships | Flat rows in `<details>` | Single-column | relationship_type |
| Tasks | Flat rows (no `<details>`) | N/A (links to note/partner) | partner |

---

## Partners

**List page:** `PartnersClient.tsx` — flat rows grouped by segment
**Detail page:** `partners/[id]/page.tsx` — two-column

### Identity Bar
- Title: `partner.name`
- Badges: Segment pill, SPMS ID pill
- Actions: (none currently)

### Two-Column Layout

**Left column** (workflow):
1. PartnerScratchpad (`compact`)
2. Engagements — clickable entity rows (PillarBadge + status dot)
3. Open Tasks — flat rows (due date + owner pill)
4. Recent Meetings — flat rows (date + title + note status dot)

**Right column** (reference):
1. What They Do — prose text
2. AWS Stickiness — accent label + service pills
3. Profile — 2-column grid (architecture, listing, pricing, SPMS ID)
4. Contacts — grouped by org_type (Partner Team / AWS Team), name + email
5. Relationships — linked relationship rows

---

## Engagements

**List page:** `EngagementsClient.tsx` — flat rows grouped by status
**Detail page:** `engagements/[id]/page.tsx` — two-column

### List Row
Name (flex-1) + partner name + PillarBadge + status dot

### Identity Bar
- Title: `engagement.name`
- Badges: Status dot (8px)
- Actions: EngagementActions

### Two-Column Layout

**Left column** (workflow):
1. Goal callout — `border-l-2 border-accent/40 pl-4`, italic
2. Current State — section label + prose paragraphs
3. Connections — relationship links + EntityLinkChips
4. Timeline — collapsible `<details>` wrapping `CollapsibleEmails compact`

**Right column** (reference):
1. Partner — accent-colored link
2. Details — PillarBadge, topic, status (dot + text), updated date
3. Participants — count + org breakdown + `CollapsibleParticipants compact`

---

## Meetings

**List page:** `MeetingsClient.tsx` — flat rows grouped by time section
**Detail page:** `meetings/[id]/page.tsx` — two-column

### List Row
Date (w-16) + time (w-32) + title (flex-1) + partner name + note status dot

### Identity Bar
- Title: `cleanMeetingTitle(meeting.title)`
- Badges: Status dot (8px), ICS pill (if source=ics_parsed, `bg-muted/15`)
- Actions: MeetingActions

### Two-Column Layout

**Left column** (workspace):
1. Location — URL: accent link with icon ("Join Meeting" / "Join Zoom Meeting"). Physical: label + text. No card.
2. Calendar Notes — section label + prose (if ICS notes exist)
3. MeetingNotesSection — client bridge, manages own state

**Right column** (context):
1. Partner — accent link or "—"
2. Details — Date (weekday), Time, Engagement (linked), Type, Source
3. Attendees — grouped by org (AWS / Partner / Other), sub-labels, compact name + email list
4. Footer — organizer email + created date

---

## Programs

**List page:** `ProgramsClient.tsx` — flat rows grouped by type
**Detail page:** `programs/[id]/page.tsx` — single-column

### List Row
Name (flex-1) + linked count

### Identity Bar
- Title: `program.name`
- Badges: ProgramTypeBadge
- Actions: ProgramActions

### Single-Column Sections
1. Description — prose
2. Requirements — prose
3. What It Unlocks — prose
4. Lifecycle — type + duration as label/value pairs
5. Linked Engagements — clickable entity rows (PillarBadge + status dot)
6. Footer — created date

---

## Events

**List page:** `EventsClient.tsx` — flat rows grouped by time section → month
**Detail page:** `events/[id]/page.tsx` — single-column

### List Row
Date range (w-24, `formatCompactDateRange`) + name (flex-1) + city (`extractCity`)

### Identity Bar
- Title: `event.name`
- Badges: EventTypeBadge, GEO pill (`bg-muted/15`)
- Actions: EventActions

### Single-Column Sections
1. Description — prose
2. Details — dates, location, host as label/value pairs
3. Linked Entities — EntityLinkChips (non-engagement links)
4. Linked Engagements — clickable entity rows (PillarBadge + status dot)
5. Footer — created date, source, verified status

---

## Relationships

**List page:** `RelationshipsClient.tsx` — flat rows grouped by relationship_type
**Detail page:** `relationships/[id]/page.tsx` — single-column

### List Row
Name (flex-1) + org + service

### Identity Bar
- Title: `relationship.name`
- Badges: RelationshipTypeBadge
- Actions: RelationshipActions

### Single-Column Sections
1. Notes — prose
2. Contacts — name + role + email (second line)
3. Linked Engagements — clickable entity rows (PillarBadge + status dot)
4. Details — AWS Org, AWS Service as label/value pairs
5. Footer — created date

---

## Tasks

**List page:** `TasksClient.tsx` — flat rows grouped by partner (no `<details>`)
**Detail page:** N/A (links to meeting note or partner)

### List Row
Description (flex-1) + due date (w-16) + owner pill (Me/Partner/3rd Party/Internal)

### Group Header
Partner name as `text-xs font-medium uppercase tracking-[0.08em] text-muted/70` + count

### Notes
- "+ Add Task" button opens modal (not affected by dashboard restyling)
- Tasks link to `/notes/{meeting_note_id}` if from a note, else `/partners/{partner_id}`
- Owner pill colors: Me=accent, Partner=emerald, 3rd Party=purple, Internal=amber

---

## Inbox

**Page:** `inbox/page.tsx` + `InboxClient.tsx`
**Layout:** Single-column, section label "Unrouted Messages" with grouped count

- Section header: `text-xs font-semibold uppercase tracking-wider text-muted`
- Count: grouped count (forwarded_at window groups, not raw messages) `text-muted/50`
- Messages grouped by `forwarded_at` (5-second window, `INBOX_GROUP_WINDOW_MS`) — displayed as single rows with count badge when >1
- Group primary selection: prefers messages with sender_name or sender_email populated (makeGroup helper)
- Sender subtitle: conditionally rendered only when sender info exists — no "Unknown" fallback
- Flat rows: `border-b border-border/20`, `hover:bg-surface/50`
- Partner pills: `bg-accent/10 text-accent` for known partners
- Unknown partner flow (two-step): "Pick Partner" button (`bg-amber-500/10 text-amber-400`) → filterable dropdown (lazy-loaded, cached in useRef) → partner stamped via POST `/api/inbox/set-partner` → Assign/New buttons unlock
- Assign and New buttons hidden when partner_id is null — only Discard available until partner picked
- Assign panel: fetches partner's engagements, clickable entity rows to pick target
- Create panel: pre-filled title (`"{Partner} - {cleaned subject}"`), underline input
- EmptyState when inbox is empty
- ReviewCard and ConfidenceBar deleted — no longer used
