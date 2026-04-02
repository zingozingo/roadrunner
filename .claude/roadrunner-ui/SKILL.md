---
name: roadrunner-ui
description: UI design system reference for Roadrunner. Covers tokens, components, pages, patterns, and interaction standards. Read docs/north-star.md FIRST for vision and design decisions.
---

# Roadrunner UI Design System

This is the living design system for Roadrunner. Every UI component references this document.
Read `docs/north-star.md` FIRST for vision, UX standards, and anti-patterns.
Update this document as new patterns are established.

**Structure:** Layer 1 (visual foundations) → Layer 2 (interaction patterns) → Layer 3 (data visualization patterns).

### How to Document a Pattern

When you establish a new interaction or visualization pattern, add it to the appropriate layer:

```
### Pattern Name

**Component:** `ComponentName` (`path/to/file.tsx`)
**Used on:** List of pages/contexts where this pattern appears
**Behavior:** What it does, how it responds to user input
**Design rationale:** Why this approach was chosen over alternatives
**CSS variables / tokens:** Any theme variables this pattern uses
**Constraints:** What NOT to do — anti-patterns for this component
```

---

# Layer 1: Visual Foundations

## Design Philosophy

**Restraint over decoration.** Every pixel must earn its place. If removing an element doesn't reduce clarity, remove it.

**Typography does the work.** Size, weight, and brightness create hierarchy — not color, borders, or icons. Color is reserved for status and interaction.

**Surfaces create depth.** Three elevation levels (background → surface → elevated) replace visible borders. When a border is needed, it's barely there.

**Dark theme is native.** Not a light theme with inverted colors. Surfaces are warm dark grays with slight blue undertone. Text has three clear brightness tiers. Accent color (indigo) is used sparingly — for active states, badges, and primary actions only.

**Density is earned.** Dense pages work because every element has a purpose. Spacing is the primary organizational tool — consistent gaps create visual grouping without explicit dividers.

---

## Design Tokens

### Core Colors

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--background` | `#0f1117` | `bg-background` | Page background, deepest level |
| `--foreground` | `#e4e4e7` | `text-foreground` | Primary text, headings |
| `--surface` | `#1a1b23` | `bg-surface` | Cards, sidebar, panels |
| `--surface-hover` | `#22232d` | `bg-surface-hover` | Hover states on surfaces |
| `--border` | `#2a2b35` | `border-border` | Borders (use at reduced opacity) |
| `--muted` | `#71717a` | `text-muted` | Secondary text, labels, captions |
| `--accent` | `#6366f1` | `text-accent` / `bg-accent` | Active states, badges, primary CTA |
| `--accent-hover` | `#818cf8` | `text-accent-hover` | Hover on accent elements |

### Text Brightness Scale

Three tiers of text brightness create hierarchy without changing font size:

| Level | Class | Usage |
|-------|-------|-------|
| **Primary** | `text-foreground` | Page titles, important labels |
| **Secondary** | `text-foreground/70` | Body text, nav items, descriptions |
| **Tertiary** | `text-muted` | Labels, timestamps, metadata |
| **Quaternary** | `text-muted/60` | Subordinate items, disabled-adjacent |

### Status Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--status-active` | `#22c55e` | Active / on-track |
| `--status-blocked` | `#f59e0b` | Blocked / at-risk / overdue |
| `--status-completed` | `#8b5cf6` | Completed / done |
| `--status-archived` | `#6b7280` | Archived / inactive |

### Semantic Colors

Program types, event types, and confidence levels have dedicated tokens in `globals.css`. See the CSS file for the full list.

### Typography

| Element | Classes | Notes |
|---------|---------|-------|
| Page title | `text-xl font-semibold text-foreground` | One per page, top-left |
| Page subtitle | `text-sm text-muted` | Below title, counts/context |
| Section header | `text-xs font-medium uppercase tracking-wider text-muted/60` | Collapsible sections |
| Body text | `text-sm text-foreground/70` | Default readable text |
| Label | `text-xs text-muted` | Form labels, metadata keys |
| Financial data | `font-mono text-sm` | Numbers, currency, percentages |
| Badge text | `text-[11px] font-medium` | Inside badges |
| Nav item | `text-[13px]` | Sidebar navigation |

**Fonts:** Geist Sans (body), Geist Mono (financial data, numbers, code)

---

## Spacing System

All spacing uses the 4px scale. No exceptions.

| Value | Tailwind | Usage |
|-------|----------|-------|
| 4px | `gap-1`, `p-1` | Tight inline spacing (badge padding, icon gaps) |
| 8px | `gap-2`, `p-2` | Default item spacing within groups |
| 12px | `gap-3`, `p-3` | Compact card padding, section internal spacing |
| 16px | `gap-4`, `p-4` | Standard card padding, section margins |
| 24px | `gap-6`, `mt-6` | Major section breaks, tier separation |
| 32px | `gap-8`, `mt-8` | Page-level section spacing |

---

## Surface Elevation

Three levels of elevation create depth without visible borders:

| Level | Token | Usage |
|-------|-------|-------|
| **Ground** | `bg-background` | Page background |
| **Surface** | `bg-surface` | Sidebar, cards, panels, rows |
| **Elevated** | `bg-surface-hover` | Modals, dropdowns, hover states |

When borders are needed, use `border-border/50` (half opacity). Full-opacity borders (`border-border`) are reserved for explicit visual boundaries like the sidebar edge.

---

## Layout System

### PageContainer

