# Entity Catalog

Layout specs and field mappings for all entity types in Roadrunner. Implements the page specifications from SKILL.md.

---

## Entity Overview

| Entity | List Layout | Detail Layout | Default Grouping | Default Filter |
|---|---|---|---|---|
| Partners | Single-column, grouped rows | Two-column (3fr / 2fr) | segment | search |
| Engagements | Single-column, grouped rows | Two-column (3fr / 2fr) | partner | status |
| Meetings | Single-column, grouped rows | Two-column (3fr / 2fr) | time (Upcoming/Past) | meeting_type |
| Programs | Single-column, flat rows | Single-column | none (flat) | type |
| Events | Single-column, grouped rows | Single-column | time → month | type |
| Tasks | Single-column, flat rows | N/A (inline edit) | none (flat, optional partner toggle) | owner (default: Me) |
| Inbox | Single-column, flat rows | N/A (inline actions) | none | none |

---

## Partners

### List Page (`PartnersClient.tsx`)

Flat rows grouped by segment. Groups default open.

**Row:** Partner name (linked, flex-1) + segment badge + engagement count (plain text) + meeting count (plain text)

### Detail Page (`partners/[id]/page.tsx`)

**Job:** Everything about one partner — the portal you explore. Core content fits on one screen.

**Layout:** Full-width + slide-over panels. No permanent right column.

**Identity Bar:**
- Title: `partner.name` (`text-2xl`)
- SPMS ID inline after name (`text-sm text-muted`)
- Badges: Segment pill
- Right-aligned: Reference tabs: "Profile" | "Status" | "People"

**Main Content (full-width, above-the-fold target):**

| Section | Content | Progressive Disclosure |
|---|---|---|
| Brain Highlight | "What Needs Attention" prominent (amber accent). Other 3 brain sections as accordion. "Re-synthesize" + timestamp. | Attention always visible. Others collapsed. |
| Scratchpad | Notepad container (`bg-surface/50 rounded-lg p-4 border border-border/20`). Input at bottom. Hover-delete entries. | First 3, "Show all N" if more |
| Open Tasks | Flat rows: description + owner badge. "Me" in foreground, others muted. **Above engagements — most actionable.** | Top 5, "View all tasks →" |
| Engagements | Rows: name (linked) + pillar badge. Condensed one-liner below. Smart status (dots only for non-active). | 7 or fewer: all. 8+: first 5 + expander |
| Recent Meetings | Rows: date + title (linked) + condensed one-liner. No status dots. | Top 5, "View all →" |

**Slide-Over Panel (tabbed):**

| Tab | Content |
|---|---|
| Profile | "What They Do" + "AWS Stickiness" + Key AWS Services + Deployment grid |
| Status | ISVa, Deployed on AWS, CRM, PRM + Relationships. {/* Ring 3 future */} |
| People | ContactGroup: Partner Team, AWS Team |

---

## Engagements

### List Page (`EngagementsClient.tsx`)

**Grouped by partner** (not status). Groups default open.

**Filter bar:** All, Active, Planned, Blocked, Completed, Archived + search

**Row:** Name (linked, flex-1) + pillar badge + status dot + last updated date (muted)

### Detail Page (`engagements/[id]/page.tsx`)

**Job:** The narrative of one workstream.

**Identity Bar:**
- Title: `engagement.name` (`text-2xl`)
- Status dot (8px)
- Actions: Edit, Merge Into..., Delete (secondary/dropdown)

**Left Column:**

| Section | Content |
|---|---|
| Condensed Digest | AI-styled Detail Panel. The scannable 5-line version. Omit if no condensed exists. |
| Activity Summary | Full `current_state` as AI-styled Detail Panel. The complete narrative. |
| Connected Meetings | Meetings linked to this engagement. Rows: date + title (linked) + condensed digest snippet. Shows the temporal backbone of the workstream. |
| Timeline | Email messages routed here. Collapsible: open if ≤5 items, collapsed if more. Sender + date + subject + body preview. |

**Right Column:**

| Section | Content |
|---|---|
| Partner | Accent link to partner detail |
| Details | Pillar badge, topic (text), status (dot + text), last updated date |
| Connections | Linked relationships (rows), programs (EntityLinkChips), events (EntityLinkChips) |
| Participants | Count + org breakdown summary ("4 AWS · 4 Vasion"), expandable to full ContactGroup |

**Removed:** Goal callout (dropped in migration 069).

---

## Meetings

### List Page (`MeetingsClient.tsx`)

Upcoming section (default open) / Past section (default collapsed).

**Filter bar:** All + 10 meeting type filters + search

**Row:** Date (w-16) + title (linked, cleaned, flex-1) + engagement name if linked (muted) + partner name (right-aligned) + recurrence icon if recurring

**"+ New Meeting"** primary action button, top-right.

### Detail Page (`meetings/[id]/page.tsx`)

**Job:** Take notes, review summaries, manage tasks for one meeting.

