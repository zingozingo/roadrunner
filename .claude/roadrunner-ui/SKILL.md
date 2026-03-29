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

## Component Patterns

### Sidebar

Three-tier navigation without section labels. Hierarchy communicated through text brightness alone.

- **Width:** 224px (`w-56`)
- **Background:** `bg-surface` with `border-r border-border/40`
- **Brand:** `text-[15px] font-semibold tracking-tight text-foreground`
- **Tier spacing:** 24px (`mt-6`) between tiers
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
- **Button loading:** Replace label with spinner, keep button width stable, `pointer-events-none`

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

How search bars behave: debounce timing, placeholder text conventions, empty/zero-result states, keyboard shortcuts.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## Filters

How filter controls compose: toggle buttons vs dropdowns, how filters stack with search, active filter indication, clear/reset behavior.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## List Capping & Pagination

How long lists are truncated: "View all" pattern, default cap counts, progressive disclosure for collapsed sections.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## Confirmation & Destructive Actions

When to show confirmation dialogs, visual treatment of destructive vs safe actions, "undo" vs "are you sure" patterns.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## Forms & Creation

Modal vs inline creation, required field indication, validation messaging, duplicate detection display.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## Navigation & Linking

Clickable entity references (partners, engagements, meetings), how breadcrumbs work, how "back" behavior works.

*Not yet documented — will be populated as patterns are established in Plan 2.*

---

# Layer 3: Data Visualization Patterns

Patterns for rendering complex information visually. Status indicators, timelines, financial displays, and any component whose purpose is to help the user see patterns in data.

## Status Indicators

Badges, dots, color coding for entity states. How shifted/rescheduled occurrences display. How overdue items highlight.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## Series & Timeline Visualization

How recurring meeting series render as visual strips. Dot/block representations of occurrences over time. Color coding: completed, scheduled, skipped, rescheduled.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## Financial Displays

Number formatting, currency display, attainment percentages, trend indicators, goal-vs-actual presentation.

*Not yet documented — will be populated as patterns are established in Plan 2.*

## Grouped Displays

How entities group (tasks by partner, enrollments by type, engagements by pillar). Header treatment, collapse behavior, count badges.

*Not yet documented — will be populated as patterns are established in Plan 2.*
