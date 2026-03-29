# Roadrunner North Star Vision & Spec
**Version 3.0 — 2026-03-28**
**Purpose:** Living vision document. Defines what Roadrunner is, what's built, what's next, and how every piece connects. This is vision and intent — not volatile stats. For current system numbers see `goal-state.md` and `CLAUDE.md`.

---

## Part 1: What Roadrunner Is

Roadrunner is a partner intelligence platform for an AWS Partner Development Manager (PDM) managing 10–25 ISV technology partners. It tracks everything about each partner relationship: what they do, what's happening with them, how they're performing financially, what programs they're in, what needs attention, and what was said in every meeting.

**The user's daily reality:** Steven is in meetings all day. He opens Roadrunner most often to take meeting notes. Second most often, he opens it to look at a partner — their numbers, their solution, what's active. Third, he manages tasks and triages inbox items. The UI is designed around this usage hierarchy.

**The data architecture is complete.** Three rings of data (catalog, activity, posture) sync bidirectionally between Supabase and Airtable. The AI pipeline is refined (3 calls, each with clear scope and rich context). The full UI overhaul has been completed — all pages redesigned, sidebar simplified, Ring 3 data rendering. What remains is data wiring completion (People), engine improvements (meeting recurrence), and professional polish.

---

## Part 2: The Three Screens

### Screen 1: Today
**Purpose:** "What do I need to do right now?"

The landing page. Not a dashboard, not charts. An action-oriented view of your day.

**Sections (in order of visual priority):**

1. **Today's Meetings** — Meetings scheduled for today, prominently displayed. Each shows: partner name, meeting title, type badge, and "Open Notes" action. One click gets you into the note workspace. This is the #1 interaction in the entire app. If there are no meetings today, this section gracefully collapses.

2. **Open Tasks** — Filtered to "me" by default. Grouped by partner. Each shows description, due date (highlighted if overdue), and partner context. Checkbox to complete inline.

3. **Inbox Items** — Count of unrouted items with CTA to triage.

4. **Upcoming Meetings** — Next 7 days. Same format as today's meetings but lower visual priority.

**Design intent:** Today is a launchpad, not a destination. Land here, see what needs doing, click into the thing, and go.

### Screen 2: Partners
**Purpose:** "Let me go look at Spacelift."

Partner list grouped by segment with performance bars showing TCV attainment. Clicking opens partner detail.

**Partner Detail Page:**

The convergence point for everything about a partner. Feels like opening a dossier — you immediately orient, then drill into whatever layer you need.

**Sections (in order, single scrollable view):**

1. **Identity Bar** — Partner name, segment badge, SPMS ID
2. **Brain Synthesis** — Single Strategic Posture paragraph. Qualitative assessment of co-sell/co-build/co-market maturity. No dollar amounts, no percentages. The elevator pitch.
3. **Co-Sell Performance** — Financial snapshot: YTD, goals, attainment %, 2024/2025 actuals, projections. Math, not AI opinion.
4. **Active Engagements** — Grouped by pillar (Co-Sell/Co-Build/Co-Market) with status badges and condensed digests.
5. **Open Tasks** — Partner-scoped tasks with descriptions, due dates, provenance.
6. **Recent Meetings** — Last 90 days with type badges, dates, condensed digests.
7. **Program Enrollments** — Type/status badges, date achieved, progressive disclosure at 8+.
8. **Strategic Goals** — Grouped by category. Clean empty state when pending.
9. **Funding** — MPOPP + MDF with allocated/spent/remaining computed.
10. **People** — See Part 5 for full architecture. Three curated groups + engagement contributors.
11. **Solution Profile** — What They Do, JVP, Architecture, Listing Types, Pricing Model, AWS Stickiness, Key AWS Services.
12. **Operational Status** — ISVa, Deployed on AWS, CRM Platform, CRM Notes.
13. **Scratchpad** — Editable notepad for tribal knowledge. Feeds brain synthesis.

### Screen 3: Inbox
**Purpose:** "Route this email."

Emails and calendar invites arrive, get mechanically matched to partners, and wait for human routing. Actions: assign to existing engagement, create new engagement, discard. AI synthesizes after routing.

