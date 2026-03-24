# Component API Reference

Shared components, CSS patterns, and usage conventions for Roadrunner UI. Implements the container types and visual patterns defined in SKILL.md.

---

## CSS Patterns (inline, not components)

These are documented patterns implemented directly in page files.

### Identity Bar

Top of every detail page. Inline pattern — no component file.

```tsx
<div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
  <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
  {/* Type/status badges */}
  <TypeBadge type={entity.type} />
  <span className={`shrink-0 h-2 w-2 rounded-full ${dotColor}`} title={status} />
  <div className="ml-auto flex items-center gap-2">
    {/* Actions — secondary buttons or dropdown */}
  </div>
</div>
```

**Rules:**
- Title: `text-2xl font-semibold` (24px)
- Status dot: 8px (`h-2 w-2`)
- Badges between title and actions
- Actions right-aligned via `ml-auto`
- One primary action max per page (rendered elsewhere, e.g., top-right corner)

### Section (container type)

Header + content, optionally collapsible.

**Non-collapsible:**
```tsx
<div className="pt-6 border-t border-border/20"> {/* omit for first section */}
  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
    Section Name
    <span className="ml-1.5 font-normal text-muted/50">{count}</span>
  </h2>
  <div>
    {/* Content: rows, prose, sub-components */}
  </div>
</div>
```

**Collapsible:**
```tsx
<details open className="group pt-6 border-t border-border/20">
  <summary className="flex cursor-pointer list-none items-center gap-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
    <svg
      width="14" height="14" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      className="shrink-0 transition-transform group-open:rotate-90"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
    Section Name
    <span className="font-normal text-muted/50">{count}</span>
  </summary>
  <div className="mt-3">
    {/* Content */}
  </div>
</details>
```

### Row (container type)

Single list item. Clickable when linking to a detail page.

```tsx
<Link
  href={`/entity/${id}`}
  className="flex items-center gap-3 border-b border-border/20 px-3 py-3 transition-colors hover:bg-surface/50"
>
  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
    {name}
  </span>
  {/* Right-aligned metadata, badges, dots — all shrink-0 */}
  <span className="shrink-0 text-xs text-muted">{metadata}</span>
  <span className="shrink-0"><PillarBadge pillar={pillar} /></span>
  <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} title={status} />
</Link>
```

**Rules:**
- Name: `flex-1 truncate text-sm font-medium`
- All right-side elements: `shrink-0`
- `items-center` when badges/dots present; `items-baseline` for text-only
- Padding: `px-3 py-3` (standard) or `px-3 py-3.5` (generous, for tasks)
- Border: `border-b border-border/20`
- Hover: `hover:bg-surface/50 transition-colors`

### Detail Panel (container type)

Full-width prose/summary content.

```tsx
<div className="text-[15px] text-foreground/85 leading-relaxed">
  {/* Prose paragraphs, structured text */}
</div>
```

For AI-generated content, wrap with the AI marker:
```tsx
<div className="border-l-2 border-accent/25 pl-4">
  <div className="text-[15px] text-foreground/85 leading-relaxed">
    {/* AI-generated content */}
  </div>
</div>
```

### Sub-Label / Value Pair

Used in right-column reference sections.

```tsx
<div>
  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">
    Label
  </span>
  <span className="text-sm text-foreground">{value}</span>
</div>
```

For grid layouts (Deployment & Pricing section):
```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Architecture</span>
    <PillBadge>{value}</PillBadge>
  </div>
  <div>
    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Listing Types</span>
    <div className="flex flex-wrap gap-1">{pills}</div>
  </div>
</div>
```

---

## AI Content Rendering Patterns

### Brain Section Renderer

Parses the brain synthesis text on `## ` headers and renders each section.

```tsx
function renderBrainSections(content: string) {
  const sections = content.split(/^## /m).filter(Boolean);

  return sections.map((section, i) => {
    const [title, ...body] = section.split('\n');
    const bodyText = body.join('\n').trim();

    return (
      <div key={i} className={i > 0 ? 'mt-6' : ''}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          {title.trim()}
        </h3>
        <div className="border-l-2 border-accent/25 pl-4">
          <p className="text-[15px] text-foreground/85 leading-relaxed">
            {bodyText}
          </p>
        </div>
      </div>
    );
  });
}
```

**Fallback:** If content contains no `## ` markers (legacy data), render as a single AI-styled Detail Panel.

### Meeting Summary Section Renderer

Parses Discussion / Decisions / Key Context sections.

```tsx
function renderSummarySections(summary: string) {
  // Split on section labels that appear on their own line
  const sectionPattern = /^(Discussion|Decisions|Key Context)\s*$/m;
  // Parse and render each as a labeled block with AI styling
}
```

Each section: sub-label header + AI-styled prose content.

### Condensed Digest Renderer

Renders the compact bullet digest with category tags.

```tsx
function renderCondensedDigest(condensed: string) {
  const lines = condensed.split('\n').filter(l => l.trim().startsWith('-'));

  return (
    <div className="border-l-2 border-accent/25 pl-4 space-y-1.5">
      {lines.map((line, i) => {
        // Extract category tag (e.g., "Discussed:", "Decided:")
        const match = line.trim().replace(/^-\s*/, '').match(/^(\w+):\s*(.*)/);
        if (!match) return <p key={i} className="text-sm text-foreground/80">{line.trim().replace(/^-\s*/, '')}</p>;

        const [, tag, content] = match;
        return (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase text-muted/60 pt-0.5 w-16">
              {tag}
            </span>
            <span className="text-sm text-foreground/80">{content}</span>
          </div>
        );
      })}
    </div>
  );
}
```

