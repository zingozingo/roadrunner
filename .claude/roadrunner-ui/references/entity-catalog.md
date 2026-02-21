# Entity Catalog

Slot mappings for all 6 entity types in Roadrunner. Each entity maps its fields into CompactRow and DetailHeader slots.

## Engagements

**Type:** `Engagement` from `src/lib/types.ts`
**List page:** `src/app/engagements/page.tsx` (server component)
**Detail page:** `src/app/engagements/[id]/page.tsx` (server component — strongest reference)
**Groups by:** status (planned → active → paused → completed → archived)

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
| badges | StatusBadge + Pillar badge + Priority badge |
| subtitle | `engagement.current_state` (first line or full) |
| fields | Partner, Status, Start Date, Target Completion |
| actions | EngagementActions menu |

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

### CompactRow Mapping

| Slot | Value |
|---|---|
| primary | `partner.name` |
| badges | Segment chip (inline badge, capitalize) |
| secondary | focus_area joined + PSA |
| meta | alliance_lead name |

```tsx
<CompactRow
  href={`/partners/${partner.id}`}
  primary={partner.name}
  badges={
    partner.segment ? (
      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent whitespace-nowrap capitalize">
        {partner.segment}
      </span>
    ) : undefined
  }
  secondary={
    [partner.focus_area.join(", "), partner.psa && `PSA: ${partner.psa}`]
      .filter(Boolean)
      .join(" · ") || undefined
  }
  meta={partner.alliance_lead ? <span>{partner.alliance_lead}</span> : undefined}
/>
```

### DetailHeader Mapping

| Slot | Value |
|---|---|
| title | `partner.name` |
| badges | Segment chip |
| subtitle | `partner.what_they_do` |
| fields | Alliance Lead, PSA, SPMS ID, ISVa Status |
| actions | SyncButton |

---

## Programs

**Type:** `Program` from `src/lib/types.ts`
**List page:** `src/app/programs/ProgramsClient.tsx` (client component)
**Detail page:** `src/app/programs/[id]/page.tsx` (server component)
**Groups by:** type (Competency, Service Ready, Program, SCA, Credit Program, Funding, Channel, Enablement)

### CompactRow Mapping

| Slot | Value |
|---|---|
| primary | `program.name` |
| badges | StatusBadge + ProgramTypeBadge |
| secondary | `program.description` (clamp 2) |
| meta | linked_count |

```tsx
<CompactRow
  href={`/programs/${program.id}`}
  primary={program.name}
  badges={
    <>
      <StatusBadge status={program.status} />
      <ProgramTypeBadge type={program.type} />
    </>
  }
  secondary={program.description ?? undefined}
  secondaryLineClamp={2}
  meta={
    program.linked_count > 0 ? (
      <span>{program.linked_count} link{program.linked_count !== 1 ? "s" : ""}</span>
    ) : undefined
  }
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

---

## Events

**Type:** `Event` from `src/lib/types.ts`
**List page:** `src/app/events/EventsClient.tsx` (client component)
**Detail page:** `src/app/events/[id]/page.tsx` (server component)
**Groups by:** time section (Upcoming/Past/TBD) → year sub-groups

### CompactRow Mapping

| Slot | Value |
|---|---|
| primary | `event.name` |
| badges | EventTypeBadge + unverified StatusBadge (conditional) |
| secondary | dateRange · location |
| meta | linked_count |

```tsx
<CompactRow
  href={`/events/${event.id}`}
  primary={event.name}
  badges={
    <>
      <EventTypeBadge type={event.type} />
      {!event.verified && <StatusBadge status="unverified" />}
    </>
  }
  secondary={
    [formatDateRange(event.start_date, event.end_date), event.location]
      .filter(Boolean)
      .join(" · ") || undefined
  }
  meta={
    event.linked_count > 0 ? (
      <span>{event.linked_count} link{event.linked_count !== 1 ? "s" : ""}</span>
    ) : undefined
  }
/>
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
- `formatDateRange()` helper formats start/end date range

---

## Meetings

**Type:** `Meeting` from `src/lib/types.ts`
**List page:** `src/app/meetings/MeetingsClient.tsx` (client component — 466 lines, includes create form)
**Detail page:** `src/app/meetings/[id]/page.tsx` (server component)
**Groups by:** time section (Upcoming/Past/TBD)

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
| badges | MeetingStatusBadge + meeting_type chip |
| subtitle | Notes (if present) |
| fields | Date, Time, Location, Partner |
| actions | Edit/Delete buttons |

### Notes
- MeetingsClient includes a full create form (~150 lines) — do NOT touch when modifying list rendering
- Meeting types: Executive Meeting, GTM Meeting, Product Team Relationship, Specialized Meeting
- Association chips in meta use different colors: accent for engagement, purple for event

---

## Relationships

**Type:** `AwsRelationship` from `src/lib/types.ts`
**List page:** `src/app/relationships/RelationshipsClient.tsx` (client component)
**Detail page:** `src/app/relationships/[id]/page.tsx` (server component)
**Groups by:** relationship_type (Exec/Leader, Product Team, Program Team, Seller)

### CompactRow Mapping

| Slot | Value |
|---|---|
| primary | `rel.name` |
| badges | RelationshipTypeBadge |
| secondary | aws_org · aws_service |
| meta | linked_count |

```tsx
<CompactRow
  href={`/relationships/${rel.id}`}
  primary={rel.name}
  badges={<RelationshipTypeBadge type={rel.relationship_type} />}
  secondary={
    [rel.aws_org, rel.aws_service].filter(Boolean).join(" · ") || undefined
  }
  meta={
    rel.linked_count > 0 ? (
      <span>{rel.linked_count} link{rel.linked_count !== 1 ? "s" : ""}</span>
    ) : undefined
  }
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