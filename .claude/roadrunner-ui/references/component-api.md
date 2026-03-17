# Component API Reference

Shared components, CSS patterns, and usage conventions for Roadrunner UI.

---

## CSS Patterns (not components)

These are documented patterns implemented inline in page files, not shared components.

### Identity Bar

Replaces the old DetailHeader component on all detail pages. Inline pattern — no component file.

```tsx
<div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
  <h1 className="text-xl font-semibold text-foreground">{name}</h1>
  {/* Type/status badges */}
  <TypeBadge type={entity.type} />
  <span className={`shrink-0 h-2 w-2 rounded-full ${dotColor}`} title={status} />
  <div className="ml-auto">
    <EntityActions entity={entity} />
  </div>
</div>
```

**Rules:**
- Title is always `text-xl font-semibold`
- Status dot: 8px (`h-2 w-2`) colored circle (see Status Dots below)
- Type badges and ad-hoc pills appear between title and actions
- Actions right-aligned via `ml-auto`
- Bottom border: `border-b border-border/30`
- Bottom margin: `mb-6`

### Clickable Entity Row

Used for linked engagements on detail pages (programs, events, relationships, partners).

```tsx
<Link
  href={`/engagements/${eng.id}`}
  className="flex items-center gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
>
  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
    {eng.name}
  </span>
  {eng.partner_name && (
    <span className="shrink-0 text-xs text-muted">{eng.partner_name}</span>
  )}
  {eng.pillar && (
    <span className="shrink-0"><PillarBadge pillar={eng.pillar} /></span>
  )}
  <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} title={eng.status} />
</Link>
```

**Rules:**
- `items-center` (not `items-baseline`) when dots are present
- Name: `flex-1 truncate text-sm font-medium`
- Metadata/badges: `shrink-0` right-aligned
- Status dot last (6px, `h-1.5 w-1.5`)
- Border: `border-b border-border/20`
- Hover: `hover:bg-surface/50`

### Flat List Row

Used on list pages inside `<details>` groups. Same hover/border pattern.

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
- `items-baseline` for text-only rows (no dots)
- `items-center` when dots/badges are inline
- No card wrapper — rows sit directly under `<details>` summary

### Section Label

```tsx
<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
  Section Name
  <span className="ml-1.5 font-normal text-muted/50">{count}</span>
</h2>
```

`text-xs font-semibold uppercase tracking-wider text-muted`. Count as plain `text-muted/50`. `mb-2` for text, `mb-3` for lists.

### Sub-Label (label/value pairs)

```tsx
<span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Label</span>
<span className="text-sm text-foreground">{value}</span>
```

### Status Dots

Inline colored circles for status indication.

| Context | Size | Classes |
|---|---|---|
| Identity bar | 8px | `h-2 w-2 rounded-full` |
| Entity rows | 6px | `h-1.5 w-1.5 rounded-full` |

**Engagement/linked engagement colors:**
| Status | Class |
|---|---|
| active | `bg-emerald-500` |
| planned | `bg-blue-400` |
| blocked | `bg-amber-500` |
| completed | `bg-violet-500` |
| archived | `bg-zinc-500` |

**Meeting colors:**
| Status | Class |
|---|---|
| scheduled | `bg-blue-400` |
| completed | `bg-emerald-500` |
| cancelled | `bg-zinc-500` |
| no_show | `bg-red-400` |

### Compact Prop Pattern

Three components support a `compact` boolean prop (default `false`). When `true`, the `rounded-xl border border-border bg-surface p-4` card wrapper is suppressed.

| Component | File | Callers using `compact` |
|---|---|---|
| PartnerScratchpad | `components/partners/PartnerScratchpad.tsx` | `partners/[id]/page.tsx` |
| CollapsibleParticipants | `components/shared/CollapsibleParticipants.tsx` | `engagements/[id]/page.tsx` |
| CollapsibleEmails | `components/shared/CollapsibleEmails.tsx` | `engagements/[id]/page.tsx` |

Usage: `<CollapsibleParticipants participants={...} engagementId={id} partnerName={name} compact />`

---

## Shared Components

### FilterBar (`components/layout/FilterBar.tsx`)

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