### Parsing Safety

Always handle edge cases:
- No `##` markers → render as single block
- Empty content → show synthesis prompt, not empty state
- Malformed bullets → render as plain text
- Never show raw markdown tokens (`##`, `**`, `-`) to the user

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

- Click chip → select exclusively. Click active chip → deselect (back to All).
- Search + filter work independently.
- Shows "X of Y items" count.
- Active chip: `border-accent bg-accent/10 text-accent`
- Inactive chip: `border-border bg-background text-muted hover:text-foreground`

### PageHeader (`components/layout/PageHeader.tsx`)

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
}
```

`h1` (`text-2xl`) + subtitle. Top of every list page.

### EmptyState (`components/layout/EmptyState.tsx`)

```typescript
interface EmptyStateProps {
  title: string;
  description?: string;
}
```

Two uses: initial empty ("No {entities} yet") and filter empty ("No matching {entities}").

### ContactGroup (`components/shared/ContactGroup.tsx`)

Groups contacts by org_type with section headers. Sorts within groups by role priority.

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

### ContactRow (`components/shared/ContactRow.tsx`)

Single contact: name + display label + title + email.

```typescript
interface ContactRowProps {
  name: string | null;
  email: string | null;
  title: string | null;
  role: string | null;
  org_type: string | null;
}
```

Uses `getDisplayRole()` for label (named role → title → org_type fallback).

### CollapsibleParticipants (`components/shared/CollapsibleParticipants.tsx`)

```typescript
interface Props {
  participants: ParticipantWithLink[];
  engagementId: string;
  partnerName: string | null;
  compact?: boolean;  // suppresses card wrapper
}
```

Count + org breakdown summary, expandable to full ContactGroup.

### CollapsibleEmails (`components/shared/CollapsibleEmails.tsx`)

```typescript
interface Props {
  items: TimelineItem[];
  participants?: Participant[];
  compact?: boolean;  // suppresses card wrapper
}
```

Collapsible timeline. Wraps Timeline component.

### Timeline (`components/shared/Timeline.tsx`)

Vertical dot timeline for messages and meetings. No card wrapper.

---

## Notes Components (`components/notes/`)

### NoteWorkspace

Three-mode workspace. Manages its own state based on props.

**Mode 1 (Editing):** Raw notes textarea + "Summarize with AI" (primary) + "Cancel" (secondary, only if returning from saved)
**Mode 2 (Review):** AI summary displayed with structured sections + TaskEditor (interactive, grouped by owner) + "Save" (primary) + "Back to Editing" (secondary)
**Mode 3 (Saved):** Read-only summary with parsed sections + Tasks in ContextSidebar (read-only, owner badges, "this meeting" highlight) + "Edit Notes" (secondary)

One path: Edit → Summarize → Save. No Re-summarize from saved mode.

### MeetingNotesSection

Client bridge for meeting detail. Three states: no note exists, creating new note, existing note. Passes `initialPhase: "saved"` for completed notes.

### ContextSidebar

Partner context during note-taking. Sections:
- Partner profile summary (condensed: name, segment, what_they_do)
- Key contacts (from registry)
- Scratchpad entries
- Open tasks (owner badges, "this meeting" highlight via `currentNoteId` prop)
- Previous notes (scoped to same engagement, excludes current meeting)

### PreviousNotes

Collapsible previous note summaries. Engagement-scoped with self-exclusion.

### TaskEditor

Task management in NoteWorkspace Mode 2 only. Grouped by owner, add/toggle/delete. Interactive during the extraction moment.

---

## Partner Components (`components/partners/`)

### PartnerScratchpad

Living context scratchpad. Enter to submit, optimistic updates, hover to reveal delete.

```typescript
interface Props {
  partnerId: string;
  compact?: boolean;  // suppresses card wrapper — used on partner detail
}
```

### PartnerTasksSection

Open tasks grouped by owner with toggle capability.

---

## Format Utilities (`lib/format-utils.ts`)

| Function | Purpose | Example |
|---|---|---|
| `extractCity(location)` | Compact location for list rows | "Venetian Expo, Las Vegas, NV" → "Las Vegas, NV" |
| `cleanMeetingTitle(title)` | Strip forwarding prefixes | "FW: Re: Meeting" → "Meeting" |
| `formatCompactDateRange(start, end)` | Compact date ranges | Same month: "Mar 9–12". Cross: "Mar 9 – Apr 2" |
| `formatFooterDate(dateStr)` | Footer timestamps | Compact relative or absolute |
| `displayName(name, email)` | Best available name | Name if available, email prefix fallback |
| `safeDateDisplay(date)` | Null-safe date display | Returns formatted date or "—" |

### Data Display Rules

| Context | Rule |
|---|---|
| List row locations | `extractCity()` — compact |
| Detail page locations | Full text |
| Meeting titles | Always `cleanMeetingTitle()` |
| Compact dates | `formatCompactDateRange()` |
| Empty list row fields | Omit entirely |
| Empty detail page fields | Show "—" |
| AI content not yet generated | Show prompt to generate, not empty block |