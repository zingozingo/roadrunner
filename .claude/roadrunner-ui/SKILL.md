---
name: roadrunner-ui
description: UI design system reference for Roadrunner. Covers existing tokens, components, pages, and data patterns. Read docs/north-star.md FIRST for vision and design decisions.
---

# Roadrunner UI Design System

This is the design system reference for Roadrunner — what exists in the codebase right now.
Read `docs/north-star.md` FIRST. That document defines the vision, UX standards, interaction flows, and anti-patterns.
This doc covers: tokens, components, pages, and data-fetching patterns as they exist today.
This is a LIVING document — update it as you establish new patterns during the UI overhaul.

---

## Design Tokens

Dark theme only. All colors are CSS custom properties defined in `src/app/globals.css` and exposed to Tailwind via `@theme inline`.

### Core Colors

| Token | Value | Tailwind Class | Usage |
|-------|-------|---------------|-------|
| --background | #0f1117 | bg-background | Page background |
| --foreground | #e4e4e7 | text-foreground | Primary text |
| --surface | #1a1b23 | bg-surface | Cards, panels |
| --surface-hover | #22232d | bg-surface-hover | Hover states |
| --border | #2a2b35 | border-border | Borders, dividers |
| --muted | #71717a | text-muted | Secondary text, labels |
| --accent | #6366f1 | text-accent, bg-accent | Links, badges, actions |
| --accent-hover | #818cf8 | text-accent-hover | Hover on accent elements |

### Status Colors

| Token | Value | Usage |
|-------|-------|-------|
| --status-active | #22c55e | Active engagements/tasks |
| --status-blocked | #f59e0b | Blocked items |
| --status-completed | #8b5cf6 | Completed items |
| --status-archived | #6b7280 | Archived items |

### Semantic Colors

Program types, event types, and confidence levels each have dedicated tokens in globals.css (e.g., `--program-competency: #3b82f6`, `--event-conference: #8b5cf6`, `--confidence-high: #22c55e`). See the CSS file for the full list.

### Typography

- **Sans:** Geist Sans (`font-sans`) — all body text
- **Mono:** Geist Mono (`font-mono`) — financial data, numbers, code
- **Sizing:** `text-xs` for labels/badges, `text-sm` for body, `text-[15px]` for prose content
- **Section labels:** `text-xs font-semibold uppercase tracking-wider text-muted`

---

## Existing Components

### src/components/shared/ (13 files)

| Component | Purpose |
|-----------|---------|
| SlideOverPanel | Right-side sliding panel with tab support |
| PillarBadge | Co-Sell / Co-Build / Co-Market badge |
| StatusBadge | Engagement status badge (active/blocked/completed/etc.) |
| TypeBadge | Exports: ProgramTypeBadge, EventTypeBadge, RelationshipTypeBadge, MeetingStatusBadge |
| ContactGroup | Grouped contact display with role-priority sorting |
| ContactRow | Single contact row with email/title |
| EngagementLinker | Dropdown to link meetings to engagements (includes "Create new") |
| RecurrenceEditor | Recurrence pattern picker for meetings |
| ConfirmDialog | Modal confirmation for destructive actions |
| CollapsibleEmails | Expandable email thread display |
| CollapsibleParticipants | Expandable participant list |
| ParticipantList | Full participant list with role badges |
| Timeline | Meeting timeline display |

### src/components/partners/ (3 files)

| Component | Purpose |
|-----------|---------|
| BrainSynthesis | Client component — displays/triggers AI brain synthesis |
| PartnerScratchpad | Client component — editable tribal knowledge notepad |
| PartnerReferencePanel | Slide-over with Profile/Status/People tabs |

### src/components/notes/ (5 files)

| Component | Purpose |
|-----------|---------|
| NoteWorkspace | 3-mode meeting notes (editing → review → saved) |
| ContextSidebar | Partner context sidebar for note-taking |
| PreviousNotes | Previous meeting digests (3-tier cascade) |
| TaskEditor | Inline task creation/editing |
| MeetingNotesSection | Notes section wrapper for meeting detail |

### src/components/layout/ (4 files)

| Component | Purpose |
|-----------|---------|
| Sidebar | App navigation sidebar |
| PageHeader | Page title + action bar |
| FilterBar | Filter controls for list pages |
| EmptyState | Empty state display |

### src/components/actions/ (6 files)

Entity-specific action button groups: EngagementActions, MeetingActions, ProgramActions, EventActions, RelationshipActions, MergeButton.

