# Recurrence Experience Design Brief
**Task 2.1 — Plan 2 Phase 2**
**Date:** 2026-03-29

---

## Current State Assessment

### What Works
- The recurrence engine is mechanically sound: `calculateNextDate` with anchor snapping, `spawnNextOccurrence` with race-condition-safe unique index, lazy spawn on page load
- 14 series roots, 31 total recurring meetings, all with correct `anchor_day` values
- Create modal has pattern picker, anchor preview, and 4-date preview
- RecurrenceEditor supports create, edit, skip, and end flows
- ↻ icon consistently marks recurring meetings across all list views

### What Doesn't Work

**1. Series display is cluttered and inconsistent.**
- The series navigation bar shows "Occurrence N of M" — adds no value for indefinite series (most are)
- On the root meeting: "Weekly on Fridays · Occurrence 1 of 4 (since Mar 20)" — too much information for a navigation bar
- On child meetings: pattern shows "Weekly" WITHOUT the day name — because `anchor_day` is null on children and the nav bar reads from `meeting.recurrence_pattern` + `meeting.anchor_day` instead of looking up the root
- Two separate recurrence displays: the nav bar at top AND a "Recurrence" field in the sidebar details. Redundant and visually scattered

**2. Series management actions are too prominent.**
- "Skip This One" and "End Series" are exposed as text links directly below the recurrence display — same visual weight as informational text
- "Edit Series" is inline with the pattern label. Three actions competing for attention in a small area
- No confirmation on "End Series" — a destructive action that stops all future spawns

**3. The RecurrenceEditor shows too much by default.**
- End date field is always visible (an `<input type="date">`) even though 100% of current series have no end date
- Pattern picker and day picker are stacked vertically with no visual grouping
- No preview of next dates in edit mode (only in create modal)

