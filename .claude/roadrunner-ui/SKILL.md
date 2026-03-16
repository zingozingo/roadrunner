---
name: roadrunner-ui
description: UI design system and component patterns for Roadrunner (Relay), an AWS partner engagement management app. Use when building, modifying, or extending any Roadrunner UI — list pages, detail pages, filters, sidebar, or shared components. Also use when adding new entity types, fixing layout issues, or ensuring visual consistency across pages. Trigger on any mention of Roadrunner UI, Relay UI, list pages, detail pages, FilterBar, NoteWorkspace, identity bar, two-column layout, or entity-specific page work.
---

# Roadrunner UI Design System

> **Last updated:** 2026-03-15. Reflects decisions through #199. UI overhaul complete: two-column detail pages, collapsible list groups, sidebar zone labels, three-tier partner detail.

Roadrunner (also called Relay) is an AI-powered email classification and partner engagement management system for AWS PDMs. This skill defines the UI layout system, component patterns, and visual conventions.

## 1. Design Tokens

**Stack:** Next.js 16 (App Router) + Tailwind CSS 4 + Supabase + TypeScript
**Theme:** Dark mode, indigo accent (#6366f1), defined via CSS custom properties in `globals.css`

### Core Colors (CSS Custom Properties)

| Token | Value | Usage |
|---|---|---|
| `--color-background` | `#0f1117` | Page background |
| `--color-surface` | `#1a1b23` | Cards, sidebar, input backgrounds |
| `--color-surface-hover` | `#22232d` | Card hover state |
| `--color-foreground` | `#e4e4e7` | Primary text |
| `--color-muted` | `#71717a` | Secondary text, labels, placeholders |
| `--color-border` | `#27272a` | Borders, dividers |
| `--color-accent` | `#6366f1` | Indigo — primary accent, links, active states |
| `--color-accent-hover` | `#818cf8` | Accent hover |

### Status Colors

| Status | Dot Color | Badge BG | Badge Text |
|---|---|---|---|
| active | `#22c55e` (green) | `bg-status-active/20` | `text-status-active` |
| blocked | `#f59e0b` (amber) | `bg-status-blocked/20` | `text-status-blocked` |
| completed | `#8b5cf6` (purple) | `bg-status-completed/20` | `text-status-completed` |
| archived | `#6b7280` (gray) | `bg-status-archived/20` | `text-status-archived` |

### Program Type Colors (CSS variables for ProgramTypeBadge)

Competency (#3b82f6 blue), Service Ready (#8b5cf6 violet), SCA (#f59e0b amber), Funding (#10b981 emerald), Channel (#ec4899 pink), Enablement (#06b6d4 cyan).

## 2. Typography Hierarchy

| Element | Size | Weight | Color |
|---|---|---|---|
| Page/entity title | 20px / `text-xl` | 500 / `font-semibold` | `text-foreground` |
| Section label | 11px / `text-xs` | 500 / `font-semibold` | `text-muted`, uppercase, `tracking-wider` |
| Category sub-label | 10px / `text-[10px]` | 500 / `font-semibold` | `text-muted/50`, uppercase, `tracking-widest` |
| Row primary text | 13px / `text-sm` | 500 / `font-medium` | `text-foreground` |
| Row secondary text | 13px / `text-sm` | 400 | `text-muted` |
| Metadata/date | 12px / `text-xs` | 400 | `text-muted` |
| Pills/badges | 11px / `text-xs` | 500 / `font-medium` | tinted color |
| Body prose | 13-14px / `text-sm` | 400 | `text-foreground/80`, `leading-relaxed` |

## 3. Status Indicators

**Dots for binary status.** 6-7px colored circle — use for engagement/meeting status in row context.

**Pills for categorical data.** Pillar, owner, type, architecture, listing:
- `text-xs`, `px-2 py-0.5`, `rounded-full`
- Background: color at 10-15% opacity (e.g., `bg-accent/10`)
- Text: color at 70-80% brightness (e.g., `text-accent`)

**Plain text for countable items.** Show count inline as plain text, not a badge pill. Example: `{count} engagements` as `text-xs text-muted`.

**Inline badge pattern** (ad-hoc, no dedicated component):
```tsx
<span className="rounded-full bg-{color}/15 px-2 py-0.5 text-xs font-medium text-{color} whitespace-nowrap">
  {label}
</span>
```

## 4. Row Patterns

### Clickable entity rows (engagements, meetings on detail pages)
Individual items inside collapsible `<details>` groups. Subtle hover, no per-row border.

```tsx
<Link
  href={`/entity/${id}`}
  className="flex items-baseline gap-4 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
>
  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
  <span className="shrink-0 text-xs text-muted">{metadata}</span>
</Link>
```

**Rules:**
- Name takes `flex-1`, metadata/badges right-aligned with `shrink-0`
- `items-baseline` for text-only rows, `items-center` when dots/badges present
- `hover:bg-surface/50` universally
- `border-b border-border/20` for subtle row separation
- Status dots as last element when present

### Reference list rows (contacts, relationships in right column)
Compact, no separators. Grouped by category label (`text-[10px] font-semibold uppercase tracking-widest text-muted/50`).

## 5. Collapsible Groups

All list pages use `<details>/<summary>` for grouped sections. This is the standard pattern:

```tsx
<details
  key={group.key}
  open={defaultOpen || undefined}
  className="group"
>
  <summary className="flex cursor-pointer list-none items-center gap-2 pb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted/70 [&::-webkit-details-marker]:hidden">
    <svg
      width="14" height="14" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      className="shrink-0 transition-transform group-open:rotate-90"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
    {group.label}
    <span className="font-normal text-muted/50">
      {group.items.length}
    </span>
  </summary>
  <div>
    {/* Row items here */}
  </div>
</details>
```

**Smart defaults:**
- If **any group** on a page has **10+ items**, **all groups** on that page default-collapsed (clean header-only overview)
- If **no group** exceeds 10, all groups default-open
- **Search active** → all groups forced open (`!!searchQuery`)
- Time-based (Events/Meetings): Upcoming/TBD default-open, Past default-collapsed

**Important:** Use `!!searchQuery` (double-bang) for boolean coercion — `string | true` doesn't satisfy `boolean | undefined` for the `<details open>` attribute.

## 6. Page Layouts

### List Pages (single-column)

All list pages follow this structure:

```tsx
<div className="p-6 lg:p-8">
  <PageHeader title="..." subtitle="N items tracked" />

  {items.length === 0 ? (
    <EmptyState title="No ... yet" description="..." />
  ) : (
    <>
      <FilterBar
        searchPlaceholder="Search ..."
        filterOptions={OPTIONS}
        activeFilter={activeFilter}
        onSearchChange={setSearchQuery}
        onFilterChange={setActiveFilter}
        resultCount={filtered.length}
        totalCount={items.length}
        entityName="..."
      />
      {filtered.length === 0 ? (
        <EmptyState title="No matching ..." description="Try adjusting..." />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <details key={...} open={...} className="group">
              {/* summary + rows */}
            </details>
          ))}
        </div>
      )}
    </>
  )}
</div>
```

**Entity grouping:**

| Entity | Groups By | Filter Dimension |
|---|---|---|
| Partners | segment | segment |
| Engagements | status | status |
| Meetings | time (Upcoming/Past/TBD) | meeting_type |
| Programs | type (8 categories) | type |
| Events | time → month | type + year |
| Relationships | relationship_type | relationship_type |
| Tasks | partner | owner (Me/Partner/AWS) |

### Detail Pages — Two-Column Layout

Detail pages use a two-column layout: primary content left, reference/metadata right. **No box-stack wrapper cards around sections.**

#### Partner Detail

```
Left Column (3fr)
├── PartnerScratchpad (compact — no card wrapper)
├── Engagements (clickable entity rows)
├── Open Tasks (flat rows)
└── Recent Meetings (flat rows)

Right Column (2fr, border-l)
├── What They Do (prose)
├── AWS Stickiness (accent label + service pills)
├── Profile (2-col grid: architecture, listing, pricing, SPMS ID)
├── Contacts (grouped by org_type)
└── Relationships
```

#### Engagement Detail

```
Left Column (3fr)
├── Goal callout (border-l-2 border-accent/40, italic)
├── Current State (section label + prose)
├── Connections (relationship links + EntityLinkChips)
└── Timeline (collapsible <details>, CollapsibleEmails compact)

Right Column (2fr, border-l)
├── Partner link (accent)
├── Details (pillar, topic, status dot+text, updated)
└── Participants (count + org breakdown, CollapsibleParticipants compact)
```

#### Meeting Detail

```
Left Column (3fr)
├── Location (URL → accent link, physical → label+text)
├── Calendar Notes (prose)
└── MeetingNotesSection (client bridge, manages own state)

Right Column (2fr, border-l)
├── Partner (accent link)
├── Details (date, time, engagement, type, source)
├── Attendees (grouped by org: AWS/Partner/Other)
└── Footer (organizer + created)
```

### Sidebar

Zone labels replace border dividers. Subtle right border (`border-border/30`).

```
REVIEW
  Inbox (with unresolved count badge)

WORK
  Partners (home — / redirects here)
  Engagements

ACTIVITY
  Meetings
  Tasks

REFERENCE
  Programs
  Events
  Relationships
```

Zone label style: `text-[10px] font-medium uppercase tracking-[0.1em] text-muted/40 px-3 mb-1`
Zone spacing: `mt-6` between zones (whitespace, no borders)
Sidebar border: `border-border/15` (very subtle)

## 7. Shared Components

### FilterBar (`src/components/layout/FilterBar.tsx`)

Single-select chip filter with integrated search.

```typescript
interface FilterBarProps {
  searchPlaceholder?: string;
  filterOptions: { label: string; value: string }[];
  activeFilter: string | null;
  onSearchChange: (query: string) => void;
  onFilterChange: (value: string | null) => void;
  resultCount: number;
  totalCount: number;
  entityName?: string;
}
```

- Click chip → select exclusively. Click active chip → deselect (back to All).
- Search + filter work together independently.
- Shows "X of Y items" count.
- If a page needs a second filter dimension, add a separate row below — don't modify FilterBar.

### PageHeader (`src/components/layout/PageHeader.tsx`)

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
}
```

Simple h1 + subtitle at top of every list page.

### EmptyState (`src/components/layout/EmptyState.tsx`)

```typescript
interface EmptyStateProps {
  title: string;
  description?: string;
}
```

Two uses: initial empty ("No {entities} yet") and filter empty ("No matching {entities}").

### Compact Prop Components

Three components support `compact?: boolean` (default false). When true, suppresses the `rounded-xl border border-border bg-surface p-4` card wrapper:
- **PartnerScratchpad** — used compact on partner detail
- **CollapsibleParticipants** — used compact on engagement detail
- **CollapsibleEmails** — used compact on engagement detail

### Notes Components (`src/components/notes/`)

- **NoteWorkspace** — Full editing + review phases, auto-save, AI summarize
- **MeetingNotesSection** — Client bridge for meeting detail (3-state: no note, creating, existing)
- **ContextSidebar** — Partner context during note-taking
- **PreviousNotes** — Collapsible previous note summaries
- **TaskEditor** — Task management (grouped by owner, add/toggle/delete)

### Partner Components (`src/components/partners/`)

- **PartnerScratchpad** — Living context scratchpad (Enter to submit, optimistic, hover-delete)
- **PartnerTasksSection** — Open tasks grouped by owner with toggle capability

## 8. Data Formatting Utilities

All in `src/lib/format-utils.ts`.

### `extractCity(location: string | null | undefined): string`
Extracts compact city from full location. Strips venues, street addresses, postal codes. Returns last 2 meaningful segments (city + state/country). Empty string for null/empty.
- `"Venetian Expo, Las Vegas, NV"` → `"Las Vegas, NV"`
- `"75017 Paris, France"` → `"Paris, France"`

**Usage:** List pages and cards. Detail pages show full location.

### `formatCompactDateRange(start, end): string`
- Same month: `"Mar 9–12"` (en-dash)
- Cross-month: `"Mar 9 – Apr 2"` (spaced dash)
- Single date: `"Mar 9"`
- No start: `"TBD"`

### `cleanMeetingTitle(title: string): string`
Strips `FW:`, `Fwd:`, `Re:`, `RE:`, `Accepted:`, `Tentative:`, `Declined:` prefixes. Handles multiple layers. **Apply everywhere meeting titles render.**

### Data Display Rules

1. **Locations:** `extractCity()` on list pages. Full address on detail pages.
2. **Meeting titles:** Always `cleanMeetingTitle()`.
3. **Dates:** `formatCompactDateRange()` for compact. Full on detail pages.
4. **Empty data:** Show nothing in list rows. Detail page fields use "—" for missing values.
5. **URLs:** Show meaningful labels, never raw URLs on list pages.

## Design Principles

1. **Two-column over box-stack** — Detail pages split into content (left) and reference (right). No equal-weight vertical stacking of every section.
2. **Whitespace over borders** — Separate zones with spacing, not dividers. Use `border-border/40` (reduced opacity) where borders are needed.
3. **Collapsible where dense** — List page groups and detail page activity sections use `<details>`. Reference data on detail right columns stays visible (no collapsing).
4. **Countable items are plain text** — `{n} engagements` as text, not a badge pill. Pills are for categorical data only.
5. **Detail belongs on detail pages** — List rows show identity + one key context field. Don't cram everything in.
6. **No duplicate content** — A field renders in exactly one place. Not in header AND sidebar.
7. **Composition over inheritance** — Components define visual slots, pages fill them.
8. **Viewport budget** — Identity + context on detail pages should not exceed ~1/3 of viewport height.

## What NOT to Do

- No `rounded-xl border border-border bg-surface p-4` wrapper cards around sections on detail pages
- No equal-weight single-column stacking of every section
- No collapsing reference data that should be persistently visible on right column
- No badge pills for counts — use plain text
- No prose walls as primary content — structured fields first, prose secondary
- No status text badges where a dot suffices
- No duplicate information across header and sections

## Reference Files

- **`references/component-api.md`** — Full TypeScript interfaces for shared components
- **`references/entity-catalog.md`** — Entity-to-component mappings and slot configurations
- **`references/design-tokens.md`** — CSS custom properties, color palette, spacing, typography details

Read these when you need exact prop types, entity-specific field mappings, or color values.