### src/components/inbox/ (1 file)

InboxClient — full inbox triage UI (assign/create/discard).

---

## Pages (18 routes)

| Route | Description | Notes |
|-------|-------------|-------|
| `/` | Today page | NEW — basic meetings + inbox signal. Redesign target. |
| `/partners` | Partner list | Needs performance indicators |
| `/partners/[id]` | Partner detail | Ring 3 sections wired. Pre-redesign layout. |
| `/engagements` | Engagement list | Grouped by partner. North Star says: remove standalone page |
| `/engagements/[id]` | Engagement detail | Condensed digest + connected meetings |
| `/meetings` | Meeting list | Includes quick-capture modal |
| `/meetings/[id]` | Meeting detail | Inline NoteWorkspace. Needs enterprise UX polish |
| `/programs` | Program list | North Star says: remove standalone page |
| `/programs/[id]` | Program detail | |
| `/events` | Event list | North Star says: remove standalone page |
| `/events/[id]` | Event detail | |
| `/relationships` | Relationship list | North Star says: remove standalone page |
| `/relationships/[id]` | Relationship detail | |
| `/tasks` | Task dashboard | Me-filtered, grouped by partner |
| `/inbox` | Inbox triage | Assign/create/discard workflow |
| `/notes` | Notes redirect | Legacy route |
| `/notes/[id]` | Note detail | Legacy route |
| `/notes/new` | New note | Legacy route |

---

## Data Fetching Patterns

**Server components (reads):** Pages query Supabase directly via `db/` functions with `Promise.all` for parallel fetches. This is the standard pattern — do not create API routes for read operations.

```typescript
const [{ data: meetings }, { data: engagements }, goals, enrollments] = await Promise.all([
  db.from("meetings").select("*").eq("partner_id", id),
  db.from("engagements").select("*").eq("partner_id", id),
  getPartnerGoals(id),
  getPartnerProgramEnrollments(id),
]);
```

**Ring 3 data:** Import query functions from `@/lib/db` — `getPartnerGoals`, `getPartnerProgramEnrollments`, `getPartnerEventParticipations`, `getPartnerMpoppFunding`, `getPartnerMdfFunding`.

**Client components (writes):** Interactive features (BrainSynthesis, PartnerScratchpad, InboxClient, NoteWorkspace) use API routes for mutations. Actions use `fetch()` to API routes under `/api/`.

**Financial data:** 11 numeric columns on partners table (mp_tcv_goal, larr_goal, mp_tcv_ytd, larr_ytd, mp_tcv_2024, larr_2024, mp_tcv_2025, larr_2025, mp_tcv_target_2025, mp_tcv_projected_annual, larr_projected_annual). Attainment % and YoY growth are computed in UI, not stored.

---

## Agent Guidelines

1. **North Star is the authority.** `docs/north-star.md` defines what every page should become. Read it before touching UI code.
2. **Document new patterns here.** When you establish a pattern (e.g., financial display format, loading states, performance bars), add it to this file before reusing across pages.
3. **Verify after every change.** Run `npx tsc --noEmit` and `npx vitest run`. Fix breaks before moving on.
4. **Do NOT modify** without explicit direction: `src/lib/sync/*`, `src/lib/email-parser.ts`, `src/lib/ics-parser.ts`, `src/lib/classifier.ts`, `src/lib/phase2-prompt.ts`, `src/lib/meeting-recurrence.ts`, `src/lib/brain-synthesizer.ts`, `src/lib/notes-context.ts`, `src/app/api/inbound/route.ts`, `src/lib/db/*`, `src/lib/__tests__/*`.
5. **No separate CSS/JS files.** Single-file components with inline Tailwind. All colors via CSS custom properties.
6. **Delete, don't stub.** When removing a page or component, delete the file entirely. No dead code, no "removed" comments.
7. **Force-dynamic on all pages.** Every page.tsx should export `const dynamic = "force-dynamic"` for real-time data.
8. **Design autonomy.** Color choices, layout patterns, and component structures are yours to design. The only constraints are: dark theme only (--background: #0f1117 base), the Geist Sans / Geist Mono font pairing, and the design principles in north-star.md Part 8. Build a cohesive visual system — document your color decisions and patterns in this file as you go.

---

## Patterns Established During Overhaul

*Add new patterns here as you create them. Format: pattern name, where it's used, the specific implementation.*

*(none yet — this section will grow during the agent session)*