**Component:** `PageContainer` (`src/components/layout/PageContainer.tsx`)
**Used on:** Every page in the app (all 13 pages)
**Behavior:** Fluid container with `max-w-[1600px] mx-auto px-6 py-6 lg:py-8`. Pages control their internal layout — PageContainer only handles max-width and horizontal padding.
**Design rationale:** Replaces ad-hoc `mx-auto max-w-*` patterns that varied inconsistently across pages. A single layout primitive ensures every page has the same outer shell. At 1280px viewport (13" laptop), content area is ~1008px after sidebar and padding. At 1440px, ~1168px.
**Constraints:** No width overrides on PageContainer. If a page needs different internal width behavior, constrain the internal content, not the container.

### Root Layout Shell

**Component:** Root layout (`src/app/layout.tsx`)
**Behavior:**
- `<div className="flex min-h-screen bg-background">` wraps sidebar + main
- `<main className="flex-1 min-w-0 overflow-y-auto">` wraps page content
- `min-w-0` on `<main>` is **required** — prevents flex child from overflowing when content has intrinsic minimum width
**Constraints:** Never remove `min-w-0` from main — it prevents horizontal overflow on all pages.

### Two-Column Page Pattern

Used on: Today page, Meeting detail, Engagement detail.

**Structure:** `grid grid-cols-1 lg:grid-cols-[Xfr_Yfr] gap-6` with `min-w-0` on both grid children.

**Critical rule:** Grid children must have `min-w-0`. CSS Grid defaults to `min-width: auto` which prevents children from shrinking below their content's intrinsic minimum width. Without `min-w-0`, long text will force horizontal overflow.

**Right column separator:** `lg:border-l lg:border-border/20 lg:pl-6` — subtle vertical border with 24px padding. Don't double-space with both `gap` and `pl` at large values.

**Proportions by page type:**
| Page | Grid | Rationale |
|------|------|-----------|
| Today | `11fr_9fr` (55/45) | Meetings need room for partner+title; tasks need room for descriptions |
| Meeting detail | `3fr_2fr` (60/40) | Workspace is the hero; context sidebar is reference |
| Engagement detail | `3fr_2fr` (60/40) | Same pattern as meeting detail |

### Section Pairing Pattern

**Used on:** Partner detail page
**Structure:** `grid grid-cols-1 lg:grid-cols-2 gap-6` with `min-w-0` on grid children.
**When to pair:** Complementary reference sections that are both short lists or metadata. Examples: Program Enrollments + Strategic Goals, Funding + Event Participations, Solution Profile + Operational Status.
**When NOT to pair:** Content-heavy sections (Brain, Engagements, Tasks, Meetings) or interactive sections (People, Scratchpad) that benefit from full width.
**Design rationale:** Reduces scroll depth on data-rich partners without sacrificing readability. Stacks to single column below 1024px.

---

## Component Patterns

### Sidebar

Three-tier navigation without section labels. Hierarchy communicated through text brightness alone. Vertical distribution: daily-use items (Primary, Secondary) at top, reference catalogs (Tertiary) anchored at bottom via `flex-1` spacer. No dead space — the sidebar feels intentionally composed at any viewport height.

- **Width:** 224px (`w-56`)
- **Background:** `bg-surface` with `border-r border-border/40`. Solid color, no gradients.
- **Brand:** `text-[15px] font-semibold tracking-tight text-foreground`, `mb-6`
- **Layout:** `flex h-full flex-col px-3 pt-5 pb-4` — Primary and Secondary grouped at top, `flex-1` spacer, Tertiary at bottom
- **Tier spacing:** 24px (`mt-6`) between Primary and Secondary
- **Item spacing:** 2px (`gap-0.5`) within tiers
- **Item padding:** `px-3 py-1.5` (32px row height)
- **Item shape:** `rounded-md`

| Tier | Items | Idle text | Hover | Active |
|------|-------|-----------|-------|--------|
| Primary | Today, Partners, Inbox | `text-foreground/80` | `text-foreground bg-white/[0.04]` | `text-accent bg-accent/[0.08]` |
| Secondary | Tasks, Meetings | `text-muted` | `text-foreground/70 bg-white/[0.04]` | `text-accent bg-accent/[0.08]` |
| Tertiary | Programs, Events | `text-muted/60` | `text-muted bg-white/[0.04]` | `text-accent bg-accent/[0.08]` |

Badge (Inbox count): `h-[18px] min-w-[18px] rounded-full bg-accent text-[10px] font-semibold text-white`

### Page Header

Every page has a consistent header pattern:

```
[Title]                              [Actions]
[Subtitle / count]
```

- Title: `text-xl font-semibold text-foreground`
- Subtitle: `text-sm text-muted mt-1`
- Actions: right-aligned, accent-colored primary CTA
- Bottom margin: 32px before content

### Card

The default container for grouped content:

- `bg-surface rounded-lg border border-border/50`
- Padding: `p-4` standard, `p-3` compact
- No shadow (shadows don't work well on dark themes)

### List Row

Scannable rows for partners, tasks, meetings, etc:

- Full-width click target
- `hover:bg-surface-hover transition-colors`
- Row height: consistent within a list (40-44px typical)
- Layout: title left-aligned, metadata right-aligned
- Separator: `border-b border-border/30` between rows, or no separator if bg alternation is used

### Badge

Consistent across all pages:

- Shape: `rounded-full` for status, `rounded-md` for type/category
- Size: `text-[11px] font-medium px-2 py-0.5`
- Color: semantic background at 15% opacity + full semantic text
- Example: `bg-status-active/15 text-status-active`

### Section (Collapsible)

Used on detail pages for progressive disclosure:

- Header: `text-xs font-medium uppercase tracking-wider text-muted/60` with optional count
- Chevron icon for expand/collapse
- Content padding: `pt-3` below header
- Section gap: `mt-6` between sections

### Empty State

Clean, not broken-looking:

- Centered text in the section area
- `text-sm text-muted/60`
- No icons, no illustrations — just a brief message
- Example: "No strategic goals set" or "No upcoming events"

---

## Interactive States

### Buttons

| Type | Idle | Hover | Disabled |
|------|------|-------|----------|
| Primary | `bg-accent text-white rounded-md px-4 py-2 text-sm font-medium` | `bg-accent-hover` | `opacity-50 cursor-not-allowed` |
| Secondary | `bg-surface border border-border/50 text-foreground/70 rounded-md px-4 py-2 text-sm` | `bg-surface-hover text-foreground` | `opacity-50 cursor-not-allowed` |
| Ghost | `text-muted text-sm` | `text-foreground` | `opacity-50` |
| Danger | `text-red-400 text-sm` | `text-red-300 bg-red-500/10` | `opacity-50` |

**Labels are verbs:** "Generate Summary", "Save & Lock", "Route to Engagement", "Create Engagement". Never "Submit", "Go", "OK".

### Loading States

- **Short (<1s):** Subtle inline spinner, 16px, `text-muted`
- **Medium (1-5s):** Contextual message + spinner ("Generating summary...")
- **Long (5s+):** Progress indicator with steps
- **Button loading:** Replace label with verb-based text ("{Verb}ing..."), keep button width stable, `disabled opacity-50 pointer-events-none`

See **Mutation Lifecycle Framework** (Layer 2) for the complete specification of how loading states, error handling, and confirmation dialogs compose across all 4 mutation classes.

### Confirmation Dialogs

For destructive actions (delete, discard, complete):

- Modal overlay: `bg-black/50`
- Dialog: `bg-surface rounded-lg border border-border/50 p-6 max-w-md`
- Title: clear action description
- Body: consequences of the action
- Actions: Cancel (secondary) + Confirm (danger or primary)

### Navigation Safety

If unsaved changes exist:
- Block navigation with `beforeunload` + Next.js route interception
- Modal: "You have unsaved changes. Leave anyway?"
- Actions: "Stay" (primary) + "Leave" (ghost/danger)

---

## Data Fetching Patterns

**Server components (reads):** Query Supabase directly via `db/` functions with `Promise.all`:

```typescript
const [{ data: meetings }, { data: engagements }] = await Promise.all([
  db.from("meetings").select("*").eq("partner_id", id),
  db.from("engagements").select("*").eq("partner_id", id),
]);
```

**Ring 3 data:** Import from `@/lib/db`: `getPartnerGoals`, `getPartnerProgramEnrollments`, `getPartnerEventParticipations`, `getPartnerMpoppFunding`, `getPartnerMdfFunding`.

**Client components (writes):** Use `fetch()` to API routes. Interactive components (BrainSynthesis, NoteWorkspace, InboxClient) handle their own mutations.

**Financial data:** 11 numeric columns on partners. Attainment % and YoY growth computed in UI. Use `font-mono` for all numbers.

**Force-dynamic:** Every page exports `export const dynamic = "force-dynamic"` for real-time data.

---

## Pages

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Today — daily launchpad | Redesigning |
| `/partners` | Partner directory by segment | Redesigning |
| `/partners/[id]` | Partner dossier | Redesigning |
| `/engagements/[id]` | Engagement detail (via partner) | Redesigning |
| `/meetings` | Cross-partner meetings | Redesigning |
| `/meetings/[id]` | Meeting detail + notes workspace | Redesigning |
| `/tasks` | Cross-partner task management | Redesigning |
| `/inbox` | Email/invite triage | Polish pass |
| `/programs` | Program catalog | Light refresh |
| `/programs/[id]` | Program detail | Light refresh |
| `/events` | Event catalog | Light refresh |
| `/events/[id]` | Event detail | Light refresh |

**Deleted:** `/engagements` (list), `/relationships` (dissolved), `/notes/*` (legacy)

---

## Anti-Patterns (Never Do These)

- Gradient text or backgrounds
- Skeleton loaders that flash < 200ms
- Toast notifications that auto-dismiss before readable
- Modals on top of modals
- Horizontal scrolling in data tables
- Truncated text without expand/tooltip
- Color as the only differentiator (always pair with text)
- Raw "..." as loading indicator
- `console.log` in production components
- Inline styles
- Hardcoded hex colors (use CSS variables)
- Spacing values outside the 4px scale
- Section labels that say "No data" with broken-looking empty UI

---

# Layer 2: Interaction Patterns

Reusable behavior patterns for interactive elements. Any pattern established here applies system-wide — not just the page where it was first built.

## Search

### Inline Search Bar

**Component:** `FilterBar` (`src/components/layout/FilterBar.tsx`) — reusable search + filter bar
**Used on:** Meetings list, Tasks page
**Behavior:**
- Full-width search input with magnifying glass icon
- `placeholder="Search meetings..."` / `"Search tasks..."` — contextual placeholder
- Client-side filtering via `useMemo` — dataset is hundreds, not thousands
- No debounce needed at current scale; add debounce if dataset exceeds ~500
- Search filters across multiple fields simultaneously (title + partner name for meetings; description + partner name for tasks)
- Results update instantly as user types
**Design rationale:** Client-side search is fast enough for a single-user app with <100 entities per list. Server-side search is overhead without benefit at this scale.
**CSS variables / tokens:** Input uses `bg-surface border-border text-foreground` with `text-sm`
**Constraints:** Don't add keyboard shortcuts (Cmd+K) until there's a global search context. Don't add "clear" buttons — backspace is universal.

## Filters

### Pill Toggle Filters

**Component:** Inline filter pills on Meetings list, owner filter on Tasks page
**Used on:** Meetings list (meeting type filter), Tasks page (owner filter)
**Behavior:**
- Row of rounded-full pills: `text-[11px] font-medium px-3 py-1 rounded-full`
- "All" pill is always first, selected by default
- Active pill: `bg-accent text-white`; inactive: `bg-surface border border-border/50 text-muted hover:text-foreground`
- Single-select — clicking one deselects the previous
- Filters compose with search: search narrows within filtered results
- Count updates to reflect filtered results (e.g., "49 meetings" → "14 meetings" when filtered)
**Design rationale:** Pill filters are faster than dropdowns for small option sets (<12 options). The meeting type list (10 types) fits comfortably in one row at 1440px.
**Constraints:** Don't use pill filters for option sets >12 — switch to a dropdown. Don't allow multi-select (ambiguous UX with no clear "selected count" indicator).

### Flat/Grouped Toggle

**Component:** Inline toggle on Tasks page
**Used on:** Tasks page (group by partner vs flat list)
**Behavior:**
- Two text buttons side-by-side: "Flat" / "Grouped"
- Active: `text-foreground`; inactive: `text-muted hover:text-foreground`
- Persists in component state only (no URL params)
- Grouped view shows partner name as section header with `text-xs font-medium text-muted/60`
**Design rationale:** Simple toggle for two modes. No need for a select/dropdown.
**Constraints:** Don't persist to URL or localStorage — this is a quick toggle, not a saved preference.

## List Capping & Progressive Disclosure

### Section Cap with "View All"

**Component:** `Section` component on partner detail page
**Used on:** Partner detail (engagements capped at 8, tasks at 6, meetings at 8)
**Behavior:**
- Lists show first N items with `slice(0, N)`
- If items exceed cap, show `+{remaining} more` text below in `text-xs text-muted`
- Optional `viewAllHref` prop renders a "View all" link in the section header: `text-xs text-muted hover:text-foreground`
- Cap counts: engagements 8, tasks 6, meetings 8 (partner detail); tasks 10 (Today page)
**Design rationale:** Long lists (38 tasks) bury everything below them. Caps keep the page scannable while providing a clear path to the full list.
**Constraints:** Always provide "View all" for capped lists. Never cap without a path to the full dataset.

### Collapsible Sections (HTML `<details>`)

**Component:** Native `<details>` element with consistent styling
**Used on:** Meeting detail (Calendar notes), Engagement detail (Timeline when >5 items), Partner detail (Engagement contributors)
**Behavior:**
- `<summary>` styled with chevron SVG: `group-open:rotate-90` transition
- Header: `text-xs font-semibold uppercase tracking-wider text-muted`
- Chevron: 14x14 SVG, `text-muted/50`, rotates 90° on open
- Content padding: `mt-2 ml-[22px]` (aligned past chevron)
- Default state varies: most start closed, Timeline starts open when ≤5 items
**Design rationale:** Native `<details>` is accessible, needs no JS, and matches the progressive disclosure philosophy. Reserve for secondary content that some users need sometimes, not primary content.
**Constraints:** Don't nest collapsible inside collapsible. Don't use for primary content — if most users need it, show it by default.

### Upcoming/Past Temporal Groups

**Component:** Inline on Meetings list
**Used on:** Meetings list page
**Behavior:**
- Meetings split into "UPCOMING" (future) and "PAST" sections
- UPCOMING is open by default; PAST is collapsed by default (via `<details>`)
- Section header: `text-xs font-medium uppercase tracking-wider text-muted/60` with count badge
- Within UPCOMING, meetings grouped by date with date shown only on first row of each group
**Design rationale:** Most visits to /meetings are about upcoming meetings. Past meetings are reference material. Default collapsed keeps the page focused.
**Constraints:** Always show both sections — even if UPCOMING is empty, show the empty section header.

## Confirmation & Destructive Actions

See **Mutation Lifecycle Framework** below for the canonical Class 3 (Destructive) specification. The patterns here describe the visual implementation.

### Browser `window.confirm()` for Destructive Actions

**Component:** Used directly in client components
**Used on:** Tasks page (delete task), Inbox (delete message)
**Behavior:**
- `window.confirm("Delete task: \"...\""?)` — native browser dialog
- Returns boolean; action proceeds only on `true`
- Optimistic UI removal: item removed from state immediately, reverted on API error
**Design rationale:** Native confirm is sufficient for a single-user app. The cost of a custom modal for confirmation is not justified when native works and is universally understood.
**CSS variables / tokens:** N/A (native dialog)
**Constraints:** Use for delete/discard only. Don't use for reversible actions (status toggle, linking). If we need more context in the dialog (showing consequences), upgrade to a custom modal per SKILL.md Layer 1 confirmation dialog spec.

### Danger-Styled Actions

**Component:** Various action buttons across pages
**Used on:** Engagement detail (Delete button), Meeting detail (MeetingActions), RecurrenceEditor (End Series)
**Behavior:**
- Delete/destructive buttons: `text-red-400 hover:text-red-300` or `bg-red-500/10`
- Positioned separately from primary actions (right side, after safe actions)
- "End Series" uses `text-muted hover:text-red-400` — escalating visual severity on hover
**Design rationale:** Destructive actions should be findable but not prominent. The hover color escalation serves as a micro-confirmation.
**Constraints:** Never make a destructive action the primary (accent-colored) button.

## Mutation Lifecycle Framework

Every user-triggered mutation in the app falls into one of four classes. This framework is the canonical definition of how mutations behave — loading, error handling, confirmation, and scope resolution. No mutation surface should deviate from these patterns.

**Shared utilities:**
- **`useMutation`** — `src/hooks/useMutation.ts` — returns `{ execute, isLoading, error, clearError }`. Generic async wrapper with loading and error tracking.
- **`InlineError`** — `src/components/shared/InlineError.tsx` — compact red-tinted inline error display. Auto-dismisses after 8 seconds. Props: `message`, `onDismiss`.
- **`useNavigationGuard`** — `src/hooks/useNavigationGuard.ts` *(planned)* — blocks navigation while mutations are in-flight. See "Navigation Guard During Mutations" below.

### Class 1 — Optimistic Toggle

**Used for:** Checkbox, status pill, inline toggle — any action that feels instant and is reversible.
**Examples:** Task checkbox (Today, Tasks page), enrollment status, event participation status.

**Behavior:**
1. UI updates immediately (before API call)
2. API call fires in background
3. On failure: revert UI state to previous value + show `InlineError` with message
4. No confirmation needed (action is reversible)
5. No loading state on the trigger (instant feel)

**Error handling:** The revert-on-failure pattern means the component manages its own state. The `catch` block must (a) revert the optimistic state, AND (b) surface the error via `InlineError`. `console.error` alone is never sufficient.

**Constraints:** Don't use optimistic toggle for irreversible actions. If toggling off requires confirmation (e.g., completing a series), that's Class 3.

---

### Class 2 — Async Submit

**Used for:** Save, create, assign, link, synthesize — any action that takes visible time and creates/modifies data.
**Examples:** Meeting create, engagement save, brain synthesize, inbox assign, recurrence save, engagement link, scratchpad add.

**Behavior:**
1. Use `useMutation` hook (or equivalent loading/error state management)
2. Loading state activates (see "Mutation Loading States" below for which level to use)
3. On success: UI updates (router.refresh, state update, or optimistic add)
4. On failure: `InlineError` appears near the action, trigger re-enables for retry

**Loading label convention:** Always verb-based. "Saving...", "Creating...", "Deleting...", "Assigning...", "Linking...", "Synthesizing...". Never "Loading..." or "Please wait..." or "Working...".

**Error placement:** `InlineError` renders below the trigger button or inside the card/section where the action lives. Never a toast. Never a page-level banner for component-level errors.

**Constraints:** Don't use Class 2 for toggles (those are Class 1). Don't skip the loading label — a disabled button without text change looks broken.

---

### Class 3 — Destructive

**Used for:** Delete, discard, end series, unlink, skip — any action that removes data or is hard to reverse.
**Examples:** Meeting delete, inbox discard, engagement delete, task delete, series end, engagement unlink, meeting skip.

**Behavior:**
1. Confirmation FIRST:
   - Simple cases: `window.confirm("Delete this task?")` — native browser dialog
   - Contextual cases: `ConfirmDialog` component showing what will be affected (e.g., "Delete engagement and all linked messages?")
2. After confirmation: follows Class 2 pattern (loading state + error handling)
3. On success: item removed from UI (optimistic removal or router.refresh)
4. On failure: `InlineError` appears, item remains in UI for retry

**Button styling:** `text-red-400 hover:text-red-300` or `text-muted hover:text-red-400` (escalating severity). Never accent-colored. Always positioned separately from safe actions.

**Constraints:** Every destructive action must have a confirmation step. No exceptions. If the action affects multiple records (e.g., deleting a partner cascades to engagements), the confirmation must mention the cascade.

---

### Class 4 — Scoped

**Used for:** Actions that affect multiple records where the scope must be resolved before execution.
**Examples:** Inbox discard (message group), scope-aware meeting edit (`this_and_future`), series end (affects future meetings).

**Behavior:**
1. Resolve the full scope BEFORE executing — e.g., `getMessagesForInboxItem()` for inbox groups, series siblings for scope-aware edits
2. Scope resolution itself can fail — handle that error (show InlineError, don't proceed)
3. Once scope is resolved, follow Class 2 (non-destructive) or Class 3 (destructive) pattern
4. If the scope is visually non-obvious, communicate it: "This will affect 5 messages" or "Changes apply to this and all future meetings"

**Constraints:** Never execute a scoped action on a single record when the intent is the group. The inbox discard bug (deleting 1 of N messages) is the canonical anti-pattern.

---

### Mutation Loading States

Two levels of loading feedback. Use the right one for the context.

**Component-level loading (default):**
- The trigger button shows loading label (`"{Verb}ing..."`) + `disabled opacity-50 pointer-events-none`
- Button width must remain stable (use `min-w` or consistent label length)
- **When to use:** Single button action — save, synthesize, delete confirmation, link. The mutation target is one small element in a toolbar or form.
- **Examples:** "Save" → "Saving...", "Create Meeting" → "Creating...", "Generate Synthesis" → "Synthesizing..."

**Row/card-level loading (for list item mutations):**
- When a mutation affects a whole item in a list, the ENTIRE row/card enters loading state
- Row gets: `opacity-60 pointer-events-none` on all content
- Action buttons are REPLACED (not relabeled) by a status line: inline spinner (16px, `text-muted animate-spin`) + action text (`text-sm text-muted`)
- Status text describes what's happening: "Discarding...", "Assigning to engagement...", "Creating engagement..."
- The row cannot be interacted with while loading — no accidental double-clicks, no confusion about state
- **When to use:** List item action where the whole row is the context — inbox route/discard, task delete from list, bulk operations.
- **Examples:** Inbox item being discarded, task being deleted from /tasks, engagement being merged.

**Choosing the right level:**
| Context | Level | Rationale |
|---------|-------|-----------|
| Button in a toolbar/header | Component | Only the button needs to show state |
| Button in a form/modal | Component | Form stays visible for context |
| Action on a list row (inbox, tasks) | Row/card | The whole row is the target — make it unmistakable |
| Inline toggle (checkbox, status pill) | Neither (Class 1) | Optimistic — no visible loading |

---

### Action Button Group Spec

How to lay out multiple action buttons on the same item (list rows, card headers, panel footers).

**Layout:** Right-aligned in a row, `flex items-center gap-3 shrink-0`.

**Ordering convention (left to right):**
1. **Safe/routing actions** — "Assign", "Link" — `text-xs text-muted hover:text-foreground`
2. **Creation actions** — "New", "Create" — `text-xs text-accent hover:text-accent-hover` (or `bg-accent text-white rounded-md px-3 py-1.5 text-sm` if it's the primary CTA)
3. **Destructive actions** — "Discard", "Delete" — `text-xs text-muted hover:text-red-400` (always rightmost)
4. **Cancel/dismiss** — "Cancel" — `text-xs text-muted hover:text-foreground` (only in expanded panels, not in the collapsed row)

**Sizing:** All action buttons in a group: `text-xs` or `text-sm` (consistent within the group), `min-h-[32px]` touch target (achieved via padding or line-height).

**Overflow rule:** If there are more than 4 visible actions, move the less common ones into an overflow menu (`⋮` button, `text-muted hover:text-foreground`). The overflow menu is a simple dropdown, not a modal.

**Disabled state during mutations:** All buttons in the group get `disabled:opacity-50` when any mutation in the group is in-flight. This prevents double-submissions and makes it clear the UI is busy.

**Constraints:** Destructive actions are ALWAYS rightmost and visually distinct. Never place a destructive action first or style it as the primary button. Never mix `text-xs` and `text-sm` within the same action group.

---

### Navigation Guard During Mutations

Any page with mutations MUST block navigation while an async operation is in-flight. This prevents data loss from accidental back-button clicks, sidebar navigation, or page reload during a multi-second operation (e.g., AI synthesis, engagement creation with Airtable push).

**Hook:** `useNavigationGuard(blocked: boolean)` *(planned: `src/hooks/useNavigationGuard.ts`)*

**Three interception points:**
1. `beforeunload` — browser close, reload, or external navigation. Standard `event.preventDefault()`.
2. `popstate` — browser back/forward button. Push current URL back to prevent navigation.
3. Sidebar/internal link click — Next.js `router.push`. Intercept via `useEffect` on route change or wrapping navigation calls.

**When blocked and user tries to navigate:**
- Show modal: "Operation in progress. Leaving now may cause data loss."
- Actions: "Stay" (primary accent button) + "Leave" (ghost/danger)
- Modal uses same ConfirmDialog component as other confirmations

**Usage:** Components pass `busyAction !== null` or `isLoading` as the `blocked` flag:
```typescript
useNavigationGuard(busyAction !== null);
```

**Guard drops automatically** when the mutation completes (blocked becomes false). No manual cleanup needed.

**Relationship to `useUnsavedChanges`:** These are separate concerns. `useUnsavedChanges` protects dirty form state (user has typed but not saved). `useNavigationGuard` protects in-flight mutations (user has clicked save and the request is pending). A page can use both — they compose independently. If both are active, the mutation guard takes priority (its message is more urgent).

**Constraints:** Don't block navigation for Class 1 (optimistic toggle) — those complete instantly. Only block for Class 2/3/4 where the operation takes visible time. Don't leave the guard active after the component unmounts — clean up in `useEffect` return.

---

### Universal Rules

1. **No silent failures.** Every `catch` block must surface the error to the user via `InlineError`. `console.error` is allowed for logging but never as the ONLY error handling.
2. **Loading labels are verb-based.** "Saving...", "Creating...", "Deleting...". Never "Loading..." or "Please wait...".
3. **`useMutation` is the default.** Every Class 2/3/4 mutation should use the `useMutation` hook unless there's a specific reason not to (e.g., Class 1 optimistic toggles that manage their own state).
4. **InlineError placement.** Below the trigger button or inside the card/section where the action lives. Never a toast. Never a page-level banner for component-level errors.
5. **Destructive actions are never the primary button.** Always `text-red-400` or secondary styling. Always separated from safe actions.
6. **Scope before execute.** For Class 4 actions, always resolve the full target set before mutating. Never assume the caller's ID is the only affected record.
7. **Guard navigation during mutations.** Every page with Class 2/3/4 mutations must use `useNavigationGuard` to block navigation while operations are in-flight.

### Adoption Checklist

For each mutation surface, verify:
- [ ] Classified as Class 1/2/3/4
- [ ] Loading state present and uses correct level — component vs row/card (Class 2/3/4)
- [ ] Error surfaced to user via InlineError (all classes)
- [ ] Confirmation present (Class 3)
- [ ] Scope resolved before execution (Class 4)
- [ ] Button label follows verb convention (Class 2/3/4)
- [ ] InlineError positioned near the trigger, not at page level
- [ ] Action button group follows ordering spec (safe → create → destructive)
- [ ] Navigation guard active during in-flight mutations (useNavigationGuard)
- [ ] Destructive action is rightmost and never primary-styled

---

## Forms & Creation

### Modal Creation (New Meeting)

**Component:** Inline modal in `MeetingsClient`
**Used on:** Meetings list page ("+ New Meeting" button)
**Behavior:**
- Fixed overlay: `bg-black/50` backdrop + centered modal `bg-surface rounded-lg border`
- Form fields: Partner dropdown (required) → auto-title from partner + type → meeting type → date → recurrence toggle → pattern/day picker
- Auto-title: `"{Partner} — {Type}"` generated on partner+type selection, editable
- Recurrence toggle: checkbox reveals RecurrenceEditor inline (pattern + day + preview + end date)
- See RecurrenceEditor pattern below for editor details
- Submit: "Create Meeting" button, disabled while submitting, shows "Creating..."
- Cancel: "Cancel" text button, closes modal
- Close on backdrop click or Escape key
**Design rationale:** Modal keeps the user in context on the meetings list. The auto-title convention ensures consistent naming across all meetings.
**Constraints:** Don't stack modals. Don't auto-close on submit — let the router.refresh() update the list, then close.

### Inline Creation (Tasks, Engagement from EngagementLinker)

**Component:** Inline forms within the page flow
**Used on:** Tasks page (add task form), EngagementLinker (create new engagement)
**Behavior:**
- Form appears inline (not modal) below a trigger button
- Required fields marked implicitly (submit disabled until filled)
- Input styling: `rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground`
- Submit: full-width accent button `bg-accent text-white rounded-lg`
- Loading state: button text changes to "Creating..." with `disabled:opacity-50`
- On success: form clears, new item appears in list
- EngagementLinker has a special "Create & Link" flow: creates engagement → links to meeting → seeds current_state from note condensed
**Design rationale:** Inline creation avoids modal overhead for simple entities. The EngagementLinker's create flow is intentionally multi-step because it's a rare action that benefits from visibility.
**Constraints:** Don't add inline creation for entities that need >3 fields. Those should use modals.

### Entity Picker (EngagementLinker)

**Component:** `EngagementLinker` (`src/components/shared/EngagementLinker.tsx`)
**Used on:** Meeting detail page (engagement field), Tasks page (engagement linker)
**Behavior:**
- Three states: unlinked (dashed border button "Link to engagement"), picker open (scrollable list), linked (name link + × unlink)
- Picker: partner-filtered list of existing engagements + "Create new engagement" option at top with + icon
- Cache: engagement list fetched once per session via `useRef` cache, invalidated on create/unlink
- Linked display: accent-colored name link to engagement detail page + small × unlink button
- Unlink: `text-muted hover:text-red-400` × button, no confirmation (reversible action)
**Design rationale:** The picker pre-filters by partner because cross-partner engagement linking is never correct. "Create new" at top because new engagements are common when linking meetings.
**Constraints:** Don't add search within the picker — partner engagement lists are small (<10). Don't show archived engagements.

### Recurrence Editor

**Component:** `RecurrenceEditor` (`src/components/shared/RecurrenceEditor.tsx`)
**Used on:** Meeting detail page (standalone meetings — "Make recurring"), Create meeting modal (recurring toggle)
**Behavior:**
- Pattern dropdown (Weekly/Biweekly/Monthly/Quarterly) with labeled `text-[10px]` header
- Day selector: day-of-week dropdown for weekly/biweekly, day-of-month number input for monthly/quarterly
- Day auto-populates from meeting date on open, but is always editable
- Preview: "Next 3: Apr 6 → Apr 13 → Apr 20" — updates live on pattern/day change
- End date hidden by default: "Recurs indefinitely" + accent "Add end date" link
- Save button: full-width accent, shows "Saving..." while in flight
- On save: sets recurrence_pattern, anchor_day, series_id on the meeting; router.refresh()
**Design rationale:** The editor shows only what matters (pattern, day, preview) with progressive disclosure for the rare end-date case. Same component works in both create and edit contexts.
**Constraints:** Don't show the editor for series meetings — SeriesDisplay handles those. The editor is for standalone → series conversion and create flows only.

## Navigation & Linking

### Back Links (Breadcrumb)

**Component:** Inline `<Link>` at top of detail pages
**Used on:** Meeting detail ("← Meetings"), Engagement detail ("← Back to {Partner}"), Partner detail ("← Partners")
**Behavior:**
- Small chevron-left SVG (14x14) + text label
- `text-xs text-muted hover:text-foreground transition-colors`
- `mb-4` spacing before the page title
- Links to the logical parent: meetings → /meetings, engagement → /partners/{id}, partner → /partners
- Engagement breadcrumb links to the partner page (not an engagements list, which doesn't exist)
**Design rationale:** Back links provide context ("where did I come from?") without a full breadcrumb trail. Single-level back is sufficient because navigation is shallow (max 3 levels).
**Constraints:** Always link to the logical parent, not browser history. Don't add multi-level breadcrumbs — the sidebar provides global navigation.

### Entity Reference Links

**Component:** Inline `<Link>` elements throughout the app
**Used on:** Everywhere entities reference other entities
**Behavior:**
- Entity name as accent-colored link: `text-sm font-medium text-accent hover:underline`
- Partner names on meeting list, engagement list, engagement detail, meeting detail
- Engagement names on task provenance, meeting detail
- Clicking navigates to the entity's detail page
**Design rationale:** Every entity name that refers to another entity should be clickable. The user should never see a name and wonder "can I go there?"
**Constraints:** Don't make entity names clickable if there's no detail page for that entity type. Don't use `target="_blank"` for internal links.

### Slide-Over Panel

**Component:** `SlideOverPanel` (`src/components/shared/SlideOverPanel.tsx`)
**Used on:** Partner detail page (Partner Reference Panel — Solution Profile, Operational Status, Scratchpad)
**Behavior:**
- Right-aligned panel: `w-[450px] max-w-[90vw]`, slides in from right
- Backdrop: `bg-black/40`, click to close
- Escape key to close
- Tab bar at top: underline-style tabs (`border-b-2 border-accent` on active)
- Content area: scrollable, `p-6`
- Portal-rendered via `createPortal(document.body)` to avoid z-index issues
**Design rationale:** Slide-overs are for reference content that the user wants alongside the main view — not content that replaces the view. Used for "deep reference" sections on partner detail (Solution Profile, Operational Status, Scratchpad) that would make the page too long if inline.
**Constraints:** Don't put primary actions in slide-overs. Don't nest slide-overs. Max 4 tabs — more than that needs a dedicated page.

---

# Layer 3: Data Visualization Patterns

Patterns for rendering complex information visually. Status indicators, timelines, financial displays, and any component whose purpose is to help the user see patterns in data.

## Status Indicators

### Status Dot

**Component:** Inline `<span>` with `h-2 w-2 rounded-full` or `h-1.5 w-1.5 rounded-full`
**Used on:** Meeting detail (identity bar), Engagement detail (identity bar + details), Partner detail (engagement rows)
**Behavior:**
- Small colored circle indicating entity status
- Meeting statuses: scheduled=`bg-accent`, completed=`bg-status-active`, cancelled=`bg-status-archived`, no_show=`bg-status-blocked`
- Engagement statuses: active=`bg-emerald-500`, planned=`bg-blue-400`, blocked=`bg-amber-500`, completed=`bg-violet-500`, archived=`bg-zinc-500`
- Paired with `title={status}` for accessibility
- 2x2px in identity bars, 1.5x1.5px in inline detail displays
**Design rationale:** Dots provide instant visual status without text label overhead. Color + position (always left of entity name) makes status scannable in lists.
**Constraints:** Always pair dots with accessible title attribute. Never use dot color as the only status indicator — context (position, section name) provides redundancy.

### Type/Category Badges

**Component:** Inline `<span>` badges
**Used on:** Meeting list/detail (meeting type), Partner detail (segment, program enrollment type/status), Engagement detail (pillar)
**Behavior:**
- Shape: `rounded-full` for all badges
- Size: `text-[11px] font-medium px-2 py-0.5`
- Meeting type badges: `bg-accent/10 text-accent/70`
- Pillar badges: `PillarBadge` component with pillar-specific colors
- Enrollment status: color-coded text (Approved=`text-status-active`, In Progress=`text-status-blocked`, else `text-muted`)
- Program enrollment type: `bg-accent/8 px-2 py-0.5 text-[11px] font-medium text-accent/70`
**Design rationale:** Badges provide categorization without taking vertical space. Consistent size and shape across all badge types creates visual harmony.
**Constraints:** Don't stack multiple badges next to each other (max 2-3 per row). Don't use badges for long text — if it doesn't fit in ~15 characters, use inline text instead.

### Recurrence Indicator (↻ Icon)

**Component:** Inline SVG (16x16 or 14x14 recurrence arrows)
**Used on:** Meetings list, Today page (today's meetings + upcoming), Partner detail (recent meetings)
**Behavior:**
- SVG with two curved arrow paths, `stroke="currentColor" strokeWidth="1.5"`
- Color: `text-muted/70` — subtle, not attention-grabbing
- Truth source: `meeting.recurrence_pattern || meeting.series_id` — shows for both roots and children
- Positioned left of meeting title or in the right metadata column
**Design rationale:** The ↻ icon is universally understood as "recurring." Muted color prevents it from competing with meeting titles.
**Constraints:** Don't add tooltip text — the icon is self-explanatory. Don't change size between contexts (14x14 everywhere).

### Owner Badges (Tasks)

**Component:** Inline colored badges on task rows
**Used on:** Partner detail tasks, Tasks page
**Behavior:**
- Four owner types with distinct colors:
  - Me: `bg-accent/10 text-accent`
  - Internal: `bg-status-blocked/10 text-status-blocked`
  - Partner: `bg-status-active/10 text-status-active`
  - Third Party: `bg-status-completed/10 text-status-completed`
- Size: `rounded-full px-2 py-0.5 text-[11px] font-medium`
- Labels: "Me", "Internal", "Partner", "3rd Party"
**Design rationale:** Color-coded ownership makes task delegation visible at a glance. The "Me" badge uses accent color because "my tasks" are the primary view.
**Constraints:** These four categories are fixed. Don't add new owner types without updating the color map everywhere.

### Org Type Badges (People)

**Component:** Inline colored badges on contributor rows
**Used on:** Partner detail (engagement contributors section)
**Behavior:**
- Three org types with consistent colors matching the owner badge palette:
  - AWS (internal): `bg-accent/10 text-accent`
  - Partner: `bg-status-active/10 text-status-active`
  - Third Party: `bg-status-completed/10 text-status-completed`
- Size: `text-[10px] font-medium rounded-full px-2 py-0.5`
**Design rationale:** Consistent with owner badge colors so the user learns one color language for "who is this person?"
**Constraints:** Same colors as owner badges — never diverge.

## Recurrence

### RecurrenceCard (Unified Recurrence Section)

**Component:** `RecurrenceCard` (`src/components/shared/RecurrenceCard.tsx`)
**Used on:** Meeting detail page — replaces the former SeriesDisplay + SeriesTimeline + SeriesActions
**When to show:** Any meeting with `recurrence_pattern` or `series_id` (siblings.length > 1)
**Behavior:**
- Line 1: ↻ icon + ← arrow + rhythm text + → arrow + "Since {date}" + "Edit pattern" link + ⋮ overflow menu
  - Arrows navigate to previous/next in series (disabled at boundaries)
  - Rhythm text: "Weekly on Fridays", "Biweekly on Wednesdays", "Monthly on the 15th"
  - **Always reads anchor_day from the series root** (resolved server-side)
- Line 2: Date list — 5 nearest occurrences centered on current meeting
  - Past dates: `text-muted/40` (muted)
  - Current meeting: `text-accent font-semibold` (highlighted)
  - Future dates: `text-foreground/60`
  - Cancelled: `text-muted/20 line-through`
  - "..." ellipsis at edges if more exist
  - Each date is a link to that meeting (except current)
- Actions: "Edit pattern" opens modal editor; overflow ⋮ has "Skip this one" and "End series"
- Container: `rounded-lg border border-border/20 bg-surface/50 px-4 py-3 mb-6`
**Design rationale:** One compact card replaces 3 separate components (display, timeline strip, actions). The date list is more readable than colored boxes. No legend needed — dates are self-explanatory. Edit affordance is subtle (text link, not button) because editing is infrequent.
**Constraints:** Don't show for standalone meetings. Don't add colored boxes or legends back. Don't show occurrence count.

### RecurrenceEditor (Modal)

**Component:** `RecurrenceEditor` (`src/components/shared/RecurrenceEditor.tsx`)
**Used on:** Meeting detail page — opened from RecurrenceCard "Edit pattern" or MakeRecurringButton
**Behavior:**
- Modal dialog (z-50, backdrop, centered, max-w-sm)
- Fields: Pattern dropdown (Weekly/Biweekly/Monthly/Quarterly), Day picker, End date (hidden by default, "Add end date" link)
- Preview: "Next 3: Apr 27 → May 11 → May 25" updates live
- Save: calls PUT /api/meetings/{id} with pattern + anchor_day + end date. For existing series, passes `scope: "this_and_future"`
- **Save state protection**: useUnsavedChanges("recurrence-editor") tracks dirty state by comparing form values to initial props
- **Discard confirmation**: On close/Cancel/ESC with dirty form → "Discard changes?" dialog (z-60, layered above editor modal). Stay returns to editor. Discard closes both.
- On save success: clears dirty, calls onSave callback
**Design rationale:** Modal instead of inline because the editor pushes page content down and loses visual context. The discard dialog prevents accidental data loss. The dirty check is value-based (not interaction-based) so clicking a select without changing the value doesn't trigger it.
**Constraints:** Never render inline — always as a modal. Always protect with discard confirmation.

### MakeRecurringButton

**Component:** `MakeRecurringButton` (`src/components/shared/MakeRecurringButton.tsx`)
**Used on:** Meeting detail page — in Details sidebar for standalone (non-series) meetings only
**Behavior:** Text link "Make recurring" → opens RecurrenceEditor modal with null initial values
**Constraints:** Only show when `!meeting.series_id && !meeting.recurrence_pattern`. Never show on already-recurring meetings.

### Shifted-Occurrence Indicator

**Component:** Date color in list views
**Used on:** Meetings list, Today page, Partner detail recent meetings
**Behavior:**
- Date text renders in `text-status-blocked/70` (amber) instead of `text-muted` when day-of-week ≠ root's anchor_day
- Detection: compare meeting_date day-of-week against root's anchor_day (weekly/biweekly only)
**Design rationale:** Subtle but unmissable. Amber is the "attention" color (already used for overdue tasks).
**Constraints:** Only applies to weekly/biweekly patterns. Don't use for standalone meetings.

## Financial Displays

### Currency Formatting

**Component:** `fmtCurrency()` utility function in partner detail page
**Used on:** Partner detail (Co-Sell Performance, Funding sections)
**Behavior:**
- `$1.2M` for ≥1,000,000 (one decimal)
- `$215k` for ≥1,000 (rounded, no decimal)
- `$500` for <1,000 (rounded)
- `—` (em dash) for null/undefined
- All financial values use `font-mono` for alignment
**Design rationale:** Abbreviated currency is faster to scan than full numbers. The three tiers cover all real-world values in the partner portfolio.
**Constraints:** Never show cents. Never use locale-specific formatting (always USD, always `$` prefix). Always `font-mono`.

### Attainment Percentage

**Component:** Inline computation in partner detail page
**Used on:** Partner detail (Co-Sell Performance — MP TCV and LARR)
**Behavior:**
- Computed: `Math.round((ytd / goal) * 100) + "%"`
- Display: `font-mono text-xs text-accent` — accent colored to draw attention
- Shows only when both YTD and goal are non-null and goal > 0
- Positioned after the "/ {goal}" text
**Design rationale:** Attainment % is the single most important financial metric for a PDM. Accent color makes it pop.
**Constraints:** Don't color-code by threshold (red/yellow/green) — the PDM knows what "good" looks like for each partner.

### Goal vs Actual Grid

**Component:** Inline grid in partner detail Co-Sell Performance section
**Used on:** Partner detail page
**Behavior:**
- Top row: large YTD number + goal + attainment % (MP TCV and LARR side by side, `grid-cols-2`)
- Below: historical/projected table using `grid-cols-[auto_1fr_1fr]`
- Rows: 2025, 2024, Projected — each showing MP TCV and LARR
- Headers: `text-muted/40` for column labels
- Values: `font-mono text-foreground/70`
- Separator: `border-t border-border/30` between primary metrics and historical
**Design rationale:** The two-number-at-top pattern (YTD MP TCV + YTD LARR) mirrors how PDMs think — "where am I this year?" Historical and projected data is secondary context.
**Constraints:** Don't add charts or graphs — the numbers are the visualization. Don't add YoY % change until requested.

### Funding Remaining

**Component:** Inline computation in partner detail Funding section
**Used on:** Partner detail (MPOPP and MDF funding rows)
**Behavior:**
- Remaining computed: `allocated - spent` (MPOPP) or `allocated - utilized` (MDF)
- Display: `font-mono text-xs font-medium`
- Color: `text-status-blocked` when remaining > 0 (money left to spend), `text-muted` when 0
- Format: `"{amount} left"` suffix
- Each funding row shows: status + half/name + allocated + spent + remaining
**Design rationale:** The "left" suffix makes the number actionable ("you have $X left to spend"). Amber color for remaining > 0 signals opportunity, not danger.
**Constraints:** Don't show negative remaining — clamp to 0.

## Grouped Displays

### Section Component

**Component:** `Section` (defined in partner detail page, not extracted to shared)
**Used on:** Partner detail (engagements, tasks, meetings, enrollments, goals, funding, events, people, solution profile, operational status)
**Behavior:**
- Header: `text-xs font-medium uppercase tracking-wider text-muted/60` with optional count badge
- Count badge: `text-xs text-muted/40` — subtle, right of title
- Optional "View all" link: right-aligned in header row
- Content: children rendered inside `rounded-lg border border-border/50 bg-surface overflow-hidden`
- Section spacing: `space-y-6` between sections
**Design rationale:** Universal section pattern for all grouped content on detail pages. The consistent header treatment (uppercase, small, muted) keeps sections from competing with page-level content.
**Constraints:** Consider extracting to `src/components/shared/Section.tsx` if the pattern is adopted on more pages. Currently defined inline in partner detail.

### SectionHeader Component (Today Page)

**Component:** `SectionHeader` (defined in Today page)
**Used on:** Today page (Today's Meetings, My Tasks, Inbox, Upcoming)
**Behavior:**
- Same visual treatment as partner detail Section: `text-xs font-medium uppercase tracking-wider text-muted/60`
- Count: `text-xs text-muted/40` positioned right of label
- `inline` prop: when true, omits bottom margin (used when header is in a flex row with "View all")
**Design rationale:** Same visual language as partner detail sections — the user sees one consistent section header treatment across the app.
**Constraints:** These two section header components (partner detail Section + Today SectionHeader) should eventually be consolidated into one shared component.

### Subgroup Headers (Within Sections)

**Component:** Inline `<div>` headers within sections
**Used on:** Partner detail (People section: "AWS Team" / "Partner Team" / "Third Parties"; Funding: "MPOPP" / "MDF")
**Behavior:**
- `text-[11px] font-medium uppercase tracking-wider text-muted/40`
- `px-4 pt-3 pb-1` — compact padding, lives inside the section card
- No count badge (parent section has the total count)
**Design rationale:** Subgroups organize within a section without creating visual noise. The reduced opacity (/40 vs /60) makes them clearly subordinate to section headers.
**Constraints:** Max 3-4 subgroups per section. If more, reconsider the section structure.

### Two-Column Launchpad (Today Page)

**Component:** Grid layout on Today page (`src/app/page.tsx`)
**Used on:** Today page (desktop ≥1024px)
**Behavior:**
- Container: PageContainer (fluid, max-w-[1600px])
- `grid-cols-1 lg:grid-cols-[11fr_9fr] gap-6` — 55/45 split
- Both grid children have `min-w-0` to prevent CSS Grid overflow
- Left column (55%): Today's Meetings + Upcoming Meetings — the schedule
- Right column (45%): My Tasks (capped at 12) + Inbox signal — what needs attention
- Right column has `lg:border-l lg:border-border/20 lg:pl-6` separator
- Stacks to single column on <1024px (meetings first, then tasks + inbox)
- "+N more tasks" link when tasks exceed cap
- "No meetings scheduled this week" empty state in left column
**Design rationale:** Meetings and tasks live side-by-side so neither buries the other. The 55/45 ratio gives meetings slightly more space (metadata per row) while allowing tasks enough room for descriptions. Cap at 12 shows a useful task list without making the right column dominate. `min-w-0` on grid children is required to prevent content overflow — see Layout System pattern.
**Constraints:** This is the only two-column launchpad page. Don't apply this layout to list pages (meetings, tasks, partners) — those are single-column with full-width rows.

### Tasks Grouped by Partner (Today Page)

**Component:** `TodayTasks` client component
**Used on:** Today page (My Tasks section, right column)
**Behavior:**
- Tasks sorted: overdue first → due soonest → no due date last
- Grouped by partner name with partner as section header
- Each task row: checkbox + description + due date (overdue highlighted) + partner context
- Overdue dates: `text-status-blocked` (amber)
- "View all" link in section header to /tasks page
- Capped at 12 items with "+N more tasks" link below
**Design rationale:** Grouping by partner matches how the PDM thinks — "what do I owe Spacelift? What do I owe OPSWAT?" The sort order surfaces urgent items first. Cap at 12 shows a useful task list while keeping the page manageable.
**Constraints:** Today page tasks are read-only (no inline editing). Full task management happens on /tasks.