---

## Part 3: Meeting Notes — The Primary Workflow

Meeting notes is the most frequent interaction. The flow must be frictionless and professional.

**Getting to notes:**
- From Today screen: one click on any meeting → note workspace
- From partner page: click any meeting → note workspace
- From meetings list: click any meeting → meeting detail with note workspace

**Three modes:**

**Mode 1: Writing** — Full-width textarea. Previous context in collapsible sidebar (scoped by cascade: same engagement → same series → nothing).

**Mode 2: Review** — AI-generated structured summary (Discussion Points, Decisions Made, Key Context). Extracted tasks in interactive TaskEditor. Raw notes collapsed but accessible.

**Mode 3: Saved** — Summary displayed read-only. Tasks shown. "Edit Notes" to return to Mode 1.

**Enterprise UX standards:**
- "Generate Summary" with explicit loading state and progress message
- Save operations confirm visually
- Error states are clear with retry buttons
- Navigation away from unsaved changes shows confirmation dialog
- No ambiguous states

---

## Part 4: Navigation & Sidebar

Three-tier hierarchy:

**Primary:** Today, Partners, Inbox (with badge)
**Secondary:** Tasks, Meetings
**Tertiary:** Programs, Events

**Removed:** Engagements list (accessed through partner detail). Relationships list (dissolved).

---

## Part 5: People Architecture

People are organized in a two-tier model. The old Relationships table is dissolved.

### Tier 1: The Partner Account Team (AT-owned, curated)

Three groups of curated contacts synced to `partner_participants`:

**AWS Team:**
| AT Field | Role | Description |
|----------|------|-------------|
| PSA | PSA | AWS technical counterpart |
| Account Manager | Account Manager | AWS sales rep |
| PMM | PMM | AWS marketing counterpart |
| AWS Contacts | AWS Contact | Other important AWS people (secondary PMMs, sales leaders) |

**Partner Team:**
| AT Field | Role | Description |
|----------|------|-------------|
| Alliance Lead | Alliance Lead | Partner's #1 person |
| Partner Contacts | Contact | Partner-side people beyond Alliance Lead |

**Third Parties:**
| AT Field | Role | Description |
|----------|------|-------------|
| CRM Contact | CRM Contact | Tackle/Labra/Suger platform contact |
| Third Party Contacts | Third Party | SIs, consultants, agencies with ongoing partner relationships |

All multi-person fields use `Name <email> (Title)` format, one per line or semicolon-separated. The parser handles both delimiters.

### Tier 2: Engagement Contributors (activity-derived, discoverable)

Everyone who has appeared on an engagement or meeting for a partner. Accumulated through email parsing and manual entry. Lives in `participants` with links through `engagement_participants` and `meeting_participants`.

Displayed on the partner page collapsed by default, grouped by engagement. Discoverable when needed, not cluttering the account team view.

**Adding people to curated tier:** Edit the AT field. Next sync picks it up. No in-app promotion mechanism.

### Relationships Dissolution

The Relationships table tracked AWS internal teams. Individual contacts exist in `participants` via engagement links. Steps: archive AT records, drop Supabase tables, remove detail page.

---

## Part 6: Meeting Recurrence System

### Current Limitations
Engine spawns lazily on page load, advances from previous occurrence's date. No anchor day — rescheduling one meeting drifts all future spawns. No series-level editing. No "edit this one" vs "edit series."

### Target State

**Anchor day:** `anchor_day` column on meetings table. Weekly meeting on Wednesday stores `anchor_day: 3`. Rescheduling one occurrence doesn't drift the series.

**Spawn logic:** Advance from last occurrence, then snap to anchor day.

**Editing patterns:**
- "Just this meeting" — changes only this occurrence
- "This and future meetings" — updates anchor on series root
- "End series" — stops future spawning
- "Skip this one" — cancels without breaking chain

**Create flow:** Anchor day picker, preview of next 4 dates, clear visual indication.

**Visual indicators:** ↻ icon on recurring meetings. Series context on detail page. Series management controls.

**Meeting type formatting:** Use `MEETING_TYPE_DISPLAY` map in UI. `partner_cadence` → `Partner Cadence`.

---