**4. Shifted occurrences are invisible.**
- The OPSWAT series root is on Friday (anchor_day=5), but children spawned on Wed/Thu. No visual indication that these are off-rhythm
- This data exists (compare `meeting_date` day-of-week against root's `anchor_day`) but isn't rendered anywhere

**5. No series history visualization.**
- The user can traverse series via ← Previous / Next → but can't see the full series at a glance
- No way to spot patterns: which weeks were skipped, which were rescheduled, how consistent is attendance

---

## Design Decisions

### Series Display (Task 2.2)

**The series display is the primary recurrence UI. It replaces two current elements** (the nav bar + the sidebar "Recurrence" field) with one clean component.

**On the meeting detail page:**
```
┌────────────────────────────────────────────────────────────┐
│  ↻  Weekly on Fridays  ·  Since Mar 20                    │
│  ← Previous                                    Next →     │
└────────────────────────────────────────────────────────────┘
```

- **Line 1:** ↻ icon + pattern in plain English + series start date
  - Pattern text: "Weekly on {Day}s", "Biweekly on {Day}s", "Monthly on the {N}th", "Quarterly"
  - "Since {date}" derived from series root's meeting_date
  - **Always reads from the series root**, even when viewing a child. The component accepts `seriesRootAnchorDay` and `seriesRootDate` as props, resolved server-side
- **Line 2:** ← Previous / Next → navigation (same as current, but inside the unified component)
- No occurrence count ("N of M"). Useless for indefinite series.
- No end date shown inline. If the series has an end date, append "· Ends {date}" to line 1.

**Visual treatment:** Same card-like container as current nav bar (`rounded-lg border border-border/20 bg-surface/50 px-4 py-2`), but now contains both the rhythm info and navigation.

**Removal:** Delete the separate "Recurrence" field from the sidebar Details section. All recurrence info lives in the unified series display component.

### Shifted-Occurrence Indicator (Task 2.2)

When a meeting in a series is on a different day-of-week than the series root's `anchor_day`, show a subtle "moved" indicator.

**On meeting detail page (inside series display):**
```
↻  Weekly on Fridays  ·  Since Mar 20  ·  ⚡ Moved to Wed
```

- Only appears when the current meeting's day-of-week ≠ root's anchor_day
- Uses a small lightning/shift icon or text treatment: `text-status-blocked/70` (soft amber)
- The indicator text: "Moved to {actual day}" — brief, factual

**In list views** (meetings list, Today page, partner detail):
- When a recurring meeting's day-of-week ≠ its series root's anchor_day: render the date in `text-status-blocked/70` (soft amber) instead of the default `text-muted`
- Requires: passing `anchor_day` from root to list views via the query. The query already joins meetings, so this is a lookup on `series_id`

**Data flow:** Server component resolves anchor_day from the series root:
```typescript
const rootAnchorDay = meeting.series_id && meeting.series_id !== meeting.id
  ? (await getSeriesRoot(meeting.series_id))?.anchor_day
  : meeting.anchor_day;
```

### Recurrence Editor (Task 2.3)

Simplify the editor to show only what matters: pattern, day, preview.

**Default state (when editing or creating):**
```
┌────────────────────────────────────────────┐
│  Pattern:    [Weekly ▼]                    │
│  Day:        [Wednesday ▼]                 │
│                                            │
│  Next 3:  Apr 2 → Apr 9 → Apr 16          │
│                                            │
│  Recurs indefinitely                       │
│  + Add end date                            │
│                                            │
│        [Save]            Cancel            │
└────────────────────────────────────────────┘
```

**Key changes from current:**
1. **Day-of-week selector auto-populates** from the meeting date but is always editable (weekly/biweekly) or shows day-of-month for monthly/quarterly
2. **Preview of next 3 dates** shows below pattern/day, updates live. Uses `previewDates()` (already exists in MeetingsClient)
3. **End date hidden by default.** "Recurs indefinitely" text + "Add end date" link. Clicking reveals the date input
4. **"Save" is the primary action**, "Cancel" is ghost/secondary
5. **Same component works in create modal and on meeting detail** — it's the single recurrence editing surface

**For monthly/quarterly patterns:** Day selector becomes a number input (1-31) for day-of-month instead of day-of-week dropdown. Label changes to "Day of month:".

### Series Management Actions (Task 2.4)

De-emphasize management actions. They're secondary to the series display.

**Treatment:** A compact row of ghost-styled actions below the series display, visually subordinate:

```
┌────────────────────────────────────────────────────────────┐
│  ↻  Weekly on Fridays  ·  Since Mar 20                    │
│  ← Previous                                    Next →     │
│                                                            │
│  Edit Pattern  ·  Skip This One  ·  End Series            │
└────────────────────────────────────────────────────────────┘
```

- All three actions in a single row: `text-xs text-muted/50 hover:text-muted` — barely visible until hovered
- Dot separators (·) between actions
- **"End Series"** gets `hover:text-red-400` (danger escalation on hover)
- **"End Series" requires confirmation dialog:** Custom modal (not browser confirm), with clear consequences text: "This will stop future occurrences from being created. Existing meetings are not affected."
- **"Edit Pattern"** opens the RecurrenceEditor inline (replaces the series display temporarily)
- **"Skip This One"** marks the current meeting as `cancelled` — no confirmation needed (reversible by reopening)

### Standalone-to-Series Conversion (Task 2.5)

**Current:** The "Make recurring" text link in the sidebar opens the RecurrenceEditor inline in the details column.

**New approach:** Keep the trigger in the same location but improve the flow:

1. "Make Recurring" text link (existing behavior, keep)
2. Opens RecurrenceEditor with the meeting's date auto-populating the day selector
3. On save: sets `recurrence_pattern`, `anchor_day`, `series_id = meeting.id` — the meeting becomes a series root
4. **Title alignment suggestion:** If the meeting title doesn't match the `"{Partner} — {Type}"` convention, show a subtle suggestion below the editor: "Rename to '{Partner} — Partner Cadence'?" with accept/dismiss. Don't auto-rename.
5. Page refreshes to show the series display component (now this is a series root)

**No changes to data model needed.** The existing PUT /api/meetings/[id] handles setting recurrence fields.

### Meetings List View (Task 2.2 scope — list indicators)

Currently, recurring meetings in lists show only the ↻ icon. Enhance with:

1. **↻ icon** — keep as is (already established pattern)
2. **Shifted date indicator** — date text renders in `text-status-blocked/70` when day-of-week ≠ root's anchor_day (see Shifted-Occurrence Indicator above)
3. **No additional changes.** The list view should stay scannable. Pattern info ("Weekly on Wednesdays") is for the detail page, not the list.

### Create Flow (Task 2.3 scope — modal improvements)

The current create modal works but has minor issues:

1. **End date field is always visible** — same fix as the editor: hide behind "Add end date" link
2. **Day-of-week selector missing** — the modal computes anchor_day from the meeting date but doesn't let the user pick a different day. Add the day selector from the RecurrenceEditor, auto-populated from the meeting date.
3. **Preview already exists** (shows "Next 4" dates) — change to show "Next 3" for consistency with the editor
4. **Anchor label** already shows ("Anchor: Wednesdays") — this becomes the day selector label

### Series Timeline Strip (Task 2.7)

A compact horizontal visualization of a meeting series' history. Think GitHub contribution graph — simple, visual, instantly readable.

**Placement:** On the meeting detail page, below the series display component. Also on partner detail in the Recent Meetings section (one strip per active series).

**Design:**
```
  ●  ●  ●  ○  ●  ◌  ●  ○
Mar 20  Mar 27  Apr 3  Apr 10  Apr 17  Apr 24  May 1  May 8
```

**Visual encoding:**
- **Completed** (`status = completed`): `●` solid dot, `bg-status-active` (green)
- **Scheduled** (future, `status = scheduled`): `○` outline dot, `border-accent/40` (muted indigo outline)
- **Cancelled/Skipped** (`status = cancelled`): `◌` hollow dot with line-through, `bg-status-archived/40` (gray)
- **Shifted** (day-of-week ≠ anchor_day): dot has a `ring-2 ring-status-blocked/40` (amber ring) as an overlay — works with any status color

**Sizing:**
- Each dot: `w-3 h-3 rounded-full` (12px) — compact but clickable
- Gap between dots: `gap-1.5` (6px)
- Date labels below: `text-[9px] text-muted/40` — only show every Nth label to avoid crowding (every 4th for weekly, every 2nd for biweekly, every 1 for monthly)

**Interaction:**
- Hover: show tooltip with date + status (e.g., "Mar 26 — Completed" or "Mar 26 — Moved from Fri")
- Click: navigate to that meeting's detail page
- No scroll/pagination — show entire series history. For long series (>20 dots), consider showing last 16 + first 2 with a "..." gap

**Component:** `SeriesTimeline` — takes an array of series sibling meetings + the root's anchor_day. Pure display, no editing.

**CSS approach:**
- Flexbox row with `flex-wrap: nowrap` and `overflow-x: auto` for very long series
- Tooltip via `title` attribute initially (upgrade to custom tooltip if needed)
- Date labels via absolute-positioned text below dots

---

## Component Architecture

### New Components
1. **`SeriesDisplay`** — Replaces the current nav bar + sidebar recurrence field. Contains: rhythm text, nav arrows, management actions, shifted-occurrence indicator. Props: meeting, seriesSiblings, rootAnchorDay, rootDate.
2. **`SeriesTimeline`** — Horizontal dot strip. Props: siblings (meetings array), anchorDay (from root).

### Modified Components
1. **`RecurrenceEditor`** — Simplified: pattern + day selector + preview + hidden end date. Used in both create modal and meeting detail edit flow.
2. **`MeetingsClient`** — Create modal gains day-of-week selector and hides end date behind link.
3. **Meeting detail page** — Replaces nav bar + sidebar recurrence field with SeriesDisplay. Adds SeriesTimeline below it.

### Unchanged
- `calculateNextDate`, `spawnNextOccurrence` — engine is solid, no changes
- Meeting list row rendering — only add shifted-date color treatment
- Today page meeting rows — same shifted-date treatment
- Partner detail recent meetings — same shifted-date treatment, plus optional SeriesTimeline

---

## Data Requirements

### What already exists
- `anchor_day` on meetings (backfilled in Task 1.1)
- `series_id` self-referential FK for series grouping
- `getSeriesSiblings(seriesId)` in db/meetings.ts
- `recurrence_pattern`, `recurrence_end` on meetings
- Status values: scheduled, completed, cancelled, did_not_occur

### What needs to change
- **Queries:** Series siblings query should return `anchor_day` from the root (or the component resolves it client-side from the siblings array — simpler)
- **List views:** Meeting list queries need to know if a meeting is shifted. Options:
  - (A) Compute client-side by joining siblings — expensive for list views
  - (B) Compute server-side in the page component and pass as a prop — preferred
  - (C) Add a `is_shifted` computed column — over-engineering
  - **Decision: (B)** — compute in the server component for meetings that have a series_id, batch-lookup root anchor_days

---

## Consistency Checks

- **SKILL.md alignment:** All new components follow Layer 1 tokens (dark theme, 4px spacing, text brightness tiers). New patterns will be documented in Layer 2 (RecurrenceEditor interaction) and Layer 3 (SeriesTimeline, shifted-occurrence indicator, SeriesDisplay).
- **North Star Part 6:** This design fulfills all target state items: anchor day, "just this meeting" edits, "end series", "skip this one", series-level editing. The timeline strip exceeds the spec (not mentioned in north-star but aligned with the "visual history" intent).
- **Anti-patterns avoided:** No modals on modals, no auto-dismissing toasts, no gradient text, no horizontal scroll in tables. The timeline strip uses horizontal overflow only for very long series (>20), with native scrollbar.

---

## Implementation Order

Tasks 2.2–2.7 in the plan map directly to this design:

| Task | What | Depends On |
|------|------|-----------|
| 2.2 | SeriesDisplay + shifted indicator (detail + lists) | Nothing |
| 2.3 | RecurrenceEditor simplification (edit + create) | Nothing |
| 2.4 | Series management actions (skip, end, edit) into SeriesDisplay | 2.2 |
| 2.5 | Standalone-to-series conversion | 2.3 (uses simplified editor) |
| 2.6 | Anchor day snap verification (tests) | 1.1 (done) |
| 2.7 | SeriesTimeline strip | 2.2 (uses SeriesDisplay placement) |

Tasks 2.2 and 2.3 can be built independently. 2.4 builds on 2.2. 2.5 builds on 2.3. 2.6 is independent (test-only). 2.7 builds on 2.2.
