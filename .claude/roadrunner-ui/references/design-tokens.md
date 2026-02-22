# Design Tokens

CSS custom properties, color palette, spacing conventions, and typography for Roadrunner.

## CSS Custom Properties

Defined in `src/app/globals.css` via Tailwind v4 `@theme inline` block.

### Core Colors

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

Used by StatusBadge for engagement/program status:

| Status | Background | Text |
|---|---|---|
| planned | `bg-blue-500/20` | `text-blue-400` |
| active | `bg-green-500/20` | `text-green-400` |
| paused | `bg-yellow-500/20` | `text-yellow-400` |
| completed | `bg-purple-500/20` | `text-purple-400` |

### Confidence Colors

Used for AI classification confidence display:

| Level | Background | Text |
|---|---|---|
| high | `bg-green-500/20` | `text-green-400` |
| medium | `bg-yellow-500/20` | `text-yellow-400` |
| low | `bg-red-500/20` | `text-red-400` |

### Program Type Colors

Defined as CSS custom properties for ProgramTypeBadge:

| Type | Color Variable |
|---|---|
| Competency | `--color-program-competency` (#3b82f6, blue) |
| Service Ready | `--color-program-service-ready` (#8b5cf6, violet) |
| SCA | `--color-program-sca` (#f59e0b, amber) |
| Funding | `--color-program-funding` (#10b981, emerald) |
| Channel | `--color-program-channel` (#ec4899, pink) |
| Enablement | `--color-program-enablement` (#06b6d4, cyan) |

### Event Type Colors

| Type | Background | Text |
|---|---|---|
| Conference | `bg-blue-500/20` | `text-blue-400` |
| Summit | `bg-purple-500/20` | `text-purple-400` |
| Webinar | `bg-green-500/20` | `text-green-400` |
| Workshop | `bg-amber-500/20` | `text-amber-400` |
| Other | `bg-border` | `text-muted` |

## Spacing Conventions

### Page Layout
- Page padding: `p-6 lg:p-8`
- Section gap (between groups): `space-y-8`
- Row gap (between items within a group): `space-y-2`
- Detail page two-column: `grid gap-6 lg:grid-cols-3`

### Cards & Rows
- Inline table rows: `px-4 py-2.5` (list pages), `px-2 py-2` (inside detail page section cards)
- Detail cards: `p-5`
- DetailHeader: `p-5 mb-6`
- Border radius: `rounded-xl` (cards), `rounded-lg` (CalendarCard items, PillGrid pills)

### Group Headers
- Margin below: `mb-3`
- Label: `text-sm font-semibold uppercase tracking-wider text-muted`
- Count badge: `rounded-full bg-border px-2 py-0.5 text-xs text-muted`

### FilterBar
- Margin below: `mb-6`
- Chip padding: `px-3 py-1`
- Chip text: `text-xs font-medium`

## Typography

### Headings
- Page title (h1 in PageHeader): `text-2xl font-bold`
- Detail page title (in DetailHeader): `text-xl font-semibold`
- Section header (group label): `text-sm font-semibold uppercase tracking-wider text-muted`
- Time section header: `text-lg font-semibold text-foreground`

### Body Text
- Row primary: `font-medium text-foreground`
- Row secondary: `text-sm text-muted`
- Metadata: `text-xs text-muted`
- Detail field label: `text-xs font-medium uppercase tracking-wider text-muted`
- Detail field value: `text-sm text-foreground`

### Badge Text
- All badges: `text-xs font-medium whitespace-nowrap`
- Badge padding: `px-2 py-0.5` (standard) or `px-2.5 py-0.5` (association chips)

## Interactive States

| Element | Idle | Hover | Active/Selected |
|---|---|---|---|
| Inline row | `border-border/50` | `bg-surface` (list) / `bg-surface-hover` (detail) | N/A |
| Filter chip | `border-border bg-background text-muted` | `hover:text-foreground` | `border-accent bg-accent/10 text-accent` |
| Nav item | `text-muted` | `bg-surface-hover text-foreground` | `bg-accent/10 text-accent` |
| Button (primary) | `bg-accent text-white` | `bg-accent-hover` | `disabled:opacity-50` |

## Common Patterns

### Inline badge (no dedicated component)
```tsx
<span className="rounded-full bg-{color}/15 px-2 py-0.5 text-xs font-medium text-{color} whitespace-nowrap">
  {label}
</span>
```
Replace `{color}` with the appropriate Tailwind color (accent, blue-500, purple-500, etc.).

### Metadata in inline table rows
```tsx
<span className="shrink-0 text-xs text-muted hidden sm:block">
  {count} msgs · {date}
</span>
```

### Data formatting
- Locations: `extractCity(location)` on list pages, full text on detail pages
- Meeting titles: `cleanMeetingTitle(title)` everywhere
- Compact dates: `formatCompactDateRange(start, end)` for cards
- All utilities in `src/lib/format-utils.ts`