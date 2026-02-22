# Component API Reference

Full TypeScript interfaces and usage patterns for Roadrunner's shared UI components.

## Inline Table Rows (default list pattern)

Not a shared component — a documented CSS pattern used directly in pages. This is the default visual treatment for all list items (engagements, meetings, dashboard sections, linked entity sections on detail pages).

**Visual structure:**
```
  Name                          Partner        3 msgs · 2/22   [Active]
  ──────────────────────────────────────────────────────────────────────
  Name                          Partner        1 msg · 2/20    [Planned]
  ──────────────────────────────────────────────────────────────────────
```

**CSS pattern:**
```tsx
<Link
  href={`/entity/${id}`}
  className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
>
  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
    {name}
  </span>
  <span className="shrink-0 text-xs text-muted">
    {metadata}
  </span>
  <span className="shrink-0">
    <StatusBadge status={status} />
  </span>
</Link>
```

**Styling constants:**
- Row: `flex items-center px-4 py-2.5 border-b border-border/50`
- Hover: `hover:bg-surface` (list pages) or `hover:bg-surface-hover` (detail page sections)
- Name: `min-w-0 flex-1 truncate text-sm font-medium text-foreground`
- Metadata: `shrink-0 text-xs text-muted`
- Status: `shrink-0` as last element (right-aligned)
- Gap: `gap-3` between all elements

**Usage rules:**
- Status/badge is always the LAST element so all badges align vertically
- Name takes `flex-1` to fill available space
- Use `hidden sm:block` / `hidden md:block` for responsive column visibility
- For fixed-width columns (like dates), use `w-16` or `w-24`
- On detail page sections, use `px-2 py-2` for tighter spacing inside cards

**When to use:** All list items except Programs (PillGrid), Partners/Relationships (TableList), and Events (CalendarCard).

## CompactRow (DEPRECATED)

**File:** `src/components/shared/CompactRow.tsx`

No longer imported anywhere. Kept for reference only. All surfaces now use inline table rows, TableList, CalendarCard, or PillGrid.

---

## PillGrid

**File:** `src/components/shared/PillGrid.tsx`

```typescript
interface PillGridItem {
  id: string;
  name: string;
  href: string;
  count?: number;
}

interface PillGridProps {
  items: PillGridItem[];
  columns?: 2 | 3 | 4;   // Default: 3
}
```

**Visual structure:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Name       3 │ │ Name         │ │ Long Na...  1 │
└──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Name       5 │ │ Name         │ │ Name       2 │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Styling constants:**
- Grid: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-{columns} gap-1.5`
- Pill: `rounded-lg border border-border bg-surface px-3 py-2`
- Hover: `hover:border-accent/50`
- Name: `text-sm font-medium text-foreground truncate`
- Count: `text-xs text-muted` (right-aligned, only if > 0)
- All pills same height (fixed by flex + truncation)

**Usage rules:**
- NO badges, NO status indicators, NO descriptions inside pills. Names only.
- `count` renders only when present and > 0. Use for linked_count or similar.
- Long names truncate with ellipsis — detail is on the detail page.
- Gap is intentionally tight (`gap-1.5`) for density.

**When to use:** Catalog entities with 10+ same-type items. Programs are the canonical use case.

---

## TableList

**File:** `src/components/shared/TableList.tsx`

```typescript
interface TableListColumn {
  value: string;
  width?: string;         // CSS width (e.g., "140px", "200px")
  muted?: boolean;        // Reserved for future per-column color control
}

interface TableListItem {
  id: string;
  href: string;
  columns: TableListColumn[];
}

interface TableListHeader {
  label: string;
  width?: string;         // Should match corresponding column width
}

interface TableListProps {
  items: TableListItem[];
  headers?: TableListHeader[];
}
```

**Visual structure:**
```
  NAME              ORG             SERVICE
  ─────────────────────────────────────────────
  Alice Johnson     AWS Security    GuardDuty
  ─────────────────────────────────────────────
  Bob Smith         AWS Analytics   Athena
  ─────────────────────────────────────────────
  Carol Davis       AWS Compute     EC2
