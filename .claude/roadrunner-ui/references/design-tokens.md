# Design Tokens

CSS custom properties, spacing, typography, and visual specs for Roadrunner.

---

## CSS Custom Properties

Defined in `src/app/globals.css` via Tailwind v4 `@theme inline` block.

### Core Colors

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

| Status | Dot Class | CSS Variable |
|---|---|---|
| active | `bg-emerald-500` | `--color-status-active` (#22c55e) |
| blocked | `bg-amber-500` | `--color-status-blocked` (#f59e0b) |
| completed | `bg-violet-500` | `--color-status-completed` (#8b5cf6) |
| archived | `bg-zinc-500` | `--color-status-archived` (#6b7280) |

### Program Type Colors

| Type | Variable | Color |
|---|---|---|
| Competency | `--color-program-competency` | #3b82f6 (blue) |
| Service Ready | `--color-program-service-ready` | #8b5cf6 (violet) |
| SCA | `--color-program-sca` | #f59e0b (amber) |
| Funding | `--color-program-funding` | #10b981 (emerald) |
| Channel | `--color-program-channel` | #ec4899 (pink) |
| Enablement | `--color-program-enablement` | #06b6d4 (cyan) |

### Confidence Colors (Inbox)

| Level | Background | Text |
|---|---|---|
| high | `bg-green-500/20` | `text-green-400` |
| medium | `bg-yellow-500/20` | `text-yellow-400` |
| low | `bg-red-500/20` | `text-red-400` |

---

## Typography Hierarchy

| Element | Size | Weight | Color | Extra |
|---|---|---|---|---|
| Page title (identity bar) | `text-xl` (20px) | `font-semibold` | `text-foreground` | — |
| Section label | `text-xs` (11px) | `font-semibold` | `text-muted` | `uppercase tracking-wider` |
| Sub-label (category) | `text-[10px]` | `font-semibold` | `text-muted/50` | `uppercase tracking-widest` |
| Row primary text | `text-sm` (13px) | `font-medium` | `text-foreground` | — |
| Row secondary | `text-sm` | normal | `text-muted` | — |
| Metadata/dates | `text-xs` (11px) | normal | `text-muted` | — |
| Body prose | `text-sm` | normal | `text-foreground/80` | `leading-relaxed` |
| Pills/badges | `text-xs` | `font-medium` | tinted color | `whitespace-nowrap` |
| Sidebar zone label | `text-[10px]` | `font-medium` | `text-muted/40` | `uppercase tracking-[0.1em]` |
| List group label | `text-xs` | `font-medium` | `text-muted/70` | `uppercase tracking-[0.08em]` |

---

## Spacing

### Page Layout
- Page padding: `p-6 lg:p-8`
- Two-column grid: `grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8`
- Right column border: `lg:border-l lg:border-border/20 lg:pl-8`
- Section spacing (between sections): `space-y-8` or explicit `pt-6`

### Section Separation
- Between sections on detail pages: `pt-6 border-t border-border/20`
- First section after identity bar: no top border
- Between right-column sections: `mt-6 pt-6 border-t border-border/20`

### Identity Bar
- Bottom border: `border-b border-border/30`
- Bottom padding: `pb-4`
- Bottom margin: `mb-6`

### Row Spacing
- Row padding: `px-3 py-2.5`
- Row border: `border-b border-border/20`
- Row hover: `hover:bg-surface/50`
- Gap between row elements: `gap-3` or `gap-4`

### Collapsible Groups (List Pages)
- Groups container: `space-y-8`
- Summary padding: `pb-2`
- No card wrapper around `<details>`
- Summary chevron: 14px SVG, `group-open:rotate-90`

---

## Status Dots

| Context | Size | Classes |
|---|---|---|
| Identity bar | 8px | `h-2 w-2 shrink-0 rounded-full` |
| Entity rows | 6px | `h-1.5 w-1.5 shrink-0 rounded-full` |

Always include `title={status}` for accessibility.

---

## Pills / Badges

### Standard pill
```
text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap
bg-{color}/10-15  text-{color}
```

### Specific pill patterns

| Type | Background | Text |
|---|---|---|
| Segment | `bg-accent/10` | `text-accent` |
| Pillar | per-pillar colors in PillarBadge | — |
| Owner (Me) | `bg-accent/10` | `text-accent` |
| Owner (Partner) | `bg-emerald-500/10` | `text-emerald-400` |
| Owner (Internal) | `bg-amber-500/10` | `text-amber-400` |
| Owner (3rd Party) | `bg-purple-500/10` | `text-purple-400` |
| GEO / ICS | `bg-muted/15` | `text-muted` |

---

## Interactive States

| Element | Idle | Hover | Active/Selected |
|---|---|---|---|
| Entity row | `border-border/20` | `bg-surface/50` | N/A |
| Filter chip | `border-border bg-background text-muted` | `hover:text-foreground` | `border-accent bg-accent/10 text-accent` |
| Nav item | `text-muted` | `bg-surface-hover text-foreground` | `bg-accent/10 text-accent` |
| Button (primary) | `bg-accent text-white` | `bg-accent-hover` | `disabled:opacity-50` |
| Accent link | `text-accent` | `hover:underline` or `hover:text-accent-hover` | — |

---

## Data Formatting

All utilities in `src/lib/format-utils.ts`:

- **Locations:** `extractCity()` on list pages, full text on detail pages
- **Meeting titles:** `cleanMeetingTitle()` everywhere
- **Compact dates:** `formatCompactDateRange()` for list rows
- **Footer dates:** `formatFooterDate()` for entity footers
- **Empty values:** Nothing on list rows, "—" on detail pages
