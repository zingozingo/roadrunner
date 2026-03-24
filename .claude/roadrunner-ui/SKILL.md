---
name: roadrunner-ui
description: UI design system for Roadrunner (Relay), an AI-powered AWS partner engagement management app. Read this BEFORE any UI work — list pages, detail pages, layout, components, or visual consistency. Covers layout system, container types, typography, AI content rendering, progressive disclosure, responsive behavior, and page-by-page specs. Trigger on any mention of Roadrunner UI, Relay UI, page layout, component patterns, or visual design work.
---

# Roadrunner UI Design System

> **Constitution for all UI decisions.** Read fully before building, modifying, or extending any Roadrunner page. Reference files in `references/` provide exact prop types, color values, and entity field mappings — consult them for implementation detail after absorbing this document.

---

## 1. Vision & Mental Model

Roadrunner is a partner intelligence platform for an AWS PDM managing 10–25 ISV technology partners. The UI must serve a specific daily workflow, not present a generic database browser.

### The Partner-Centric Model

Everything orbits the partner. The PDM doesn't think "let me look at engagements" — they think "let me look at Spacelift." The UI, data model, and AI all organize around this reality.

Three top-level concepts:

| Concept | What It Is | Why It's Top-Level |
|---------|-----------|-------------------|
| **Pulse** | What needs attention NOW across all partners. Inbox items, open tasks, stale signals. | The 8am Monday morning view. Cross-cutting by nature. |
| **Partners** | The 10–25 partner cards. Each is a portal to everything about that partner. | The center of gravity. Where you spend most of your time. |
| **Inbox** | Incoming emails and calendar invites needing routing. | Cross-partner inflow. Routing is a distinct workflow. |

Everything else — engagements, meetings, tasks, programs, events, people — is accessed through a partner card or through a cross-partner utility view. Entity-type pages exist for cross-partner search and filtering, not as primary workflow destinations.

### The Daily Workflow

1. **Triage** — Check Pulse: route inbox items, review urgent tasks, scan upcoming meetings
2. **Prepare** — Click into a partner before a meeting: read the brain, check recent activity, review open tasks
3. **Capture** — During/after a meeting: take notes, trigger AI summarization, review extracted tasks
4. **Synthesize** — Periodically: update scratchpad, re-synthesize brain, link entities

The UI guides this journey. Every page has one clear job. No page tries to do everything.

### The Two-Version Pyramid (UX Principle)

Every AI-generated entity produces two versions: a **full version** for deep reading and a **condensed version** for scanning. This isn't just an AI architecture choice — it's the UX model. Condensed is the default everywhere. Full is one click away. This lets you scan 6 engagements in 30 seconds on a partner page, or read the complete narrative by clicking into one.

---

## 2. Navigation Hierarchy

The sidebar reflects workflow priority, not entity completeness.

### Tiers

| Tier | Items | Rationale |
|------|-------|-----------|
| **Primary** | Pulse, Partners, Inbox | Daily workflow. Where you start every session. |
| **Secondary** | Meetings, Tasks | Cross-partner temporal/action views. Used frequently but not the starting point. |
| **Reference** | Programs, Events, People | Catalog browsing. Used when linking entities or looking up requirements. |

### Sidebar Rendering

- App name "Relay" at top
- Tier labels as zone headers (subtle, uppercase, small)
- Inbox shows unresolved count badge
- `/` redirects to Pulse (once built; Partners until then)
- Active page highlighted with accent background
- Tiers separated by whitespace, not borders

### Zone Label Style
```
text-[10px] font-medium uppercase tracking-[0.12em] text-muted/40 px-3 mb-1
```
Zone spacing: `mt-6` between tiers.

---

## 3. Layout System

### Principles

- **Two-column detail pages**: left = dynamic content (activity, AI, lists), right = stable reference (profile, status, people, metadata)
- **Single-column list pages**: full width, filter bar at top, grouped content below
- **No three-column layouts.** The meeting detail middle-column pattern is eliminated.
- **No staggered card grids.** No floating boxes at different heights.
- **Left column is the star.** It gets the majority of width and contains the content you're there to interact with.
- **Right column is orientation.** It answers "what is this thing?" so you can focus on the left column's "what's happening with it?"

