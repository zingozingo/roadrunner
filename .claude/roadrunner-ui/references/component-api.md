# Component API Reference

Full TypeScript interfaces and usage patterns for Roadrunner's shared UI components.

## CompactRow

**File:** `src/components/shared/CompactRow.tsx`

```typescript
interface CompactRowProps {
  href: string;                    // Link destination
  primary: string;                 // Entity name (always shown)
  badges?: ReactNode;              // Status/type badges (inline with name)
  secondary?: string;              // Description line (line-clamped)
  meta?: ReactNode;                // Right-aligned metadata
  secondaryLineClamp?: 1 | 2;     // Default: 1
}
```

**Visual structure:**
```
┌──────────────────────────────────────────────────────────┐
│ [primary] [badge1] [badge2]                    [meta]    │
│ [secondary text, line-clamped]                           │
└──────────────────────────────────────────────────────────┘
```

**Styling constants:**
- Wrapper: `rounded-xl border border-border bg-surface px-4 py-3`
- Hover: `hover:border-accent/40`
- Primary: `font-medium text-foreground`
- Secondary: `mt-0.5 text-sm text-muted line-clamp-{1|2}`
- Meta: `shrink-0 text-xs text-muted text-right`
- Gap between left/right: `gap-3`

**Usage rules:**
- `primary` is always a string, never ReactNode. The name is always plain text.
- `badges` should use existing badge components (StatusBadge, ProgramTypeBadge, etc.) or the inline badge pattern.
- `secondary` is a string, not ReactNode. Build it by joining fragments: `[a, b, c].filter(Boolean).join(" · ")`
- `meta` is ReactNode for flexibility — can be a simple span, a stacked div, or association chips.
- When `meta` has multiple lines, use: `<div className="flex flex-col items-end gap-0.5">...</div>`

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