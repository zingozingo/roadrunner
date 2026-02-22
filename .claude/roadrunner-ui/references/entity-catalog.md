# Entity Catalog

Field mappings for all 6 entity types in Roadrunner. Each entity maps its fields into the appropriate visual treatment component and DetailHeader slots.

## Entity → Component Mapping

| Entity | List Page Component | Detail Page Linked Sections |
|---|---|---|
| Engagements | CompactRow | CompactRow (in ExpandableList) |
| Partners | TableList | — (Partners aren't linked from other pages) |
| Programs | PillGrid | — (Programs aren't linked from other pages) |
| Events | CalendarCard | — (Events aren't linked from other pages) |
| Meetings | CompactRow (Phase 2 redesign planned) | MeetingTimeline |
| Relationships | TableList | CompactRow (in ExpandableList) |

---

## Engagements

**Type:** `Engagement` from `src/lib/types.ts`
**List page:** `src/app/engagements/page.tsx` (server component)
**Detail page:** `src/app/engagements/[id]/page.tsx` (server component — strongest reference)
**Groups by:** status (planned → active → paused → completed → archived)
**Visual treatment:** CompactRow (activity item with status and message count)

### CompactRow Mapping

| Slot | Value |
|---|---|
| primary | `eng.name` |
| badges | `<StatusBadge status={eng.status} />` |
| secondary | `eng.partner_name` |
| meta | Message count + updated date (stacked) |

```tsx
<CompactRow
  href={`/engagements/${eng.id}`}
  primary={eng.name}
  badges={<StatusBadge status={eng.status} />}
  secondary={eng.partner_name ?? undefined}
  meta={
    <div className="flex flex-col items-end gap-0.5">
      <span>{eng.message_count} msg{eng.message_count !== 1 ? "s" : ""}</span>
      <span>{new Date(eng.updated_at).toLocaleDateString()}</span>
    </div>
  }
/>
```

### DetailHeader Mapping

| Slot | Value |
|---|---|
| title | `engagement.name` |
| badges | StatusBadge |
| subtitle | — (removed; current_state renders only in body via CurrentStateCard) |
| fields | Partner (linked), Pillar, Priority, Updated date |
| actions | EngagementActions menu |

### Meeting-in-Thread Cards (Source Emails section)

When a message in the engagement thread has an associated meeting (via `meetings.message_id` FK), it renders as a **distinct meeting card** instead of a plain email entry. This is a reusable pattern: **when meetings appear inside non-meeting contexts (engagement threads, partner activity), they render as distinct clickable cards with temporal data prominent.**

Implementation:
- Engagement page fetches `getMeetingsByEngagement(id)` and builds a `Record<string, Meeting>` keyed by `message_id`
- Map is passed through `CollapsibleEmails` → `Timeline` as `meetingsByMessageId` prop
- In Timeline, if `meetingsByMessageId[msg.id]` exists, render `MeetingCard` instead of the normal email entry
- Card stays in chronological order within the thread — not pulled out of sequence

Card visual treatment:
- Left accent border (`border-l-2 border-l-accent`) + subtle tinted background (`bg-accent/5`)
- Calendar icon + "MEETING" label in accent color
- Meeting title (prominent), date + time, location (URL-aware: "Zoom Meeting" link vs plain text)
- Entire card is a clickable `<Link>` to `/meetings/{id}`
- Compact enough to fit the thread rhythm — not 3x taller than a regular email entry

### Notes
- Engagement list was previously a card grid (`sm:grid-cols-2 lg:grid-cols-3`), now uses `space-y-2` vertical list
- EngagementCard.tsx exists but is no longer used by the list page — candidate for cleanup
- Detail page is the strongest reference for two-column layout pattern

---

## Partners

**Type:** `Partner` from `src/lib/types.ts`
**List page:** `src/app/partners/PartnersClient.tsx` (client component)
**Detail page:** `src/app/partners/[id]/page.tsx` (server component)
**Groups by:** segment (Security, SecOps, DevOps, CloudOps, Observability, OT/IoT)
**Visual treatment:** TableList (portfolio item with aligned metadata columns)

### TableList Mapping

| Column | Value | Width |
|---|---|---|
| 1 (name) | `partner.name` | flex-1 |
| 2 | `partner.focus_area.join(", ")` | 200px |
| 3 | `partner.alliance_lead` | 140px |

```tsx
<TableList
  headers={[
    { label: "Partner" },
    { label: "Focus Area", width: "200px" },
    { label: "Alliance Lead", width: "140px" },
  ]}
  items={group.partners.map((p) => ({
    id: p.id,
    href: `/partners/${p.id}`,
    columns: [
      { value: p.name },
      { value: p.focus_area.join(", "), width: "200px" },
      { value: p.alliance_lead ?? "", width: "140px" },
    ],
  }))}
/>
```

### DetailHeader Mapping

| Slot | Value |
|---|---|
| title | `partner.name` |
| badges | Segment chip |
| subtitle | — (removed; what_they_do moved into Partner Context card) |
| fields | Alliance Lead (with email), PSA, SPMS ID, Focus Areas |
| actions | — (no actions currently) |

### Detail Page Layout (full-width, no sidebar)

The partner detail page uses a **full-width layout** (no sidebar). Sections top to bottom:

1. **Partner Context** — Single card with two-column grid (`lg:grid-cols-2`). Left column: "What They Do" business description. Right column: "AWS Context" with stickiness narrative + Key AWS Services badges. Stacks vertically on mobile.
2. **Contact Emails** — Compact inline display, only if present.
3. **Meetings** — Uses `MeetingTimeline` (timeline treatment for temporal entities).
4. **Engagements** — Uses `CompactRow` with StatusBadge + Pillar + Priority badges (status-driven list for workstreams).
5. **AWS Relationships** — Uses `CompactRow` with RelationshipTypeBadge (compact list for structural entities).

**Why merged context card:** Separate "What They Do" subtitle + AWS Context card consumed ~50% of viewport before activity content. Merging into a two-column card keeps identity+context under ~1/3 viewport (principle #8).

**Why no sidebar:** The previous sidebar duplicated header metadata (Alliance Lead, PSA, SPMS ID) and buried the most important strategic content (AWS Context) at the bottom. Moving to full-width eliminates duplication.

---

## Programs

**Type:** `Program` from `src/lib/types.ts`
**List page:** `src/app/programs/ProgramsClient.tsx` (client component)
**Detail page:** `src/app/programs/[id]/page.tsx` (server component)
**Groups by:** type (Competency, Service Ready, Program, SCA, Credit Program, Funding, Channel, Enablement)
**Visual treatment:** PillGrid (catalog item, name-only scan)

### PillGrid Mapping

```tsx
<PillGrid
  columns={3}
  items={group.programs.map((p) => ({
    id: p.id,
    name: isGroupedView ? stripTypeSuffix(p.name, group.type) : p.name,
    href: `/programs/${p.id}`,
    count: p.linked_count > 0 ? p.linked_count : undefined,
  }))}
/>
```

### DetailHeader Mapping

| Slot | Value |
|---|---|
| title | `program.name` |
| badges | StatusBadge + ProgramTypeBadge |
| subtitle | `program.description` |
| fields | Lifecycle, Lifecycle Duration, Requirements (truncated), URL (as link) |
| actions | SyncButton |

### Notes
- Programs have 8 type categories with dedicated colors in globals.css
- Eligibility was dropped from list rows (detail-page concern)
- Group header pluralizes: "Competencies", "SCAs", `${type}s`
- Status and type badges are visible on detail pages, not in the PillGrid list

---

## Events

**Type:** `Event` from `src/lib/types.ts`
**List page:** `src/app/events/EventsClient.tsx` (client component)
**Detail page:** `src/app/events/[id]/page.tsx` (server component)
**Groups by:** time section (Upcoming/Past/TBD) → year sub-groups
**Visual treatment:** CalendarCard (temporal item, date-anchored)

### CalendarCard Mapping

```tsx
<CalendarCard
  columns={2}
  items={group.events.map((event) => ({
    id: event.id,
    href: `/events/${event.id}`,
    name: event.name,
    startDate: event.start_date ?? "",
    endDate: event.end_date ?? undefined,
    location: extractCity(event.location),
    typeColor: eventTypeColorMap[event.type],
  }))}
/>
```

Where `eventTypeColorMap` maps event types to CSS variable values:
```typescript
const eventTypeColorMap: Record<Event["type"], string> = {
  conference: "var(--event-conference)",
  summit: "var(--event-summit)",
  workshop: "var(--event-workshop)",
  kickoff: "var(--event-kickoff)",
  trade_show: "var(--event-trade-show)",
  deadline: "var(--event-deadline)",
  review_cycle: "var(--event-review-cycle)",
  training: "var(--event-training)",
};
```

### DetailHeader Mapping

| Slot | Value |
|---|---|
| title | `event.name` |
| badges | EventTypeBadge + GEO badge |
| subtitle | `event.description` |
| fields | Date Range, Location, Format, Host |
| actions | SyncButton |

### Notes
- Events have TWO filter dimensions: type (in FilterBar) + year (separate chip row below)
- Description was dropped from list rows (detail-page concern)
- Year sub-groups use the standard uppercase label style
- `extractCity()` from `src/lib/format-utils.ts` extracts city from full location strings
- `formatCompactDateRange()` from `src/lib/format-utils.ts` formats compact date ranges for cards
- Events list currently uses custom Link cards with type-colored left borders (will migrate to CalendarCard)

---

## Meetings

**Type:** `Meeting` from `src/lib/types.ts`
**List page:** `src/app/meetings/MeetingsClient.tsx` (client component — 466 lines, includes create form)
**Detail page:** `src/app/meetings/[id]/page.tsx` (server component)
**Groups by:** time section (Upcoming/Past/TBD)
**Visual treatment:** CompactRow (activity item with status, associations — Phase 2 redesign planned)

### CompactRow Mapping

| Slot | Value |
|---|---|
| primary | `m.title` |
| badges | MeetingStatusBadge + meeting_type chip + ICS chip (conditional) |
| secondary | date · time · location · partner_name |
| meta | engagement + event association chips (stacked) |

```tsx
<CompactRow
  href={`/meetings/${m.id}`}
  primary={m.title}
  badges={
    <>
      <MeetingStatusBadge status={m.status} />
      {m.meeting_type && (
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400 whitespace-nowrap">
          {m.meeting_type}
        </span>
      )}
      {m.source === "ics_parsed" && (
        <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
          ICS
        </span>
      )}
    </>
  }
  secondary={
    [
      formatDate(m.meeting_date),
      (m.start_time || m.end_time) ? formatTime(m.start_time, m.end_time) : null,
      m.location,
      m.partner_name,
    ].filter(Boolean).join(" · ") || undefined
  }
  meta={
    (m.engagement_name || m.event_name) ? (
      <div className="flex flex-col items-end gap-1">
        {m.engagement_name && (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent whitespace-nowrap">
            {m.engagement_name}
          </span>
        )}
        {m.event_name && (
          <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400 whitespace-nowrap">
            {m.event_name}
          </span>
        )}
      </div>
    ) : undefined
  }
/>
```

### DetailHeader Mapping

| Slot | Value |
|---|---|
| title | `meeting.title` |
| badges | MeetingStatusBadge + ICS badge (if source=ics_parsed) |
| subtitle | — (notes render in body section) |
| fields | Date (with weekday), Time, Partner (linked), Engagement (linked) |
| actions | MeetingActions (Edit/Delete) |

### Detail Page Layout (full-width, no sidebar)

The meeting detail page uses a **full-width layout** (no sidebar). Sections top to bottom:

1. **Location** — Compact single-line bar. URL-aware: if location starts with `http(s)://`, renders as a styled "Join Meeting" / "Join Zoom Meeting" button. Physical addresses render as plain text. Only shown if location exists.
2. **Notes** — Plain text with pre-wrap, only if present.
3. **Attendees** — Grouped by organization using email domain:
   - `@amazon.com` → "AWS" group
   - Domain matches partner name → "[Partner Name]" group
   - Everything else → "Other" group
   - Each group has a header with count: "AWS (6)"
   - Compact grid layout (`sm:grid-cols-2 lg:grid-cols-3`), name + email per row
   - **Relay inbox filtering:** Addresses containing `relay.stevenromero.dev` are infrastructure and always filtered out — they are never shown as attendees.
4. **AWS Relationships** — Linked relationships (if any).
5. **Details** — Compact responsive grid (`sm:grid-cols-3 lg:grid-cols-4`) with: Type, Engagement (linked), Event (linked), Program (linked), Partner (linked), Organizer, Created. Replaces the old sidebar. Source field was removed (redundant — ICS badge in header already communicates this).

**Why no sidebar:** The previous sidebar duplicated header metadata (Date, Time, Location, Status, Partner all appeared in both header fields AND sidebar). Moving to full-width eliminates duplication and follows the partner detail page pattern.

**Attendee grouping pattern:** Uses email domain to infer organization. `@amazon.com` = AWS. Domain substring-matches partner name = Partner group. This is a heuristic — works well for corporate meetings where attendees use company email.

**URL-as-location pattern:** Meeting locations are often Zoom/Teams URLs. Detecting URLs and rendering as styled action buttons instead of raw strings saves space and improves UX. Detection: `isUrl()` checks for `http(s)://` prefix. Zoom detection: checks if URL contains "zoom".

### Notes
- MeetingsClient includes a full create form (~150 lines) — do NOT touch when modifying list rendering
- Meeting types: Executive Meeting, GTM Meeting, Product Team Relationship, Specialized Meeting
- Association chips in meta use different colors: accent for engagement, purple for event
- `meeting_type` badge removed from header (now only in Details grid) — reduces badge noise since status + ICS are higher priority

---

## Relationships

**Type:** `AwsRelationship` from `src/lib/types.ts`
**List page:** `src/app/relationships/RelationshipsClient.tsx` (client component)
**Detail page:** `src/app/relationships/[id]/page.tsx` (server component)
**Groups by:** relationship_type (Exec/Leader, Product Team, Program Team, Seller)
**Visual treatment:** TableList (portfolio item with aligned metadata columns)

### TableList Mapping

| Column | Value | Width |
|---|---|---|
| 1 (name) | `rel.name` | flex-1 |
| 2 | `rel.aws_org` | 160px |
| 3 | `rel.aws_service` | 140px |

```tsx
<TableList
  headers={[
    { label: "Name" },
    { label: "AWS Org", width: "160px" },
    { label: "Service", width: "140px" },
  ]}
  items={group.relationships.map((rel) => ({
    id: rel.id,
    href: `/relationships/${rel.id}`,
    columns: [
      { value: rel.name },
      { value: rel.aws_org ?? "", width: "160px" },
      { value: rel.aws_service ?? "", width: "140px" },
    ],
  }))}
/>
```

### DetailHeader Mapping

| Slot | Value |
|---|---|
| title | `relationship.name` |
| badges | RelationshipTypeBadge |
| subtitle | Notes or description |
| fields | AWS Org, AWS Service, Primary Contact, Contact Email |
| actions | SyncButton |

### Notes
- Contact info was dropped from list rows (detail-page concern)
- Smallest entity set (7 records) — group header pluralizes with simple `${type}s`