### Two-Column Grid

```
grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 lg:gap-12
```

Right column: `lg:border-l lg:border-border/20 lg:pl-8`

Below `lg` breakpoint: columns stack vertically, right column appears below left.

### Page Shell

Every page follows this outer structure:
```
<div className="mx-auto max-w-7xl p-6 lg:p-8">
  {/* Identity bar */}
  {/* Content (single or two-column) */}
</div>
```

`max-w-7xl` ensures readability on ultra-wide monitors. Content breathes on 30" screens without stretching to absurd line lengths.

---

## 4. Container Types

Three container types. Every UI element maps to one of these. No exceptions.

### Section

A labeled group of related content. Optionally collapsible.

```
┌─ SECTION LABEL (count) ─────────────────────┐
│                                              │
│  Content: rows, prose, sub-components        │
│                                              │
└──────────────────────────────────────────────┘
```

- Header: section label style (see Typography)
- Count shown as plain text after label, not a badge
- Collapsible sections use `<details>/<summary>` with chevron
- Non-collapsible sections use `<h2>` header
- Content starts `mt-3` below header
- Sections separated by `pt-6 border-t border-border/20` (first section after identity bar: no top border)

### Row

A single item in a list. Clickable when linking to a detail page.

```
[Name/Description]                    [metadata] [badge] [dot]
```

- Name: `flex-1 truncate` — takes available space
- Metadata, badges, status indicators: `shrink-0` right-aligned
- Padding: `px-3 py-3` (slightly more generous than before for readability)
- Border: `border-b border-border/20`
- Hover: `hover:bg-surface/50 transition-colors`
- `items-center` when badges/dots present; `items-baseline` for text-only rows

### Detail Panel

Full-width content block for prose, AI summaries, or structured text.

```
┌──────────────────────────────────────────────┐
│  Prose content, AI-generated summaries,      │
│  structured text with sections.              │
│  Leading-relaxed for readability.            │
└──────────────────────────────────────────────┘
```

- Text: body prose style (see Typography)
- `leading-relaxed` for multi-paragraph content
- AI-generated content gets a visual marker (see AI Content Rendering)
- No card wrapper (`rounded-xl border bg-surface`) on detail pages

---

## 5. Typography

Readable, clear, scannable. Hierarchy creates visual speed — you should be able to identify the level of any text element at a glance.

| Element | Size | Weight | Color | Extra |
|---|---|---|---|---|
| Page title | `text-2xl` (24px) | `font-semibold` | `text-foreground` | — |
| Section label | `text-xs` (12px) | `font-semibold` | `text-muted` | `uppercase tracking-wider` |
| Category sub-label | `text-[10px]` | `font-semibold` | `text-muted/50` | `uppercase tracking-widest` |
| Row primary text | `text-sm` (14px) | `font-medium` | `text-foreground` | — |
| Row secondary text | `text-sm` | normal | `text-muted` | — |
| Body prose | `text-[15px]` | normal | `text-foreground/85` | `leading-relaxed` |
| Metadata/dates | `text-xs` (12px) | normal | `text-muted` | — |
| Pills/badges | `text-xs` | `font-medium` | tinted color | `whitespace-nowrap` |
| Sidebar zone label | `text-[10px]` | `font-medium` | `text-muted/40` | `uppercase tracking-[0.12em]` |

### Rules

- **Page titles are the largest text on any page.** Nothing competes with `text-2xl`.
- **Section labels are ALL CAPS and muted.** They orient without shouting.
- **Body prose is generous.** `text-[15px]` with `leading-relaxed` — optimized for reading AI-generated summaries and activity narratives.
- **Row text is compact.** `text-sm` keeps lists scannable. Density serves scanning; prose size serves reading.
- **Never use bold for emphasis in prose.** The AI doesn't control formatting. If emphasis is needed, it comes from structure (section placement, ordering), not inline styling.

---

## 6. AI Content Rendering