**Identity Bar:**
- Title: `cleanMeetingTitle(meeting.title)` (`text-2xl`)
- Partner name (as linked badge)
- Date
- Status dot

**Left Column (workspace):**

| Section | Content |
|---|---|
| NoteWorkspace | Three-mode flow. Mode 1: raw notes + Summarize. Mode 2: AI summary + TaskEditor. Mode 3: read-only summary + sidebar tasks. Component manages all state internally. |

The NoteWorkspace is the entire left column. It IS the page's purpose.

**Right Column (context — slim):**

| Section | Content |
|---|---|
| Partner | Accent link to partner detail |
| Details | Date (full weekday), time range, engagement (linked — **prominent "Link to Engagement" action if unlinked**), meeting type, recurrence info, source |
| Attendees | ContactGroup: AWS / Partner / Other. Compact rows. |
| Created | Timestamp footer |

**What is NOT on this page:** Partner profile, partner description, AWS stickiness, key services, partner context/brain boxes. The meeting page focuses on the workspace.

---

## Tasks

### List Page (`TasksClient.tsx`)

**Job:** Act on your obligations across all partners.

**Default filter:** "Me" (not All)
**Default sort:** Recency (newest first)
**Default grouping:** Flat list (no grouping). Optional "Group by partner" toggle.

**Filter bar:** All, Me, Internal, Partner, Third Party + search

**Row (generous spacing — `py-3.5`):**
- Checkbox (left) — complete/reopen toggle
- Description (flex-1) — inline editable on click
- Partner tag — small muted text
- Meeting provenance — "from: Meeting Title" linked, if applicable
- Engagement link — linked name or "+ link" inline action
- Owner badge — pill (Me/Partner/Internal/Third Party)
- Delete — trash icon, requires confirmation

**"+ Add Task"** primary action button, top-right.

### Group Header (when grouping by partner)
Partner name as section label style + count.

---

## Inbox

### Page (`inbox/page.tsx` + `InboxClient.tsx`)

**Job:** Route incoming emails to the right place.

**Section header:** "UNROUTED MESSAGES" with grouped count

**Each inbox card (enhanced):**
- Partner pill (if detected) or "Pick Partner" prompt (amber)
- Subject line (primary text)
- **Body preview:** first 2–3 lines of parsed email text, truncated (from `body_text`)
- **Sender + participants:** sender name + "and N others" if multiple participants
- **Date range:** for grouped messages, show earliest–latest date
- Message count badge when group has >1 messages
- Actions: Assign / New / Discard (Assign and New only available after partner identified)

**Unknown partner flow:** "Pick Partner" button → filterable dropdown → partner stamped → Assign/New unlock.

**Empty state:** "Inbox clear — nothing to route."

---

## Programs

### List Page (`ProgramsClient.tsx`)

**Job:** Browse the program catalog.

**Flat list** — no collapse grouping. Type badge on each row.

**Filter bar:** Competency, Service Ready, SCA, Program, Credit Program, Funding, Channel, Enablement + search

**Row:** Name (linked, flex-1) + type badge + linked engagement count (plain text, muted)

### Detail Page (`programs/[id]/page.tsx`)

Single-column.

| Section | Content |
|---|---|
| Description | Prose |
| Requirements | Prose |
| What It Unlocks | Prose |
| Lifecycle | Type + duration as sub-label/value pairs |
| Linked Engagements | Clickable entity rows (name + pillar badge + status dot) |

---

## Events

### List Page (`EventsClient.tsx`)

**Job:** See upcoming events on the calendar.

Grouped by month. Upcoming default open, Past default collapsed.

**Filter bar:** type filters (Conference, Summit, Workshop, etc.) + search

**Row:** Date range (`formatCompactDateRange`, w-24) + name (linked, flex-1) + location (`extractCity`)

### Detail Page (`events/[id]/page.tsx`)

Single-column.

| Section | Content |
|---|---|
| Description | Prose |
| Details | Dates, location (full), host, geo — sub-label/value pairs |
| Linked Engagements | Clickable entity rows |

---

## Relationships (→ transitioning to People)

### Current List Page (`RelationshipsClient.tsx`)

Flat rows grouped by relationship_type. Will be replaced by People page.

**Row:** Name (linked, flex-1) + org + service (muted)

### Future: People Page

Replaces Relationships. Single-column list with search + filters.

**Planned filters:** Organization, partner association, org type (AWS/Partner/Third Party), role, frequency of appearance.

Follows list page pattern with FilterBar, flat rows, ContactRow rendering.

---

## Pulse (Future)

**Job:** What needs attention right now across all partners.

Single-column, sectioned.

| Section | Content |
|---|---|
| Inbox | Unrouted count + preview of most recent. "Go to Inbox →" link. |
| My Tasks | Open tasks where owner = "me", sorted by recency. Top 5–10 + "View all →". |
| Upcoming Meetings | Next 3–5 meetings. Partner name + date + title. Linked to meeting detail. |
| Signals (future) | Stale engagements, overdue items, partners with no recent activity. |

Not yet built. Partners page serves as landing page until Pulse exists.