---
name: roadrunner-ui
description: UI design system and component patterns for Roadrunner (Relay), an AWS partner engagement management app. Use when building, modifying, or extending any Roadrunner UI — list pages, detail pages, filters, sidebar, or shared components. Also use when adding new entity types, fixing layout issues, or ensuring visual consistency across pages. Trigger on any mention of Roadrunner UI, Relay UI, list pages, detail pages, CompactRow, DetailHeader, FilterBar, or entity-specific page work.
---

# Roadrunner UI Design System

Roadrunner (also called Relay) is an AI-powered email classification and partner engagement management system for AWS PDMs. This skill defines the UI component architecture, design patterns, and conventions that ensure visual consistency across all pages.

## Architecture Overview

**Stack:** Next.js 14 (App Router) + Tailwind CSS + Supabase + TypeScript
**Theme:** Dark mode, indigo accent (#6366f1), defined via CSS custom properties in `globals.css`

### Page Types

Roadrunner has two page types, each with a standardized pattern:

1. **List pages** — Browse and filter entities. Uses `FilterBar` + `CompactRow` inside grouped sections.
2. **Detail pages** — View a single entity. Uses `DetailHeader` + content sections + sticky sidebar.

### Entity Types (6)

| Entity | List Groups By | Filter Dimension | Primary Field |
|---|---|---|---|
| Engagements | status | status | name |
| Partners | segment | segment | name |
| Programs | type | type (8 categories) | name |
| Events | time (Upcoming/Past/TBD) → year | type + year | name |
| Meetings | time (Upcoming/Past/TBD) | meeting_type | title |
| Relationships | relationship_type | relationship_type | name |

Plus **Inbox** (classification queue) and **Dashboard** (stats overview) — these don't follow the list/detail pattern.

## Shared Components

### FilterBar (`src/components/layout/FilterBar.tsx`)

Single-select chip filter with integrated search.

**Key behavior:**
- `activeFilter: string | null` — one filter at a time, or null for "All"
- Click a chip to select exclusively; click again to deselect (back to All)
- Search + filter work together (filter narrows category, search narrows within)
- Shows "X of Y items" count

**When extending:** If a page needs a second filter dimension (like Events has type + year), add a separate chip row below FilterBar — don't modify FilterBar itself.

### CompactRow (`src/components/shared/CompactRow.tsx`)

Universal list item with four composition slots.

**Slot model — the visual frame is universal, content varies per entity:**
- `primary` (string) — Entity name, always shown
- `badges` (ReactNode) — Status/type badges inline with name
- `secondary` (string) — Description or context, line-clamped
- `meta` (ReactNode) — Right-aligned metadata (date, count, contact)

**Design rules:**
- `py-3 px-4` — tighter than cards for higher scan density
- `line-clamp-1` default on secondary (use `secondaryLineClamp={2}` sparingly)
- Detail belongs on detail pages, not list rows. When in doubt, leave it out of the row.
- For the slot mappings per entity, read `references/entity-catalog.md`

### DetailHeader (`src/components/shared/DetailHeader.tsx`)

Universal hero block for detail pages.

**Slot model:**
- `title` (string) — Entity name, h1
- `badges` (ReactNode) — Status/type badges inline with title
- `subtitle` (string) — Primary descriptive text (What They Do, description, current_state)
- `fields` (DetailField[]) — Key-value metadata grid, 2-col mobile / 4-col desktop
- `actions` (ReactNode) — Top-right action buttons

**Design rules:**
- Contained in a card (`rounded-xl border border-border bg-surface p-5`)
- Fields grid separated by `border-t` — clear hierarchy between identity and metadata
- Max 4 fields recommended; more creates visual noise
- For the slot mappings per entity, read `references/entity-catalog.md`

### Sidebar (`src/components/layout/Sidebar.tsx`)

Navigation with priority-ordered items:

1. Inbox (action items, with badge count polling)
2. Engagements (active work)
3. Partners (portfolio)
4. Meetings (time-bound)
5. Events (calendar reference)
6. Programs (catalog reference)
7. Relationships (lookup reference)

**Rule:** Order follows a priority gradient: action items → active work → portfolio → time-bound → reference catalogs. New nav items should be inserted based on this principle.

## List Page Pattern

Every list page follows this structure:

```tsx
<div className="p-6 lg:p-8">
  {/* Header row */}
  <div className="mb-6 flex items-start justify-between gap-4">
    <PageHeader title="..." subtitle="..." />
    <SyncButton entity="..." label="..." compact />
  </div>

  {/* Empty state OR filter + list */}
  {items.length === 0 ? (
    <EmptyState title="..." description="..." />
  ) : (
    <>
      <FilterBar
        searchPlaceholder="Search ..."
        filterOptions={...}
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
            <section key={group.key}>
              {/* Group header */}
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                  {group.label}
                </h2>
                <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                  {group.items.length}
                </span>
              </div>
              {/* Rows */}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <CompactRow key={item.id} href={`/entity/${item.id}`} ... />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )}
</div>
```

**Grouping conventions:**
- Category groups (type, segment, status): uppercase label + count badge
- Time groups (Upcoming/Past/TBD): `text-lg font-semibold` section header + count in parens
- Year sub-groups under time sections: same uppercase label style

## Detail Page Pattern

Detail pages use one of two layouts based on content needs:

### Two-column layout (with sidebar)
Use when the entity has participants, metadata cards, or reference info that benefits from a persistent sidebar.
Examples: Engagement detail (participants + metadata sidebar).

```tsx
<div className="p-6 lg:p-8">
  <DetailHeader ... />
  <div className="grid gap-6 lg:grid-cols-3">
    <div className="space-y-6 lg:col-span-2">{/* Main content */}</div>
    <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">{/* Sidebar */}</div>
  </div>
</div>
```

### Full-width layout (no sidebar)
Use when the sidebar would duplicate header metadata or bury important content. Sections stack vertically with `space-y-6`.
Examples: Partner detail (AWS Context promoted, no sidebar duplication).

```tsx
<div className="p-6 lg:p-8">
  <DetailHeader ... />
  <div className="space-y-6">
    {/* Full-width content sections */}
  </div>
</div>
```

**Content section card:**
```tsx
<div className="rounded-xl border border-border bg-surface p-5">
  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
    Section Title
  </h2>
  {/* Section content */}
</div>
```

## Badge Components

Badges are used in both CompactRow and DetailHeader badge slots.

- `StatusBadge` — engagement/program status (planned/active/paused/completed)
- `ProgramTypeBadge` — program type with color coding
- `EventTypeBadge` — event type (conference/summit/webinar/etc.)
- `MeetingStatusBadge` — meeting status with color coding
- `RelationshipTypeBadge` — relationship type

**Inline badge pattern** (for ad-hoc badges without a dedicated component):
```tsx
<span className="rounded-full bg-{color}/15 px-2 py-0.5 text-xs font-medium text-{color} whitespace-nowrap">
  {label}
</span>
```

## Design Principles

1. **Composition over inheritance** — Components define visual slots, pages fill them. No god-components with 30 props.
2. **Detail belongs on detail pages** — List rows show identity + one key context line. Don't cram everything in.
3. **Earned placement** — Every file, component, and CSS variable must serve a clear purpose. No dead code.
4. **Constrained intelligence** — Match to existing entities, don't fabricate. This applies to both AI classification and UI data display.
5. **Measure twice, cut once** — Read existing code before modifying. Generate diagnostics before fixing.
6. **Section visual weight by entity type** — Temporal entities (meetings) get timeline treatment. Workstreams (engagements) get status-driven lists with CompactRow. Structural/reference entities (relationships, programs) get compact lists with minimal visual weight. Strategic content (AWS Context) gets accent-bordered prominent cards.
7. **No duplicate content** — A field should render in exactly one place. If it's in the header fields, don't repeat it in a sidebar. If it's in a body card, don't also put it in the subtitle slot.
8. **Viewport budget** — Identity + context sections on detail pages should not exceed ~1/3 of viewport height. Merge related context into multi-column cards rather than stacking separate full-width sections. Activity content (meetings, engagements, relationships) should be visible without scrolling on a standard laptop screen.

## MeetingTimeline Component

**Location:** `src/components/shared/MeetingTimeline.tsx`

Reusable vertical timeline for displaying meetings on non-meeting detail pages (partner, engagement, event, program pages).

**Props:**
- `meetings: Meeting[]` — full meeting array; component handles filtering and sorting internally
- `engagementNames?: Map<string, string>` — optional map of engagement_id → name for inline display

**Behavior:**
- Filters to upcoming meetings + past meetings within 90 days (older meetings are hidden)
- Upcoming sorted soonest-first, past sorted most-recent-first
- Upcoming meetings: accent-colored dot and date, full-brightness title
- Past meetings: muted dot, muted title
- Shows date (prominent), title, meeting_type badge, status badge, linked engagement name
- Empty state: "No meetings scheduled"
- Vertical timeline line with dot nodes

**When to use:** Any detail page that shows related meetings. Use instead of flat CompactRow lists for meetings — temporal entities deserve timeline treatment.

## Reference Files

For detailed information, read the appropriate reference file:

- **`references/component-api.md`** — Full TypeScript interfaces for CompactRow, DetailHeader, FilterBar
- **`references/entity-catalog.md`** — Slot mappings for all 6 entity types (what goes in primary/badges/secondary/meta for each)
- **`references/design-tokens.md`** — CSS custom properties, color palette, spacing conventions, typography

Read these when you need exact prop types, entity-specific field mappings, or color values. Don't guess — look them up.