AI-generated content is visually distinct from user-entered content and always structurally parsed — never shown as raw text or markdown.

### Visual Treatment

AI-generated blocks receive a subtle left-border accent:
```
border-l-2 border-accent/25 pl-4
```

This creates a quiet "this came from the AI" signal without being distracting. Applied to: brain synthesis sections, meeting summaries, engagement summaries, condensed digests.

User-entered content (scratchpad entries, raw notes) has NO left border — it's direct and personal.

### Brain Synthesis (Partner Detail)

The brain produces 4 named sections. Parse on `## ` headers and render each as a labeled block:

```
┌─ RELATIONSHIP OVERVIEW ──────────────────────┐
│ ▎ 2-3 sentences on health, people, trajectory │
├─ ACTIVITY PATTERNS ──────────────────────────┤
│ ▎ Pillar distribution, focus areas, cadence   │
├─ WHAT NEEDS ATTENTION ───────────────────────┤
│ ▎ Stale items, gaps, risks, deadlines         │
├─ MOMENTUM ASSESSMENT ────────────────────────┤
│ ▎ One sentence: accelerating/steady/stalled   │
└──────────────────────────────────────────────┘
```

Each section: section label header + AI-styled Detail Panel content. If the raw text contains `## ` markers, split on them. If it doesn't (legacy data), render as a single AI-styled block.

### Meeting Summaries (Meeting Detail)

Summaries have three named sections: Discussion, Decisions, Key Context. Parse on these labels and render as distinct blocks within the NoteWorkspace. Each section gets a sub-label header and prose content.

### Condensed Digests

Condensed digests are the scannable compressed versions. Render as compact bullet lists:

```
Discussed: Key topic and what was said
Decided: Commitment or agreement reached
Context: Important background signal
Next: What happens next
```

Category tags rendered as small inline labels (`text-[10px] uppercase font-semibold text-muted/60`) before each bullet's content. Used on partner page for engagement previews and meeting previews.

### Engagement Current State (Engagement Detail)

- **Condensed digest** renders at the top of the left column as a compact scannable block
- **Full current_state** renders below it as a Detail Panel for the complete narrative
- Both get AI visual treatment (left border accent)

### Parsing Safety

Always handle the case where AI content doesn't contain expected section markers. Fallback: render as a single AI-styled Detail Panel. Never show raw `##` or `**` markdown tokens to the user.

---

## 7. Progressive Disclosure

The principle: show the most useful information first. Expand for more. Scale gracefully from 3 items to 30.

### Detail Page Lists

Lists embedded in detail pages (engagements on partner page, tasks, meetings):

| Item Count | Behavior |
|---|---|
| 1–7 | Show all items |
| 8+ | Show first 5 items + "Show all N →" link/expander |

The "Show all" expander reveals remaining items inline. For tasks, it can link to `/tasks?partner=X` for the full filtered view.

### List Pages

Lists on dedicated list pages (engagements list, meetings list, programs, events): **always expanded by default.** The filter bar handles narrowing. No collapsed-on-load groups.

**Exception:** Time-based past sections. "Past" meetings and archived engagements can default collapsed since you're usually looking at upcoming/active items.

### Default Filter States

| Page | Default Filter | Rationale |
|---|---|---|
| Tasks | "Me" | Your obligations are what you act on |
| Meetings | Upcoming open, Past collapsed | Preparation, not history |
| Engagements | All, grouped by partner | Find by partner, not by status |
| Inbox | All shown | Everything needs routing |

### Collapsible Sections on Detail Pages

- **Left column AI content:** Not collapsible. It's the reason you're on the page.
- **Left column lists (engagements, tasks, meetings):** Collapsible, default open.
- **Right column reference data:** NOT collapsible. Stable reference should always be visible without interaction.
- **Timeline/email history:** Collapsible, default open if ≤5 items, collapsed if more.

---

## 8. Responsive Behavior

Roadrunner must work on a 13" laptop and a 30" monitor. The same page, not different layouts.

### Breakpoints