```

**Styling constants:**
- Container: no spacing between rows (table-like)
- Header row: `px-4 py-2`, labels `text-xs font-semibold uppercase tracking-wider text-muted`
- Data row: `px-4 py-2.5 border-b border-border/50`
- Hover: `hover:bg-surface`
- First column: `text-sm font-medium text-foreground` (entity name, flex-1)
- Other columns: `text-sm text-muted` (default width 140px unless overridden)
- Entire row clickable via Link wrapper

**Usage rules:**
- NO badges. NO pills. NO colored indicators. Just text with weight/color hierarchy.
- NO rounded cards per row. Rows separated by subtle bottom borders.
- Column widths should be consistent — set via `width` prop so values align across rows.
- First column is always the entity name (flex-1, takes remaining space).
- Pass `headers` for column labels when metadata columns benefit from labeling.

**When to use:** Portfolio entities where comparable metadata across rows matters. Partners and Relationships are the canonical use cases.

---

## CalendarCard

**File:** `src/components/shared/CalendarCard.tsx`

```typescript
interface CalendarCardItem {
  id: string;
  href: string;
  name: string;
  startDate: string;      // ISO date string (YYYY-MM-DD)
  endDate?: string;        // Optional end date for multi-day events
  location?: string;       // City/venue (use extractCity() before passing)
  typeColor?: string;      // CSS color for left border accent (e.g., "var(--event-conference)")
}

interface CalendarCardProps {
  items: CalendarCardItem[];
  columns?: 1 | 2;        // Default: 2
}
```

**Visual structure:**
```
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ Mar 9–12                     │ │ Jun 15                       │
│ AWS re:Invent 2026           │ │ Partner Summit               │
│ Las Vegas, NV                │ │ San Francisco, CA            │
└──────────────────────────────┘ └──────────────────────────────┘
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ Apr 3–5                      │ │ Sep 20                       │
│ Security Workshop            │ │ Channel Kickoff              │
│ Seattle, WA                  │ │ New York, NY                 │
└──────────────────────────────┘ └──────────────────────────────┘
```

**Styling constants:**
- Grid: `grid grid-cols-1 lg:grid-cols-{columns} gap-2`
- Card: `block rounded-lg border border-border bg-surface px-3 py-2.5`
- Hover: `hover:border-accent/50`
- Optional type color: `border-left: 2px solid {typeColor}` on the card itself
- Date line: `text-xs font-medium text-muted` — uses `formatCompactDateRange()` from format-utils.ts
- Name: `mt-0.5 text-sm font-medium text-foreground truncate`
- Location: `mt-0.5 text-xs text-muted truncate`

**Usage rules:**
- NO type badges inside cards. The colored left border accent provides sufficient type indication.
- Pass `location` through `extractCity()` before passing — show city, not full address.
- Date formatting handled by `formatCompactDateRange()`: "Mar 9–12", "Mar 9 – Apr 2", or "Mar 9".
- `typeColor` should reference CSS variables (e.g., `var(--event-conference)`) for consistency with EventTypeBadge colors.

**When to use:** Temporal/event entities where date is the primary scan dimension. Events are the canonical use case.

---

## DetailHeader

**File:** `src/components/shared/DetailHeader.tsx`

```typescript
interface DetailField {
  label: string;     // Uppercase label (e.g., "STATUS", "LIFECYCLE")
  value: ReactNode;  // Can be text, badge, or link
}

