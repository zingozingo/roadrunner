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

| Status | Dot Class | CSS Variable | Hex |
|---|---|---|---|
| active | `bg-emerald-500` | `--color-status-active` | #22c55e |
| planned | `bg-blue-400` | — | #60a5fa |
| blocked | `bg-amber-500` | `--color-status-blocked` | #f59e0b |
| completed | `bg-violet-500` | `--color-status-completed` | #8b5cf6 |
| archived | `bg-zinc-500` | `--color-status-archived` | #6b7280 |

### Meeting Status Colors

| Status | Dot Class | Hex |
|---|---|---|
| scheduled | `bg-blue-400` | #60a5fa |
| completed | `bg-emerald-500` | #22c55e |
| cancelled | `bg-zinc-500` | #6b7280 |
| did_not_occur | `bg-red-400` | #f87171 |

### Pillar Colors

| Pillar | Background | Text |
|---|---|---|
| Co-Sell | `bg-emerald-500/10` | `text-emerald-400` |
| Co-Build | `bg-blue-500/10` | `text-blue-400` |
| Co-Market | `bg-purple-500/10` | `text-purple-400` |

### Owner Colors

| Owner | Background | Text |
|---|---|---|
| Me | `bg-accent/10` | `text-accent` |
| Partner | `bg-emerald-500/10` | `text-emerald-400` |
| Internal | `bg-amber-500/10` | `text-amber-400` |
| Third Party | `bg-purple-500/10` | `text-purple-400` |

### Program Type Colors

| Type | CSS Variable | Hex |
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
| Page title | `text-2xl` (24px) | `font-semibold` | `text-foreground` | — |
| Section label | `text-xs` (12px) | `font-semibold` | `text-muted` | `uppercase tracking-wider` |
| Sub-label (category) | `text-[10px]` | `font-semibold` | `text-muted/50` | `uppercase tracking-widest` |
| Row primary text | `text-sm` (14px) | `font-medium` | `text-foreground` | — |
| Row secondary | `text-sm` | normal | `text-muted` | — |
| Body prose | `text-[15px]` | normal | `text-foreground/85` | `leading-relaxed` |
| Metadata/dates | `text-xs` (12px) | normal | `text-muted` | — |
| Pills/badges | `text-xs` | `font-medium` | tinted color | `whitespace-nowrap` |
| Sidebar zone label | `text-[10px]` | `font-medium` | `text-muted/40` | `uppercase tracking-[0.12em]` |
| List group label | `text-xs` | `font-medium` | `text-muted/70` | `uppercase tracking-[0.08em]` |

---

## Semantic Patterns

Reusable class combinations for common UI elements.

### AI Content Marker
```
border-l-2 border-accent/25 pl-4
```
Applied to: brain synthesis sections, meeting summaries, engagement summaries, condensed digest blocks. Signals "AI-generated content."

### Section Separator
```
pt-6 border-t border-border/20
```
Between sections on detail pages. First section after identity bar: no top border.

### Row Separator
```
border-b border-border/20
```
Between items in any list.

### Hover State (universal)
```
hover:bg-surface/50 transition-colors
```

### Standard Pill
```
text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap bg-{color}/10 text-{color}
```

---

## Spacing

### Page Layout
- Page shell: `mx-auto max-w-7xl p-6 lg:p-8`
- Two-column grid: `grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 lg:gap-12`
- Right column border: `lg:border-l lg:border-border/20 lg:pl-8`
- Section spacing: `space-y-8` or explicit `pt-6`

### Identity Bar
- Bottom border: `border-b border-border/30`
- Bottom padding: `pb-4`
- Bottom margin: `mb-6`

### Row Spacing
- Standard rows: `px-3 py-3`
- Task rows (generous): `px-3 py-3.5`
- Row border: `border-b border-border/20`
- Gap between row elements: `gap-3`

### Section Spacing
- Between detail page sections: `pt-6 border-t border-border/20`
- Between right-column sections: `mt-6 pt-6 border-t border-border/20`
- Content below section header: `mt-3`

### Collapsible Groups (List Pages)
- Groups container: `space-y-8`
- Summary padding: `pb-2`
- Summary chevron: 14px SVG, `group-open:rotate-90`

---

## Status Dots

| Context | Size | Classes |
|---|---|---|
| Identity bar | 8px | `h-2 w-2 shrink-0 rounded-full` |
| Row items | 6px | `h-1.5 w-1.5 shrink-0 rounded-full` |

Always include `title={status}` for accessibility.

---

## Interactive States

| Element | Idle | Hover | Active/Selected |
|---|---|---|---|
| Entity row | `border-border/20` | `bg-surface/50` | N/A |
| Filter chip | `border-border bg-background text-muted` | `hover:text-foreground` | `border-accent bg-accent/10 text-accent` |
| Nav item | `text-muted` | `bg-surface-hover text-foreground` | `bg-accent/10 text-accent` |
| Button (primary) | `bg-accent text-white rounded-lg` | `bg-accent-hover` | `disabled:opacity-50` |
| Button (secondary) | `border border-border text-foreground rounded-lg` | `bg-surface-hover` | `disabled:opacity-50` |
| Button (destructive) | `text-red-400` | `text-red-300` | — |
| Inline action | `text-accent text-sm` | `underline` | — |
| Accent link | `text-accent` | `text-accent-hover underline` | — |

---

## Data Formatting

All utilities in `src/lib/format-utils.ts`:

| Utility | Usage |
|---|---|
| `extractCity(location)` | List rows (compact). Detail pages show full text. |
| `cleanMeetingTitle(title)` | Everywhere meeting titles render. |
| `formatCompactDateRange(start, end)` | List rows for date ranges. |
| `formatFooterDate(dateStr)` | Entity footers and metadata. |

### Empty Data Rules

| Context | Rule |
|---|---|
| List rows | Show nothing — omit the field entirely |
| Detail page fields | "—" for missing values |
| AI content | Show prompt to generate — not an empty block |