| Breakpoint | Width | What Changes |
|---|---|---|
| `lg` (1024px) | Two → single column | Right column stacks below left. Grid goes from `grid-cols-[3fr_2fr]` to `grid-cols-1`. |
| `md` (768px) | Filter bar wraps | Pills wrap to second line. Search stays full-width. |
| `sm` (640px) | Compact adjustments | Tighter padding (`p-4` instead of `p-6`). Row metadata may hide or stack. |

### Rules

- **No horizontal scrolling. Ever.** Tables, code blocks, long text — everything wraps or truncates.
- **`max-w-7xl` on page content.** Prevents unreadable line lengths on ultrawide monitors.
- **Touch targets: 44px minimum** on interactive elements when viewport < 768px.
- **Condensed-first helps responsiveness.** Compact content works at any width. Full prose only appears when explicitly expanded.
- **Right column content order is preserved when stacking.** Solution Profile → Status → People in the same order whether side-by-side or stacked below.

---

## 9. Design Tokens

### Core Colors (CSS Custom Properties)

| Token | Value | Usage |
|---|---|---|
| `--color-background` | `#0f1117` | Page background |
| `--color-surface` | `#1a1b23` | Sidebar, input backgrounds, modal cards |
| `--color-surface-hover` | `#22232d` | Hover state for interactive surfaces |
| `--color-foreground` | `#e4e4e7` | Primary text |
| `--color-muted` | `#71717a` | Secondary text, labels, placeholders |
| `--color-border` | `#27272a` | Borders, dividers (always used with opacity) |
| `--color-accent` | `#6366f1` | Indigo — links, active states, primary actions |
| `--color-accent-hover` | `#818cf8` | Accent hover |

### Status Colors

| Status | Dot Color | CSS Variable |
|---|---|---|
| active | `#22c55e` (green) | `--color-status-active` |
| blocked | `#f59e0b` (amber) | `--color-status-blocked` |
| completed | `#8b5cf6` (purple) | `--color-status-completed` |
| archived | `#6b7280` (gray) | `--color-status-archived` |

### Semantic Tokens

| Purpose | Pattern |
|---|---|
| Status dot (identity bar) | `h-2 w-2 rounded-full bg-{status-color}` |
| Status dot (row) | `h-1.5 w-1.5 rounded-full bg-{status-color}` |
| Standard pill | `text-xs font-medium rounded-full px-2 py-0.5 bg-{color}/10 text-{color}` |
| AI content marker | `border-l-2 border-accent/25 pl-4` |
| Section separator | `pt-6 border-t border-border/20` |
| Row separator | `border-b border-border/20` |
| Hover state | `hover:bg-surface/50 transition-colors` |

### Pillar Colors

| Pillar | Background | Text |
|---|---|---|
| Co-Sell | `bg-emerald-500/10` | `text-emerald-400` |
| Co-Build | `bg-blue-500/10` | `text-blue-400` |
| Co-Market | `bg-purple-500/10` | `text-purple-400` |

### Owner Colors

| Owner | Background | Text |
|---|---|---|
| Me | `bg-accent/10` | `text-accent` |
| Partner | `bg-emerald-500/10` | `text-emerald-400` |
| Internal | `bg-amber-500/10` | `text-amber-400` |
| Third Party | `bg-purple-500/10` | `text-purple-400` |

Refer to `references/design-tokens.md` for the complete color catalog including program types.

---

## 10. Status Indicators

### Dots — for binary/lifecycle status

Small colored circles. Used in rows and identity bars to show where something stands.

| Context | Size | Classes |
|---|---|---|
| Identity bar | 8px | `h-2 w-2 shrink-0 rounded-full` |
| Row items | 6px | `h-1.5 w-1.5 shrink-0 rounded-full` |

Always include `title={status}` for accessibility.

### Pills — for categorical data

Colored capsules for classification: pillar, owner, type, segment, architecture.

```
text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap
bg-{color}/10 text-{color}
```

### Plain text — for counts

Never use a badge pill for a number. "4 engagements" as `text-xs text-muted`. Counts are informational, not categorical.

---

## 11. Interactive Elements

### Buttons