interface DetailHeaderProps {
  title: string;               // Entity name (h1)
  badges?: ReactNode;          // Status/type badges (inline with title)
  subtitle?: string;           // Primary descriptive text
  fields?: DetailField[];      // Key-value grid (max 4 recommended)
  actions?: ReactNode;         // Top-right action buttons
}
```

**Visual structure:**
```
┌──────────────────────────────────────────────────────────┐
│ [title] [badge1] [badge2]                    [actions]   │
│ [subtitle text, leading-relaxed]                         │
│ ─────────────────────────────────────────────────────── │
│ FIELD 1      FIELD 2       FIELD 3       FIELD 4        │
│ value        value         value         value           │
└──────────────────────────────────────────────────────────┘
```

**Styling constants:**
- Wrapper: `mb-6 rounded-xl border border-border bg-surface p-5`
- Title: `text-xl font-semibold text-foreground`
- Subtitle: `mt-1.5 text-sm text-muted leading-relaxed`
- Fields grid: `mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-4 sm:grid-cols-4`
- Field label: `text-xs font-medium uppercase tracking-wider text-muted`
- Field value: `mt-0.5 text-sm text-foreground`

**Usage rules:**
- `subtitle` should be the single most important descriptive text for the entity (What They Do for partners, description for programs, current_state for engagements)
- `fields` should contain 2-4 items. On mobile they stack 2-wide; on desktop 4-wide.
- `actions` slot for EngagementActions menu, SyncButton, or similar. Keep it minimal.

## FilterBar

**File:** `src/components/layout/FilterBar.tsx`

```typescript
interface FilterOption {
  label: string;   // Display text
  value: string;   // Filter value
  color?: string;  // Optional (unused currently, reserved for future)
}

interface FilterBarProps {
  searchPlaceholder?: string;          // Default: "Search..."
  filterOptions: FilterOption[];       // Available filter chips
  activeFilter: string | null;         // Current selection (null = All)
  onSearchChange: (query: string) => void;
  onFilterChange: (value: string | null) => void;
  resultCount: number;
  totalCount: number;
  entityName?: string;                 // Default: "items"
}
```

**Behavior:**
- "All" chip active when `activeFilter === null`
- Click chip → `onFilterChange(value)` (select exclusively)
- Click active chip → `onFilterChange(null)` (deselect, back to All)
- Search is independent of filter — both narrow together

**Consumer state pattern:**
```typescript
const [searchQuery, setSearchQuery] = useState("");
const [activeFilter, setActiveFilter] = useState<string | null>(null);

const filtered = useMemo(() => {
  return items.filter((item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      // search across relevant fields
      if (!matchesAnyField) return false;
    }
    if (activeFilter && item.filterDimension !== activeFilter) return false;
    return true;
  });
}, [items, searchQuery, activeFilter]);
```

## PageHeader

**File:** `src/components/layout/PageHeader.tsx`

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
}
```

Simple h1 + subtitle. Used at the top of every list page.

## EmptyState

**File:** `src/components/layout/EmptyState.tsx`

```typescript
interface EmptyStateProps {
  title: string;
  description?: string;
}
```

Centered message for empty lists or no search results. Two uses:
1. Initial empty state: "No {entities} yet — {how they appear}"
2. Filter empty state: "No matching {entities} — Try adjusting..."

## SyncButton

**File:** `src/components/shared/SyncButton.tsx`

Triggers Airtable sync for a specific entity. Props include `entity`, `label`, and `compact` boolean.

---

## Format Utilities

**File:** `src/lib/format-utils.ts`

### `extractCity(location: string | null | undefined): string`
Extracts compact city display from full location strings. Strips venue names (Expo, Convention Center, Palais), street addresses (numbered addresses, Ave, Blvd), postal codes (75017, E16 1XL, DK-2300, 018956), and direction suffixes (S, N, E, W).

Returns last 2 meaningful segments (city + state/country). Returns empty string for null/empty input.

### `formatCompactDateRange(start: string | null, end: string | null): string`
Formats ISO date strings into compact display:
- Same month: `"Mar 9–12"` (en-dash, no spaces)
- Cross-month: `"Mar 9 – Apr 2"` (spaced em-dash)
- Single date: `"Mar 9"`
- No start: `"TBD"`

### `cleanMeetingTitle(title: string): string`
Strips email-forwarding prefixes (`FW:`, `Fwd:`, `Re:`, `RE:`) and calendar-response prefixes (`Accepted:`, `Tentative:`, `Declined:`) from meeting titles. Handles multiple nested layers.