## Part 7: AI Calls

### Three AI Calls (Claude Sonnet via Anthropic API)

**1. Engagement Synthesizer** — Fires on inbox routing. Evolves engagement state from new email + context. Stable.

**2. Note Summarizer** — Fires on "Generate Summary." Produces structured summary + tasks. Stable.

**3. Brain Synthesizer** — Fires on "Re-synthesize." Reads 11 context sections. Produces single Strategic Posture paragraph (3-6 sentences). No dollar amounts. Qualitative only. Stable.

### What AI Does NOT Do
- No automated risk labels or urgency scoring
- No proactive alerts or recommendations
- No entity matching (manually linked only)
- Performance assessment is computed math, not AI opinion

---

## Part 8: Enterprise UX Standards

### Loading States
- Short (<1s): inline spinner. Medium (1-5s): contextual message. Long (5s+): progress bar.
- Never allow double-clicks — disable after first click.

### Error Handling
- Graceful failure on every API call. Actionable messages with retry.

### Navigation Safety
- Unsaved changes warn before navigation. Browser beforeunload + route interception.

### Confirmation & Feedback
- Destructive actions require confirmation. Success shows visual confirmation.

### Button Labels
- Professional, action-oriented. "Generate Summary," "Save & Lock," "Create Engagement," "Route to Engagement."

---

## Part 9: Visual Design System

### Color Palette (dark theme only)
```css
--background: #0f1117;
--foreground: #e4e4e7;
--surface: #1a1b23;
--border: #2a2b35;
--muted: #71717a;
--accent: #6366f1;
```

### Design Principles
1. Information density is intentional.
2. Progressive disclosure. Surface → drill.
3. Consistency over cleverness.
4. Dark theme is the only theme.
5. Math, not magic.
6. Enterprise, not flashy. Think Linear, Notion, Vercel's dashboard.

### Anti-Patterns
- Gradient text fades
- Skeleton loaders that flash <200ms
- Auto-dismissing toasts
- Modals on modals
- Horizontal scroll in tables
- Truncated text without expand
- Color as only differentiator
- Raw enum values in UI

---

## Part 10: Data Architecture Overview

### Three Rings
**Ring 1 — Catalog (AT → RR):** Partners, Programs, Events, Relationships (pending dissolution).
**Ring 2 — Activity (RR → AT):** Engagements, Meetings, Notes, Tasks, Messages, Partner Context.
**Ring 3 — Posture (AT → RR):** Goals, Enrollments, Event Participations, MPOPP, MDF.

### Contact Sync Status
| Field | Status |
|-------|--------|
| PSA, Account Manager, PMM, Alliance Lead, Partner Contacts | ✅ Syncing |
| CRM Contact | ❌ Field ID mapped but not wired |
| AWS Contacts, Third Party Contacts | ❌ New fields, not yet mapped |

### Computed in UI (not stored)
- Attainment %: ytd ÷ goal × 100
- Trend: attainment % vs expected (month ÷ 12 × 100)
- YoY growth: (current - prior) ÷ prior × 100
- Funding remaining: allocated - spent

---

## Part 11: Scalability & Future-Proofing

### Airtable Exit Path
1. Partner Goals → CRUD in RR, stop AT pull
2. Partner Events → CRUD in RR
3. Partner Programs → CRUD in RR
4. Funding tables → CRUD in RR
5. Partners profile → editing in RR, AT read-only
6. AT decommissioned

### Future AI Capabilities (design for, don't build yet)
- One-click transition docs
- Portfolio views with financial filtering
- Pre-meeting briefings from recent activity
- Cross-partner people search

---

## Part 12: System Reference

Volatile stats (migrations, tests, decisions, pages, components) live in `goal-state.md` and `CLAUDE.md` — updated every session. This document is vision, not inventory.

**Stack:** Next.js, Supabase PostgreSQL, Vitest, Vercel, Mailgun, Claude Sonnet, Anthropic API, Tailwind v4

**Implementation plans** live in `docs/plans/active.md`. Completed plans archived in `docs/plans/archive/`.

---

*This is the North Star. Vision and architecture. For current stats: goal-state.md. For task plans: docs/plans/active.md.*