| Type | Style | Usage |
|---|---|---|
| Primary action | `bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-hover` | One per page max. "+ New Meeting", "Summarize with AI" |
| Secondary | `border border-border text-foreground rounded-lg px-3 py-1.5 hover:bg-surface-hover` | "Edit", "Re-synthesize", "Cancel" |
| Destructive | `text-red-400 hover:text-red-300` | "Delete" — text-only or subtle, requires confirmation |
| Inline action | `text-accent text-sm hover:underline` | "Show all", "Link to engagement", "View meeting" |

**Rules:**
- **One primary action per page.** If a page has "+ New Meeting" as the primary CTA, everything else is secondary or inline.
- **Destructive actions are never primary.** Delete is always secondary, always requires confirmation.
- **Button text is action-oriented.** "Save", "Summarize", "Create" — not "OK" or "Submit".

### Links

- Partner names: always accent-colored, always clickable to partner detail
- Engagement names: always clickable to engagement detail
- Meeting titles: always clickable to meeting detail
- External URLs: accent-colored with external link indicator

### Filter Bars

Pill-style single-select filters with integrated search.

- Click chip → select exclusively. Click active chip → deselect (back to All).
- Active chip: `border-accent bg-accent/10 text-accent`
- Inactive chip: `border-border bg-background text-muted hover:text-foreground`
- Search and filter work independently.
- Shows "X of Y items" count at right edge.
- Use when a list has **5+ items with meaningful categories**. Don't add filters to 3-item lists.

### Forms & Inputs

- Input background: `bg-surface`
- Border: `border-border/40 focus:border-accent`
- Text: `text-foreground`
- Placeholder: `text-muted/50`
- Consistent `rounded-lg` on all inputs
- Labels above inputs, not floating

---

## 12. Page Specifications

Each page has one job. The spec defines that job, the layout, and the content structure. Specific field mappings and component props are in `references/entity-catalog.md`.

---

### Pulse (Primary)

**Job:** What needs attention right now across all partners.

**Layout:** Single-column, sectioned.

**Sections:**
1. **Inbox** — Count of unrouted items + preview of most recent. "Go to Inbox →" link.
2. **My Tasks** — Open tasks where owner = "me", sorted by recency. Top 5–10 with "View all →" link.
3. **Upcoming Meetings** — Next 3–5 meetings across all partners. Partner name, date, title. Links to meeting detail.
4. **Signals** (future) — Stale engagements, overdue items, partners with no recent activity. Built when the data supports it.

**Status:** Not yet built. Partners page serves as landing page until Pulse exists.

---

### Partners List (Primary)

**Job:** Find any partner and see portfolio at a glance.

**Layout:** Single-column list.

**Structure:**
- Rows grouped by segment (Security, DevOps, CloudOps, Observability, OT/IoT)
- Each row: partner name (linked) + segment badge + engagement count + meeting count
- Groups default open
- Search filters across name, segment

---

### Partner Detail (Primary — Center of Gravity)

**Job:** Everything about one partner — the portal you explore.

**Layout:** Two-column.

**Identity Bar:**
- Partner name (`text-2xl`)
- Segment badge
- SPMS ID (right-aligned, muted)

**Left Column (dynamic — changes with activity):**

1. **Brain Synthesis** — 4 sections parsed from `##` headers, each rendered as a Section with AI visual treatment. "Re-synthesize" as secondary button. "Last synthesized" timestamp. If no synthesis exists, show prompt to synthesize.

2. **Scratchpad** — Compact inline entries. Input at bottom ("Add context about this partner..."). Entries show on hover-delete. No card wrapper.