- Click chip = select exclusively. Click active chip = deselect (back to All).
- Search + filter work independently.
- Shows "X of Y items" count.

### PageHeader (`components/layout/PageHeader.tsx`)

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
}
```

Simple h1 + subtitle. Used at top of every list page.

### EmptyState (`components/layout/EmptyState.tsx`)

```typescript
interface EmptyStateProps {
  title: string;
  description?: string;
}
```

Two uses: initial empty ("No {entities} yet") and filter empty ("No matching {entities}").

### CollapsibleEmails (`components/shared/CollapsibleEmails.tsx`)

```typescript
interface Props {
  items: TimelineItem[];
  participants?: Participant[];
  compact?: boolean;  // default false — suppresses card wrapper
}
```

Collapsible timeline toggle. Wraps the `Timeline` component.

### CollapsibleParticipants (`components/shared/CollapsibleParticipants.tsx`)

```typescript
interface Props {
  participants: ParticipantWithLink[];
  engagementId: string;
  partnerName: string | null;
  compact?: boolean;  // default false — suppresses card wrapper
}
```

Collapsible participant list with org breakdown summary. Wraps `ParticipantList`.

### Timeline (`components/shared/Timeline.tsx`)

Vertical dot timeline rendering messages and meetings. No card wrapper (renders items directly). Used inside `CollapsibleEmails`.

### ContactRow (`components/shared/ContactRow.tsx`)

Renders a single contact: name + display label + title + email. Uses `getDisplayRole()` from `contact-display.ts` for the label (named role → title → org_type fallback).

```typescript
interface ContactRowProps {
  name: string | null;
  email: string | null;
  title: string | null;
  role: string | null;
  org_type: string | null;
}
```

Used by every contact surface in the app (partner detail, engagement detail, meeting detail, relationship detail, ContextSidebar).

### ContactGroup (`components/shared/ContactGroup.tsx`)

Groups contacts by org_type with section headers ("AWS", "Partner", "Third Party"). Sorts within each group by role priority (`sortContactsByRole`). Renders each contact via ContactRow.

```typescript
interface ContactGroupProps {
  contacts: Array<{
    name: string | null;
    email: string | null;
    title: string | null;
    role: string | null;
    org_type: string | null;
  }>;
}
```

### ParticipantList (`components/shared/ParticipantList.tsx`)

Display-only participant list (36 lines). Wraps ContactGroup. No editing capability — contacts are read-only in Roadrunner (Decision #216).

### Notes Components (`components/notes/`)

- **NoteWorkspace** — Full editing + review phases, auto-save, AI summarize
- **MeetingNotesSection** — Client bridge for meeting detail (3-state: no note, creating, existing)
- **ContextSidebar** — Partner context during note-taking
- **PreviousNotes** — Collapsible previous note summaries
- **TaskEditor** — Task management (grouped by owner, add/toggle/delete)

### Partner Components (`components/partners/`)

- **PartnerScratchpad** — Living context scratchpad (Enter to submit, optimistic, hover-delete). `compact` prop suppresses card wrapper.
- **PartnerTasksSection** — Open tasks grouped by owner with toggle capability

---

## Format Utilities (`lib/format-utils.ts`)

### `extractCity(location): string`
Extracts compact city from full location. `"Venetian Expo, Las Vegas, NV"` → `"Las Vegas, NV"`.

### `formatCompactDateRange(start, end): string`
Same month: `"Mar 9–12"`. Cross-month: `"Mar 9 – Apr 2"`. Single: `"Mar 9"`. No start: `"TBD"`.

### `cleanMeetingTitle(title): string`
Strips `FW:`, `Fwd:`, `Re:`, `Accepted:`, `Tentative:`, `Declined:` prefixes.

### `formatFooterDate(dateStr): string`
Compact footer date. Used in entity footers and metadata.

### Data Display Rules

1. **Locations:** `extractCity()` on list pages. Full address on detail pages.
2. **Meeting titles:** Always `cleanMeetingTitle()`.
3. **Dates:** `formatCompactDateRange()` for compact. Full on detail pages.
4. **Empty data:** Show nothing in list rows. Detail pages use "—" for missing values.
