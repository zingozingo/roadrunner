---
name: roadrunner-ui
description: UI design system and component patterns for Roadrunner (Relay), an AWS partner engagement management app. Use when building, modifying, or extending any Roadrunner UI — list pages, detail pages, filters, sidebar, or shared components. Also use when adding new entity types, fixing layout issues, or ensuring visual consistency across pages. Trigger on any mention of Roadrunner UI, Relay UI, list pages, detail pages, DetailHeader, FilterBar, PillGrid, TableList, CalendarCard, or entity-specific page work.
---

# Roadrunner UI Design System

Roadrunner (also called Relay) is an AI-powered email classification and partner engagement management system for AWS PDMs. This skill defines the UI component architecture, design patterns, and conventions that ensure visual consistency across all pages.

## Architecture Overview

**Stack:** Next.js 14 (App Router) + Tailwind CSS + Supabase + TypeScript
**Theme:** Dark mode, indigo accent (#6366f1), defined via CSS custom properties in `globals.css`

### Page Types

Roadrunner has two page types, each with a standardized pattern:

1. **List pages** — Browse and filter entities. Uses `FilterBar` + entity-appropriate visual treatment inside grouped sections.
2. **Detail pages** — View a single entity. Uses `DetailHeader` + content sections.

### Entity Types (6)

| Entity | List Groups By | Filter Dimension | Primary Field | Visual Treatment |
|---|---|---|---|---|
| Engagements | status | status | name | Inline table rows |
| Partners | segment | segment | name | TableList |
| Programs | type | type (8 categories) | name | PillGrid |
| Events | time (Upcoming/Past/TBD) → year | type + year | name | CalendarCard |
| Meetings | time (Upcoming/Past/TBD) | meeting_type | title | Inline table rows |
| Relationships | relationship_type | relationship_type | name | TableList |

Plus **Inbox** (classification queue) and **Dashboard** (stats overview) — these don't follow the list/detail pattern.

## Visual Treatments by Entity Type

Different entity types have different scan patterns. The visual treatment should match.

### PillGrid (`src/components/shared/PillGrid.tsx`)

Compact grid of same-height pill elements. Names only, no metadata noise.

**When to use:** Catalog entities with 10+ same-type items where identity (name) is the primary scan dimension. Programs are the canonical use case.

**API:** `items` (id, name, href, count?), `columns` (2|3|4, default 3)

**Visual:** Responsive grid of fixed-height pills. Name on left, optional count on right. No badges, descriptions, or status indicators inside pills. Tight gap-1.5 spacing for density.

### TableList (`src/components/shared/TableList.tsx`)

Aligned rows with consistent columns. Clean data table without heavy table chrome.

**When to use:** Portfolio entities where comparable metadata across rows matters. Partners and Relationships are the canonical use cases.

**API:** `items` (id, href, columns[]), `headers?` (label, width?)

**Visual:** Rows separated by subtle bottom borders (no card wrappers). Column values align across all rows. First column is always the entity name (font-medium), subsequent columns are muted metadata. Optional header row with uppercase labels.

### CalendarCard (`src/components/shared/CalendarCard.tsx`)

Date-anchored cards with a compact date text line.

**When to use:** Temporal/event entities where date is the primary scan dimension. Events are the canonical use case.

**API:** `items` (id, href, name, startDate, endDate?, location?, typeColor?), `columns` (1|2, default 2)

**Visual:** Each card shows a compact date text line (e.g. "Mar 9–12") above the event name and location. Uses `formatCompactDateRange()` from format-utils.ts. Optional type color as a left border accent on the card.

### Inline Table Rows (default pattern)

Clean flat rows with border-bottom separators. No card wrappers, no rounded borders per row.

**When to use:** The default treatment for all list items — engagements, meetings, dashboard sections, and linked entity sections on detail pages. Use unless the entity type has a specific component (PillGrid, TableList, CalendarCard).

**CSS pattern:**
```tsx
<Link
  href={`/entity/${id}`}
  className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
>
  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
  <span className="shrink-0 text-xs text-muted">{metadata}</span>
  <span className="shrink-0"><StatusBadge status={status} /></span>
</Link>
```

**Design rules:**
- Status/badges always right-aligned as last element
- Name takes flex-1 (remaining space)
- Metadata columns use `shrink-0` with consistent widths for alignment
- `hover:bg-surface` (list pages) or `hover:bg-surface-hover` (inside section cards on detail pages)
- Detail belongs on detail pages, not list rows

### MeetingTimeline (`src/components/shared/MeetingTimeline.tsx`)

Vertical dot timeline for meetings shown as linked items on other entity detail pages.

**When to use:** Any detail page that shows related meetings. Use instead of flat list — temporal entities deserve timeline treatment.

**API:** `meetings` (Meeting[]), `engagementNames?` (Map<string, string>)

**Behavior:**
- Filters to upcoming + past 90 days
- Upcoming: accent dot/date, full-brightness title. Past: muted.
- Shows date, title (cleaned via `cleanMeetingTitle()`), status badge, linked engagement name

## Shared Components

### FilterBar (`src/components/layout/FilterBar.tsx`)

Single-select chip filter with integrated search.

**Key behavior:**
- `activeFilter: string | null` — one filter at a time, or null for "All"
- Click a chip to select exclusively; click again to deselect (back to All)
- Search + filter work together (filter narrows category, search narrows within)
- Shows "X of Y items" count

**When extending:** If a page needs a second filter dimension (like Events has type + year), add a separate chip row below FilterBar — don't modify FilterBar itself.

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
              {/* Visual treatment — varies by entity type */}
              <PillGrid items={...} />       {/* Programs */}
              <TableList items={...} />      {/* Partners, Relationships */}
              <CalendarCard items={...} />   {/* Events */}
              {/* Engagements + Meetings use inline table rows */}
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

All detail pages use a full-width layout (no sidebar). Metadata that would duplicate header fields is eliminated; remaining dates/source info goes in a compact footer.

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
<div className="rounded-xl border border-border bg-surface p-4">
  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
    Section Title
  </h2>
  {/* Section content */}
</div>
```

### Two-column context card
Use when two related text blocks (e.g., Description + Requirements, What They Do + AWS Context) should sit side-by-side on desktop and stack on mobile.

```tsx
<div className="rounded-xl border border-border bg-surface p-5">
  <div className="grid gap-6 lg:grid-cols-2">
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Left Label</h3>
      <p className="text-sm text-foreground leading-relaxed">{leftContent}</p>
    </div>
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Right Label</h3>
      <p className="text-sm text-foreground leading-relaxed">{rightContent}</p>
    </div>
  </div>
</div>
```

If only one column has content, omit the grid class to render full-width.

### Compact footer
Use for metadata that doesn't merit a card (Created date, Source, Verified status). Placed after all content sections.

```tsx
<p className="mt-6 text-xs text-muted">
  Created {date} · Last Updated {date}
</p>
```

## Badge Components

Badges are used in DetailHeader badge slots and right-aligned in inline table rows.

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

## Data Formatting Utilities

All formatting utilities live in `src/lib/format-utils.ts`.

### `extractCity(location)`
Extracts a compact city display from a full location string. Strips venue names, street addresses, postal codes, and direction suffixes.

- Input: `"Venetian Expo & Convention Center, Las Vegas, NV"` → Output: `"Las Vegas, NV"`
- Input: `"75017 Paris, France"` → Output: `"Paris, France"`
- Input: `"London E16 1XL, UK"` → Output: `"London, UK"`
- Input: `""` or `null` → Output: `""`

**Usage:** Always call on locations before passing to CalendarCard or rendering on list pages. Detail pages show full location (not extracted).

### `formatCompactDateRange(start, end)`
Formats date ranges for compact display on cards and list rows.

- `"2026-03-09"` / `"2026-03-12"` → `"Mar 9–12"` (same month, en-dash)
- `"2026-03-09"` / `"2026-04-02"` → `"Mar 9 – Apr 2"` (cross-month, spaced dash)
- `"2026-03-09"` / `null` → `"Mar 9"` (single date)
- `null` / any → `"TBD"`

**Usage:** CalendarCard uses this internally. Also available for any compact date display.

### `cleanMeetingTitle(title)`
Strips email-forwarding and calendar-response prefixes from meeting titles.

- Removes: `FW:`, `Fwd:`, `Re:`, `RE:`, `Accepted:`, `Tentative:`, `Declined:`
- Handles multiple layers: `"FW: FW: Re: Title"` → `"Title"`

**Usage:** Apply everywhere meeting titles render — list pages, detail pages, MeetingTimeline, Timeline (meeting-in-thread cards).

## Data Display Rules

1. **Locations:** `extractCity()` on list pages and cards. Full address on detail pages.
2. **Meeting titles:** Always cleaned via `cleanMeetingTitle()`.
3. **Dates:** Use `formatCompactDateRange()` for compact display. Full format on detail pages.
4. **Email addresses:** Never show raw angle brackets or `mailto:` prefixes.
5. **URLs:** Never show raw URLs on list pages. Show meaningful labels ("Zoom Meeting", "Join Meeting", "Program Link").
6. **Empty data:** Show nothing (not "N/A", not "—") in list rows. Detail page fields use "—" for missing values.

## Design Principles

1. **Composition over inheritance** — Components define visual slots, pages fill them. No god-components with 30 props.
2. **Detail belongs on detail pages** — List rows show identity + one key context line. Don't cram everything in.
3. **Earned placement** — Every file, component, and CSS variable must serve a clear purpose. No dead code.
4. **Constrained intelligence** — Match to existing entities, don't fabricate. This applies to both AI classification and UI data display.
5. **Measure twice, cut once** — Read existing code before modifying. Generate diagnostics before fixing.
6. **Match visual treatment to entity type** — Catalogs get PillGrid. Portfolios get TableList. Temporal items get CalendarCard. All other list items use inline table rows. Meetings on detail pages get MeetingTimeline.
7. **No duplicate content** — A field should render in exactly one place. If it's in the header fields, don't repeat it in a sidebar. If it's in a body card, don't also put it in the subtitle slot.
8. **Viewport budget** — Identity + context sections on detail pages should not exceed ~1/3 of viewport height. Merge related context into multi-column cards rather than stacking separate full-width sections. Activity content (meetings, engagements, relationships) should be visible without scrolling on a standard laptop screen.

## Reference Files

For detailed information, read the appropriate reference file:

- **`references/component-api.md`** — Full TypeScript interfaces for all shared components (DetailHeader, FilterBar, PillGrid, TableList, CalendarCard) and the inline table row CSS pattern
- **`references/entity-catalog.md`** — Entity-to-component mappings and slot configurations for all 6 entity types
- **`references/design-tokens.md`** — CSS custom properties, color palette, spacing conventions, typography

Read these when you need exact prop types, entity-specific field mappings, or color values. Don't guess — look them up.