3. **Engagements** — Section with count. Each engagement as a condensed card showing:
   - Engagement name (linked)
   - Pillar badge
   - Status dot
   - Condensed digest preview (topic, status, what's next — 2-3 lines)
   - If no condensed, fall back to topic field
   
   Progressive disclosure: first 5, "Show all N →" if more.

4. **Open Tasks** — Section with count. Flat rows: description + owner badge. Top 5, "View all tasks →" links to `/tasks` filtered to this partner.

5. **Recent Meetings** — Section with count. Rows: date + title (linked) + condensed digest preview (first line or two). Top 5, "View all meetings →" links to `/meetings` filtered to this partner.

**Right Column (stable — changes slowly):**

1. **Solution Profile** — "What They Do" (prose) + "AWS Stickiness" (prose, accent-labeled) + Key AWS Services (pill tags). This is the technical identity.

2. **Deployment & Pricing** — Compact grid: Architecture, Listing Types, Pricing Model. Each as sub-label + value/pills.

3. **Operational Status** — ISVa Status, Deployed on AWS, CRM Status, PRM Status. Each as sub-label + value. **This section is the future home of Ring 3 data:** program enrollment counts, funding wallet balances, goal progress. Design it as an expandable container that accommodates growth.

4. **People** — Grouped by org type: Partner Team, AWS Team. Each contact: name + role + title + email. Uses ContactGroup component.

---

### Engagement Detail

**Job:** The narrative of one workstream.

**Layout:** Two-column.

**Identity Bar:**
- Engagement name (`text-2xl`)
- Status dot (8px)
- Actions (Edit, Merge, Delete) — secondary buttons or dropdown

**Left Column:**

1. **Condensed Digest** — The scannable version, always visible at top. AI-styled Detail Panel. If no condensed exists, omit (don't show empty state).

2. **Activity Summary** — Full current_state as AI-styled Detail Panel. The complete narrative.

3. **Connected Meetings** — Meetings linked to this engagement. Rows: date + title (linked) + condensed digest snippet. Provides the temporal backbone of the workstream.

4. **Timeline** — Email messages routed to this engagement. Collapsible, default open if ≤5, collapsed if more. Each message: sender + date + subject + body preview.

**Right Column:**

1. **Partner** — Accent link to partner detail
2. **Details** — Pillar badge, topic, status (dot + text), last updated date
3. **Connections** — Linked relationships, programs, events (as pills/links)
4. **Participants** — Count + org breakdown summary, expandable to full list

---

### Meeting Detail

**Job:** Take notes, review summaries, manage tasks for one meeting.

**Layout:** Two-column. Left column is the workspace — it gets most of the space and attention.

**Identity Bar:**
- Meeting title (`text-2xl`, cleaned via `cleanMeetingTitle`)
- Partner name (as badge/link)
- Date
- Status dot

**Left Column (workspace):**

1. **NoteWorkspace** — The three-mode flow:
   - **Mode 1 (Editing):** Raw notes textarea + Previous Context sidebar + "Summarize with AI" primary button + "Cancel" secondary
   - **Mode 2 (Review):** AI summary (structured sections) + TaskEditor (interactive) + "Save" primary + "Back to Editing" secondary
   - **Mode 3 (Saved):** Read-only summary (structured sections) + Tasks in sidebar (read-only, owner badges) + "Edit Notes" secondary button
   
   The NoteWorkspace component manages all three modes. The page just provides props.

**Right Column (context — slim):**

1. **Partner** — Accent link
2. **Details** — Date (full weekday format), time range, engagement (linked — prominent "Link to Engagement" action if unlinked), meeting type, recurrence info, source
3. **Attendees** — Grouped by org (AWS / Partner / Other). Compact contact rows.
4. **Created** — Timestamp footer

**What is NOT on this page:** Partner profile, partner description, AWS stickiness, key services, partner context/brain. All of that lives on the partner detail page. The meeting page shows enough to orient you (partner link, engagement link, attendees) and focuses on the workspace.

---

### Tasks Page (Secondary)

**Job:** Act on your obligations across all partners.

**Layout:** Single-column list.

**Default state:** Filtered to "Me". Sorted by recency (newest first). Flat list, no grouping.

**Filter bar:** Me / Internal / Partner / Third Party (+ All)

**Optional toggle:** "Group by partner" — adds partner headers when enabled

**Each task row:**
- Checkbox (left) — toggles complete/reopen
- Description — `flex-1`, inline editable on click
- Partner tag — small muted text or pill
- Meeting provenance — "from: Meeting Title" linked, if applicable
- Engagement link — linked name if set, "+ link" inline action if not
- Owner badge — pill (Me/Partner/Internal/Third Party)
- Delete — trash icon, requires confirmation

**Row spacing:** More generous than other lists (`py-3.5`) — tasks need room because each row has more interactive elements.

**"+ Add Task" button:** Primary action, top-right.

---

### Meetings List (Secondary)

**Job:** See your calendar across all partners.

**Layout:** Single-column list.

**Structure:**
- Upcoming section (default open) / Past section (default collapsed)
- Filter bar: All + 10 meeting type filters
- Each row: date + title (linked, cleaned) + partner name (right-aligned) + engagement name if linked (muted) + recurrence icon if recurring

**"+ New Meeting" button:** Primary action, top-right.

---

### Engagements List (Secondary)

**Job:** Find any engagement across all partners.

**Layout:** Single-column list.

**Structure:**
- Grouped by partner (not by status)
- Groups default open
- Filter bar: status filters (All, Active, Planned, Blocked, Completed, Archived) + search
- Each row: name (linked) + pillar badge + status dot + last updated date (muted)

---

### Inbox (Primary)

**Job:** Route incoming emails to the right place.

**Layout:** Single-column.

**Each inbox card (enhanced):**
- Partner pill (if detected) or "Pick Partner" prompt
- Subject line
- Body preview: first 2–3 lines of parsed email text, truncated
- Sender name + participant count ("+ 3 others")
- Message group count and date range (for grouped messages)
- Actions: Assign / New / Discard (Assign and New only available after partner identified)

**Empty state:** "Inbox clear — nothing to route."

---

### Programs List (Reference)

**Job:** Browse and search the program catalog.

**Layout:** Single-column list.

**Structure:**
- Flat list (no grouped collapse). Each row shows name + type badge + linked engagement count
- Filter bar: type filters (Competency, Service Ready, SCA, etc.)
- Search filters on name and description
- Click into detail for requirements, description, lifecycle info

---

### Events List (Reference)

**Job:** See what's coming up on the events calendar.

**Layout:** Single-column list.

**Structure:**
- Grouped by month (this works well — keep it)
- Upcoming section default open, Past default collapsed
- Filter bar: type filters
- Each row: date range + name + location (city)

---

### People (Reference — Future)

**Job:** Find and manage contacts across all partners and entities.

**Layout:** Single-column list with search + filters.

**Planned filters:** Organization, partner association, org type (AWS/Partner/Third Party), role, frequency of appearance.

**Status:** Not yet built. Replaces the current Relationships page. The SKILL.md should be referenced when building this page to ensure it follows the list page pattern with the container types and typography defined here.

---

## 13. Shared Component Patterns

Exact interfaces are in `references/component-api.md`. This section covers the behavioral patterns.

### Identity Bar (CSS pattern, not component)

Top of every detail page. Title + badges + actions.

- Title: `text-2xl font-semibold`
- Badges appear between title and actions
- Actions right-aligned via `ml-auto`
- Bottom border: `border-b border-border/30`
- Bottom margin: `mb-6`

### FilterBar (shared component)

Used on every list page. Search + pill filters + count. See Interactive Elements section for styling.

### PageHeader (shared component)

`h1` title + subtitle. Top of every list page.

### EmptyState (shared component)

Two uses: initial empty ("No {entities} yet") and filter empty ("No matching {entities}").

### ContactGroup / ContactRow (shared components)

Render contact lists grouped by org type. Used on partner detail, meeting detail, engagement detail. ContactRow handles name + role + title + email display.

### NoteWorkspace (notes component)

Three-mode workspace. See Meeting Detail page spec for mode descriptions. Manages its own state. Parent page provides meeting data and previous context.

### ContextSidebar (notes component)

Partner context during note-taking. Shows: partner profile summary, key contacts, scratchpad, open tasks (with owner badges and "this meeting" highlight), previous notes (scoped by engagement or series).

---

## 14. Data Display Conventions

### Formatting Utilities

All in `src/lib/format-utils.ts`:

- **Locations:** `extractCity()` on list rows, full address on detail pages
- **Meeting titles:** Always `cleanMeetingTitle()` everywhere they render
- **Compact dates:** `formatCompactDateRange()` for list rows
- **Footer dates:** `formatFooterDate()` for entity footers

### Empty Data

- **List rows:** Show nothing. An engagement with no pillar just doesn't show a badge.
- **Detail pages:** Use "—" for missing values in the right column.
- **AI content:** If synthesis doesn't exist, show a prompt to generate it — not an empty block.

### Links & Navigation

- Partner names: always `text-accent hover:underline`, linked to partner detail
- Engagement names: same treatment, linked to engagement detail
- Meeting titles: always cleaned via `cleanMeetingTitle()`, linked to meeting detail
- "Back to {Parent}" link at top of detail pages

---

## 15. Design Principles (Summary)

1. **Partner is gravity.** Everything orbits the partner.
2. **Condensed first, full on demand.** The two-version pyramid is a UX model, not just AI architecture.
3. **Show enough to decide without drilling in.** Every row and card carries enough context.
4. **One page, one job.** Don't replicate data across pages.
5. **Default to the most actionable view.** Tasks → Me. Meetings → Upcoming. Lists → expanded.
6. **AI content is structured and visually distinct.** Parse sections. Render with left-border accent. Never show raw markdown.
7. **Three container types.** Section, Row, Detail Panel. Everything fits in one.
8. **Left column dynamic, right column stable.** On every two-column page.
9. **Progressive disclosure scales with data.** Show first N, expand for more.
10. **Responsive by reduction.** Stack columns, don't rearrange. Condensed helps at every width.
11. **Fewer patterns, used consistently.** Two button styles, three container types, one hover state.
12. **Build for the future without building the future.** Right column Operational Status section accommodates Ring 3. People page placeholder exists. Pulse is specced but not built.

---

## 16. What NOT to Do

- ❌ `rounded-xl border border-border bg-surface p-4` wrapper cards on detail pages
- ❌ Three-column layouts or staggered card grids
- ❌ Collapsed-on-load for primary content (lists that should be visible)
- ❌ Badge pills for counts — use plain text
- ❌ Raw markdown tokens (`##`, `**`, `-`) shown to users
- ❌ Duplicate data across pages (partner profile on meeting detail)
- ❌ Entity-type navigation as primary workflow ("go to engagements" instead of "go to Spacelift")
- ❌ Status text badges where a dot suffices
- ❌ Hard-coded section counts or fixed layouts that break when data grows
- ❌ Horizontal scrolling on any viewport
- ❌ Multiple primary action buttons on one page
- ❌ Prose walls as the only way to consume AI content — always parse into sections

---

## 17. Future-Proofing

These items are not built yet but the UI is designed to accommodate them:

| Future Feature | Where It Slots In |
|---|---|
| **Ring 3 data** (programs, goals, funding) | Partner detail → Right column → Operational Status section expands |
| **People layer** | Replaces Relationships in Reference tier. Follows list page pattern with search + filters |
| **Pulse page** | Primary nav. Aggregates inbox count + tasks + upcoming meetings + staleness signals |
| **Financial fields on partners** | Partner detail → Right column → Operational Status section |
| **Pre-meeting briefing** | Meeting detail → Left column, above NoteWorkspace |
| **Auto-brain refresh** | Backend only — no UI change needed; brain section already renders latest |
| **Engagement-linked meetings on engagement detail** | Engagement detail → Left column → Connected Meetings section (spec ready) |

The right column Operational Status section is intentionally designed as an expandable container. When Ring 3 data arrives, it gains sub-sections for program enrollments, funding wallets, and goal progress — all using the same Section container type and sub-label typography already defined.

---

## Reference Files

- **`references/component-api.md`** — TypeScript interfaces for shared components, prop types
- **`references/entity-catalog.md`** — Entity-to-component mappings, field-by-field rendering specs
- **`references/design-tokens.md`** — Complete CSS custom properties, color palette, spacing scale

Read these for implementation detail after absorbing this document.