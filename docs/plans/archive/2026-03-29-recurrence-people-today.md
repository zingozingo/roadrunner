# Plan 2: Recurrence Experience, People Page, Today Layout
**Created:** 2026-03-29
**Phases:** 4 (Foundation → Recurrence → People → Today)
**Tasks:** 17

---

## Business Context

Plan 1 built the infrastructure: People data wiring, recurrence engine mechanics, Today page restructuring, junction table cleanup. Plan 2 takes that foundation and builds the *experience* layer — making recurrence management intuitive, creating a cross-partner People search surface, and rebalancing the Today page so meetings aren't buried.

**Interactive session before this plan** resolved several issues that set up this plan:
- Dissolved 3 engagement-level junction tables (engagement_programs, engagement_events, engagement_relationships) — programs/events are now partner-level only (decision #363)
- Added `program_name` to partner_program_enrollments — "Unlinked" display eliminated (decision #364)
- Merged 4 duplicate participants + case-insensitive unique index on `lower(email)` (decision #361)
- PDM filtered from engagement contributors via `isUserEmail()` (decision #362)
- Backfilled 11 null meeting_types, renamed all "Partner Sync" → "Partner Cadence" (decision #365)
- Deleted 2 test Cloudaware QBR meetings + orphaned engagement
- SKILL.md restructured into three-layer design system framework (decision #366)
- entity-model.md updated for all dissolved tables and new columns
- **Discovered:** `anchor_day` column does NOT exist in production (migrations 078/079 tracked but DDL never ran)

**Key docs to read before starting:**
- `CLAUDE.md` — project bible, two-mode system, working rules
- `docs/north-star.md` — vision spec (especially Parts 2, 3, 6, 8, 9)
- `docs/entity-model.md` — schema reference (updated 2026-03-29)
- `docs/goal-state.md` — current status
- `.claude/roadrunner-ui/SKILL.md` — design system authority (three-layer structure with empty Layer 2 and Layer 3 ready for population)

---

## Universal Principles (Apply to EVERY Task)

These are not suggestions. Claude Code must internalize these before writing any code.

1. **Think universally, not locally.** Any layout pattern, component, or interaction you introduce on one page must be evaluated for system-wide consistency. If you build a two-column layout for Today, consider whether it should be a system pattern. If you create a search component for People, consider whether it belongs in the design system. Update SKILL.md when you establish something new — slot it into the appropriate layer.

2. **Design before code for anything visual.** Read SKILL.md and north-star.md. Understand the existing design language. Plan the experience before writing JSX. For significant UI changes, take a Playwright screenshot of the current state BEFORE making changes, then verify AFTER.

3. **Diagnose before implementing.** Read the actual file contents. Check current data state. Don't assume — run the query, read the component, understand what exists before changing it.

4. **SKILL.md is the design system authority.** It has three layers: Visual Foundations, Interaction Patterns, and Data Visualization Patterns. When you establish a new pattern, add it to the appropriate layer using the documented pattern format. If you find yourself building something that contradicts SKILL.md, stop and resolve the conflict — don't just override.

5. **Verification is mandatory.** Every task ends with: `tsc --noEmit`, `npx vitest run`, `scripts/ui-audit.sh`, and Playwright screenshots for any visual changes. Commit after verification passes.

6. **Check in after each task.** After completing each task's verification, STOP and report what was done, what changed, any issues encountered, and what the next task will involve. Wait for confirmation before proceeding.

---

## Phase 1: Foundation & Verification

**Purpose:** Get the house in order. The interactive session made real changes — dissolved tables, added columns, merged data. Claude Code needs to verify everything renders correctly, fix the critical `anchor_day` gap, update docs, and populate the SKILL.md framework. Everything in Phases 2-4 depends on this being truthful.

### Task 1.1: Fix anchor_day Column

**Intent:** The `anchor_day` column was designed in Plan 1 to prevent day-of-week drift in recurring meeting series. Migrations 078/079 were tracked as applied but the DDL never executed — the column does not exist in production. Without it, the recurrence snap logic is inert and all of Phase 2 builds on a missing foundation.

**Scope:**
- Verify `anchor_day` does not exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'anchor_day'`
- Create migration 082 that adds the column: `ALTER TABLE meetings ADD COLUMN anchor_day smallint` (nullable, 0-6 for day of week, 1-31 for day of month)
- Backfill: compute `anchor_day` from each series root's `meeting_date` and recurrence pattern (day of week for weekly/biweekly, day of month for monthly/quarterly)
- Verify all series roots have `anchor_day` populated
- Update `docs/entity-model.md` — add `anchor_day` to the meetings schema

**Done when:**
- `anchor_day` column exists in production
- All series roots have correct `anchor_day` values
- entity-model.md reflects the new column
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Single migration, number 082
- Check if the application code that reads/writes `anchor_day` already exists from Plan 1 — it should, it just had no column to read from. Verify it works now that the column exists.
- Do NOT change `calculateNextDate` or `spawnNextOccurrence` unless they're broken

---

### Task 1.2: Update Remaining Stale Documentation

**Intent:** `goal-state.md` and `CLAUDE.md` were updated in the session end protocol. But verify all docs are consistent and no stale references remain anywhere.

**Scope:**
- Verify consistency across all docs: table counts (17), migration counts (81+), meeting counts (49)
- Search entire `docs/` directory for any remaining references to dissolved tables: `engagement_programs`, `engagement_events`, `engagement_relationships`, `relationships` (outside of historical/legacy sections)
- Fix any inconsistencies found
- If no issues found, report clean and move on

**Done when:**
- All doc stats are consistent
- Zero stale references to dissolved tables outside of legacy/historical context
- Report of what was checked and what (if anything) was fixed

**Constraints:**
- Don't restructure docs — just fix inconsistencies
- Don't touch `north-star.md`

---

### Task 1.3: Visual Verification of Interactive Changes

**Intent:** The interactive session made significant data and code changes. Before building new features, verify everything renders correctly in the UI.

**Scope:**
- Take Playwright screenshots of:
  - A partner page with program enrollments (e.g., OPSWAT) — confirm names display instead of "Unlinked"
  - A partner page People section — confirm curated groups render, confirm PDM not in engagement contributors
  - An engagement detail page — confirm Programs/Events sections are gone
  - The meetings list — confirm all meetings have type badges, "Partner Cadence" naming is consistent
  - The Today page — baseline screenshot before Phase 4 changes
- Check for any console errors or broken layouts
- If any issues found, fix them before proceeding

**Done when:**
- Screenshots captured and reviewed
- All enrollment records show program names (zero "Unlinked")
- Engagement detail pages have no Programs/Events sections
- No console errors on any page
- Screenshots saved to `.claude/screenshots/` with date prefix

**Constraints:**
- Screenshots and verification first — if issues are found, report them and wait for guidance before fixing

---

### Task 1.4: Populate SKILL.md Framework

**Intent:** SKILL.md was restructured into a three-layer framework (decision #366) with empty Layer 2 and Layer 3 sections. This task populates the framework by reading actual code — documenting patterns that already exist so Phases 2-4 build consistently on top of them.

**Scope:**
- Read the current partner detail page, Today page, meeting detail page, tasks page, and engagement detail page components
- Populate Layer 2 (Interaction Patterns) with established patterns found in code:
  - Search patterns (if any exist)
  - List capping patterns (if any exist)
  - Progressive disclosure / collapsible sections
  - Confirmation dialogs for destructive actions
  - Form/creation patterns (create meeting modal, create task inline, create engagement from EngagementLinker)
  - Navigation patterns (breadcrumbs, entity links, slide-over panels)
- Populate Layer 3 (Data Visualization Patterns) with established patterns found in code:
  - Status indicators (badges, dots, meeting type formatting)
  - Grouped displays (tasks by partner, engagements by pillar, enrollments by type)
  - Financial displays (Co-Sell Performance section formatting)
  - Recurrence icon pattern (↻ indicator)
- Use the pattern documentation format already defined in SKILL.md

**Done when:**
- Layer 2 has documented patterns for every interaction pattern found in the existing codebase
- Layer 3 has documented patterns for every data visualization pattern found
- Each entry has: component name, usage locations, behavior, design rationale
- No conflicts between documented patterns and actual implementation

**Constraints:**
- Only document patterns that already exist in code — don't invent new ones
- Read the actual component source before documenting
- Preserve the three-layer structure and pattern format established in the skeleton

---

## Phase 2: Meeting Recurrence Overhaul

**Purpose:** Transform meeting recurrence from a scattered set of controls into a cohesive experience. The PDM should be able to see all their recurring series at a glance, understand each one's rhythm, spot anomalies (skipped weeks, rescheduled days), and manage occurrences intuitively.

**This is not a button reshuffle.** It's building the recurrence management experience. Think Google Calendar's series management meets Linear's clean interaction design. The key mental model: a recurring meeting is a *series* with a rhythm (pattern + anchor day). Individual occurrences are instances of that rhythm. The user thinks in series ("my weekly Spacelift cadence"), not in individual meetings.

**The six core actions this phase delivers:**
1. Create a recurring meeting
2. See the rhythm (pattern, anchor day, history, anomalies)
3. Skip an occurrence
4. Change the day going forward
5. End a series
6. Make a standalone meeting recurring

### Task 2.1: Recurrence Experience Design

**Intent:** Before writing any code, design the complete recurrence experience. Read all current recurrence-related components, understand what exists, then plan what needs to change. This is the "measure twice" step for the entire phase.

**Scope:**
- Read all recurrence-related code: RecurrenceEditor, series display on meeting detail, create meeting modal, calculateNextDate, spawnNextOccurrence, any series management UI
- Read SKILL.md and north-star.md Part 6 (Meeting Recurrence System)
- Take Playwright screenshots of the current recurrence UI on a meeting detail page
- Produce a design brief (as a comment or brief .md) covering:
  1. **Series display** — What the user sees on a meeting detail page for a recurring meeting. Clean format showing pattern, anchor day, series start. No occurrence counts. Shifted occurrences (meeting on a different day than anchor) should have a subtle visual indicator.
  2. **Recurrence editor** — Pattern picker + day selector + "recurs indefinitely" default + optional end date behind a link + preview of next 3 dates.
  3. **Series management actions** — Skip, end, edit as secondary actions. Not competing with the series display for visual attention.
  4. **Standalone-to-series conversion** — "Make Recurring" action on any standalone meeting. Opens the recurrence editor, transforms the meeting into a series root.
  5. **Meetings list view** — How recurring meetings appear in lists. Series indicator, pattern info.
  6. **Create flow** — Partner + type → auto-title → recurrence toggle → pattern/day picker → preview.
  7. **Series timeline strip** — Compact visual history of a series: horizontal strip of dots/blocks representing occurrences over time. Color-coded by status (completed, scheduled, skipped, rescheduled/shifted). Think GitHub contribution graph — simple, visual, instantly readable.

**Done when:**
- Current state screenshots taken
- Design brief produced covering all 7 areas
- Design is consistent with north-star.md and SKILL.md
- Report to Steven for review before implementing

**Constraints:**
- NO CODE CHANGES in this task — design only
- The underlying recurrence engine (calculateNextDate, spawnNextOccurrence, series_id FK) is solid. Don't redesign the data model. This is a UX overhaul, not a schema overhaul.
- The 10 meeting types are fixed. Don't add or rename types.

---

### Task 2.2: Series Display & Shifted-Occurrence Indicator

**Intent:** Replace the cluttered recurrence display on meeting detail pages with a clean, informative series indicator. The user should immediately understand: this is a recurring meeting, here's the rhythm, here's how long it's been going. If this particular occurrence was moved to a different day than the anchor, that should be visually clear.

**Scope:**
- Redesign the series display component on the meeting detail page
- Show: ↻ icon + pattern in plain English ("Weekly on Wednesdays") + series start date ("Since Mar 20")
- For series children: show link to series root
- Remove occurrence count display ("X of Y") — it adds no value for indefinite series
- **Shifted-occurrence indicator:** When a meeting in a series has a different day-of-week than the series root's `anchor_day`, render a subtle visual marker. This could be a different date color, a small "moved from Wed" note, or an icon. The data is already there: compare `meeting_date` day-of-week against `anchor_day`. Design the indicator to be informative without being noisy — most occurrences will be on the anchor day, so the shifted ones should quietly stand out.
- The indicator should appear both on the meeting detail page and in list views (meetings list, partner detail recent meetings, Today page)
- Ensure the display works for all 4 patterns: weekly, biweekly, monthly, quarterly

**Done when:**
- Meeting detail page shows clean series display for any recurring meeting
- No "X of Y" occurrence counts visible
- Pattern displays in plain English
- Shifted occurrences have a clear but subtle visual indicator
- Indicator appears in both detail and list contexts
- Playwright screenshots confirm clean layout
- SKILL.md Layer 3 updated with the series display pattern and shifted-occurrence indicator pattern
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Don't change the series data model (series_id, recurrence_pattern, anchor_day)
- Don't change the spawn engine logic
- Keep the ↻ icon pattern established in Plan 1

---

### Task 2.3: Recurrence Editor Simplification

**Intent:** The current editor shows too much by default (end date field always visible, pattern and day pickers not clearly separated). Simplify to: pick a pattern, pick a day, see a preview. End date is hidden by default.

**Scope:**
- Redesign the RecurrenceEditor component
- Default state: pattern dropdown + day-of-week selector + preview of next 3 occurrence dates
- "Recurs indefinitely" is the default — no end date field visible
- "Add end date" link reveals the end date picker only when clicked
- Day-of-week selector auto-populates from the meeting date but is editable
- Preview updates live as user changes pattern or day
- Works in both create (new meeting modal) and edit (meeting detail page) contexts

**Done when:**
- Editor shows pattern + day + preview by default
- End date hidden behind "Add end date" link
- Preview shows next 3 dates and updates live
- Works in create and edit contexts
- Playwright screenshots confirm clean layout in both contexts
- SKILL.md Layer 2 updated with the recurrence editor interaction pattern
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Don't change the recurrence data model
- Don't change how recurrence_pattern or recurrence_end are stored
- The 4 patterns (weekly, biweekly, monthly, quarterly) are fixed

---

### Task 2.4: Series Management Actions

**Intent:** "Skip This One" and "End Series" are currently too visually prominent — they sit alongside informational display as primary buttons. Management actions should be secondary, not competing with the series display for attention.

**Scope:**
- Move series management actions (Skip This One, End Series, Edit Series) into a secondary treatment — a ⋯ menu, a collapsed "Manage Series" section, or visually de-emphasized controls
- "Skip This One" should cancel the current occurrence without breaking the chain
- "End Series" should stop future spawning
- "Edit Series" should open the RecurrenceEditor (from Task 2.3) for the series root
- Add confirmation dialog for "End Series"
- Verify all three actions work correctly end-to-end

**Done when:**
- Series management actions are visually secondary to the series display
- All three actions work correctly (skip, end, edit)
- Confirmation dialog on "End Series"
- Playwright screenshots confirm visual hierarchy
- SKILL.md Layer 2 updated with confirmation/destructive action pattern if new one established
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Don't add new database columns or API routes
- The skip/end mechanics already exist — this is a UX treatment change
- If the existing mechanics are broken, fix them, but don't redesign the approach

---

### Task 2.5: Standalone-to-Series Conversion

**Intent:** Several meetings exist as standalones that should be recurring series (KnowBe4, NinjaOne, Cloudaware). The user needs a way to take any non-recurring meeting and make it the root of a new series. This is the missing piece that lets the PDM sort out their meeting landscape using the tool instead of SQL.

**Scope:**
- Add a "Make Recurring" action on meeting detail pages for standalone (non-series) meetings
- Clicking opens the RecurrenceEditor (from Task 2.3) pre-populated with the meeting's date as anchor reference
- On save: sets `recurrence_pattern`, `anchor_day` on the meeting, making it a series root
- The spawn engine will then auto-create the next occurrence on the next page load
- Offer to align the title with naming convention ("Partner — Type") if it doesn't match — but don't auto-rename

**Done when:**
- Any standalone meeting has a "Make Recurring" action
- Action opens RecurrenceEditor with sensible defaults
- Saving transforms the meeting into a series root with recurrence_pattern and anchor_day set
- Next page load spawns the first child occurrence
- Playwright screenshot confirms the action and flow
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Don't create a new API route if the existing PUT /api/meetings/[id] can handle setting recurrence fields
- Don't auto-rename meetings — offer the suggestion but let the user decide
- A standalone that becomes a series root should NOT retroactively absorb older meetings — that's manual

---

### Task 2.6: Anchor Day Snap Verification

**Intent:** The anchor_day column now exists (Task 1.1), the snap logic was written in Plan 1 (calculateNextDate), but it's never been verified end-to-end. Confirm drift prevention actually works.

**Scope:**
- Read `calculateNextDate` and `spawnNextOccurrence` to understand how they use `anchor_day`
- Test: if the last occurrence in a weekly series was rescheduled to a different day, does the next spawn snap back to the anchor day?
- Test all 4 patterns: weekly, biweekly, monthly, quarterly
- If the snap logic doesn't work, fix it
- Document the verification results

**Done when:**
- Snap logic verified for all 4 recurrence patterns
- A rescheduled occurrence does NOT drift future spawns
- Verification documented
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Don't change the anchor_day data model
- If the logic is broken, fix the calculation — don't rearchitect
- Use test cases, not production data manipulation

---

### Task 2.7: Series Timeline Strip

**Intent:** Give the user a visual history of a recurring meeting series at a glance. A compact horizontal visualization showing each occurrence as a dot or block, color-coded by status. Like a GitHub contribution graph for meeting series — instantly see the rhythm, spot gaps, identify rescheduled weeks.

**Scope:**
- Build a series timeline component that renders on the meeting detail page for any meeting that's part of a series
- Display: horizontal strip of dots/blocks, one per occurrence, ordered chronologically
- Color coding:
  - Completed (status = completed): solid, primary color
  - Scheduled (future, status = scheduled): outline or muted
  - Skipped (status = cancelled): gray with strikethrough or X
  - Shifted (meeting_date day-of-week ≠ anchor_day): amber or accent color
- Each dot/block should be hoverable or clickable — show the date and status, optionally link to that meeting
- The strip should show the full series history (all occurrences from root to latest spawned)
- Consider also placing this on the partner detail page in the meetings section — seeing the cadence rhythm for a partner is valuable there too
- The component should be compact — a single line or two, not a large chart

**Done when:**
- Series timeline strip renders on meeting detail pages for recurring meetings
- All 4 status states display with distinct visual treatment
- Shifted occurrences are visually distinguishable from on-schedule ones
- Hover/click shows date and status
- Component is compact and doesn't dominate the page
- Playwright screenshots confirm the visualization
- SKILL.md Layer 3 updated with the series timeline pattern
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Keep it simple — dots or small blocks, not a full calendar component
- Don't build navigation (previous/next month) — just show the full series history
- This is a read-only visualization — no editing from this component
- Must work for series of any length (2 occurrences to 50+)

---

## Phase 3: People Page

**Purpose:** Create a new `/people` route — a cross-partner search surface for finding any person in the system. Search-first, filterable by the three-group sphere (AWS Team / Partner / Third Party) and by partner, with the ability to create new participants.

**Design intent:** This is a rolodex, not a dashboard. You go here when you need to find someone — "who was that SI on the Nozomi deal?" The search bar is the primary interaction. Results show context (which partners, which engagements, what role). The three-group sphere (AWS Team, Partner, Third Party) is the primary organizing principle, consistent with how People renders on partner detail pages.

### Task 3.1: People Data Layer

**Intent:** Build the API route and queries that power the People page. The data infrastructure exists (participants, partner_participants, engagement_participants) — this task wires it into a searchable, filterable API.

**Scope:**
- Create GET `/api/people` route with query parameters:
  - `q` — search string (matches name, email, org, title — case-insensitive)
  - `org_type` — filter by internal/partner/third_party
  - `partner_id` — filter to a specific partner's sphere (anyone in that partner's partner_participants OR engagement_participants via engagements belonging to that partner)
  - `limit` / `offset` — pagination (default 50)
- Response shape per person: `{ id, name, email, title, org, org_type, partners: [{ id, name, role }], engagements: [{ id, name }] }`
- Query should be efficient — join through partner_participants and engagement_participants, deduplicate at the person level
- Include a POST `/api/people` route for creating new participants (name, email, title, org, org_type, optional partner_id + role to create a partner_participant link)

**Done when:**
- GET `/api/people` returns filtered, searchable results with partner and engagement context
- POST `/api/people` creates a participant with optional partner link
- Email normalized to lowercase on POST (consistent with system-wide normalization enforced by UNIQUE(lower(email)) index)
- `tsc --noEmit` clean, tests pass
- Manual curl/fetch test confirms results are correct

**Constraints:**
- Use existing tables only — no new tables or columns
- Don't duplicate query logic that already exists in participants.ts — reuse where possible
- The PDM (isUserEmail) should NOT be excluded from People results — this is a rolodex, not an engagement contributor list

---

### Task 3.2: People Page — Search & Results

**Intent:** Build the page with search-first UX. The search bar is the hero element. Results render with full context — who is this person, which partners are they connected to, what's their role, which sphere do they belong to.

**Scope:**
- Create `/people` page with sidebar entry (Secondary tier, between Meetings and Programs)
- Search bar at the top — large, prominent, placeholder text guiding the user
- Results render showing: name, email, title/org, org_type badge (AWS Team / Partner / Third Party — using the same three-group visual language as the partner detail People section), partner connections (clickable links to partner pages with role), engagement connections (clickable links)
- Client-side search with debounce (dataset is hundreds, not thousands)
- Empty state: brief intro when no search query and full list loads. Zero-results state when search finds nothing.
- Loading state while fetching

**Done when:**
- `/people` page exists and is accessible from sidebar
- Search works across name, email, org, title
- Results show full context with clickable partner/engagement links
- Org_type badges use the same visual language as partner detail People section (AWS Team, Partner, Third Party)
- Playwright screenshots confirm layout and search behavior
- SKILL.md Layer 2 updated with search pattern if new component introduced
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Follow existing design system (dark theme, SKILL.md patterns)
- Don't build a person detail page — clicking a partner link goes to the partner page
- Don't build inline editing of participant fields — future scope
- The three-group sphere (AWS/Partner/Third Party) must be visually consistent with partner detail People section

---

### Task 3.3: People Page — Filters & Create

**Intent:** Add filtering controls and the ability to create new participants directly from the People page.

**Scope:**
- Org_type filter: toggle buttons or tabs for All / AWS Team / Partner / Third Party
- Partner filter: dropdown to scope to a single partner's sphere
- Filters compose with search (search within filtered results)
- "Add Person" button opens a modal or form: name (required), email (required), title, organization, org_type dropdown, optional partner dropdown + role field
- On create: POST to `/api/people`, refresh the list, show the new person in results
- Form validation: email format, required fields
- Duplicate email detection: if the email already exists, show a clear message with a link to the existing person's entry

**Done when:**
- Org_type filter works and visually indicates active state
- Partner filter scopes results to that partner's sphere
- Filters compose with search
- "Add Person" creates participants with optional partner linking
- Duplicate email detection works with clear messaging
- Playwright screenshots confirm filter and create interactions
- SKILL.md Layer 2 updated with filter pattern and form/creation pattern
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Email normalized to lowercase on create
- Partner dropdown: all partners, sorted alphabetically
- Role dropdown: established roles (Alliance Lead, PSA, Account Manager, PMM, Contact, AWS Contact, CRM Contact, Third Party)
- Don't build batch import — single create only

---

## Phase 4: Today Page Rebalancing

**Purpose:** The Today page is the #1 landing screen but meetings are buried under 38 tasks. Rebalance so the PDM immediately sees what's happening today (meetings) and what needs attention (tasks), without scrolling past everything.

**Design intent:** This is a launchpad, not a data dump. The North Star says: "Land here, see what needs doing, click into the thing, and go." The current layout fails this by making meetings invisible. The new layout should make today's meetings unmissable, show a focused subset of tasks, and provide clear paths to everything else.

**Any layout pattern established here must be evaluated for universal applicability.** If a two-column layout works for Today, document it as a system pattern in SKILL.md — other pages might benefit from it too.

### Task 4.1: Today Page Layout Redesign

**Intent:** Restructure the Today page so meetings and tasks coexist without either dominating. The agent should evaluate layout options and choose what best serves the North Star's "launchpad" intent.

**Scope:**
- Read north-star.md Part 2 (The Three Screens — Today) and the current Today page component
- Take Playwright screenshots of the current layout as baseline
- Evaluate layout options (these are suggestions, not mandates — choose what works best):
  - **Option A:** Stacked — Today's Meetings at top, Tasks (capped at ~10) with "View all", Inbox, Upcoming Meetings
  - **Option B:** Two-column on desktop — Meetings column (today + upcoming) on one side, Tasks + Inbox on the other. Stacks to single column on narrower viewports.
  - **Option C:** Something else that better serves the launchpad intent
- Implement the chosen layout with these requirements:
  - **Today's Meetings:** Prominent, can't miss. "Open Notes" as primary action. If no meetings today, section gracefully collapses.
  - **Tasks section:** Grouped by partner, capped at a reasonable number with "View all on Tasks page" link. Sort logic: overdue first, then by due date, then by partner alphabetical, then by creation date descending.
  - **Inbox:** Count + CTA (existing behavior, positioned correctly in hierarchy)
  - **Upcoming Meetings:** Next 7 days, lower visual priority than today's meetings
- Layout should adapt gracefully when there are no meetings today (weekends) — tasks and inbox rise naturally

**Done when:**
- Today page has clear visual hierarchy: Today's Meetings → Tasks (capped) → Inbox → Upcoming
- Meetings are visible without scrolling on a standard viewport (1080p+)
- Task cap prevents the task list from burying everything below
- Sort logic produces sensible task order even when no tasks have due dates
- Layout works on desktop (≥1024px) and tablet widths
- Graceful behavior on no-meeting days
- Playwright screenshots confirm the layout at multiple viewport widths
- SKILL.md updated if new layout patterns established (two-column, list capping convention, etc.)
- `tsc --noEmit` clean, tests pass

**Constraints:**
- Don't change task data or API — this is layout/display only
- Don't remove the ability to see all tasks — the cap must have a clear "View all" path
- "Open Notes" on today's meetings is the #1 interaction in the app — don't diminish it
- Any layout pattern introduced must be documented as a potential system-wide pattern

---

## Verification Sequence

After all phases complete:

1. **Full diagnostic:** `tsc --noEmit`, `npx vitest run`, `scripts/ui-audit.sh`
2. **Playwright verification pass:** Screenshot every page (Today, Partners list, a partner detail, a meeting detail with recurrence, an engagement detail, People, Tasks, Meetings list, Inbox, Programs, Events). Save to `.claude/screenshots/plan-2-complete/`
3. **SKILL.md audit:** Confirm all new patterns from Phases 2-4 are documented in the appropriate layers
4. **Doc consistency check:** Stats in `goal-state.md`, `CLAUDE.md`, and `entity-model.md` all match
5. **Commit history:** Clean, one commit per task with descriptive messages

---

## Success Criteria

Plan 2 is complete when:
- A PDM can see all their recurring meeting series, understand each rhythm at a glance (including visual history via timeline strip), spot anomalies (shifted/skipped occurrences), and manage them (change day, skip, end, create new series from standalone)
- A PDM can search for any person across all partners, filter by sphere (AWS/Partner/Third Party), filter by partner, and create new participants — all from a dedicated People page
- The Today page shows today's meetings without scrolling past tasks, with a clear launchpad hierarchy
- Every page is visually consistent with SKILL.md and north-star.md
- All new interaction and visualization patterns are documented in SKILL.md
- All docs reflect the current state
- Zero TypeScript errors, all tests pass, audit clean
---

## Completion Summary

**Completed:** 2026-03-29
**Duration:** Single session (plan execution + post-plan fixes)

### What Was Accomplished

**Phase 1 — Foundation (4 tasks):** Fixed critical anchor_day DDL gap (migration 082), cleaned stale docs, verified all interactive changes render correctly, populated SKILL.md Layer 2 and Layer 3 with 24 existing patterns.

**Phase 2 — Meeting Recurrence Overhaul (7 tasks):** Designed and built the complete recurrence management experience: SeriesDisplay (unified rhythm + navigation + shifted indicator), RecurrenceEditor simplification (indefinite default, hidden end date, 3-date preview), SeriesActions (secondary treatment with inline confirmation for End Series), standalone-to-series conversion, anchor snap verification (9 new tests), and SeriesTimeline strip.

**Phase 3 — People Page (3 tasks, built in one pass):** New /people route with GET/POST API, search bar, org_type filter pills, partner dropdown filter, "Add Person" modal with duplicate detection. Sidebar entry added.

**Phase 4 — Today Page Rebalancing (1 task):** Two-column layout (meetings left 60%, tasks/inbox right 40%). Task cap reduced from 10 to 6. "+N more tasks" link.

### Post-Plan Fixes (Interactive)
- RecurrenceEditor startEditing prop (form wasn't appearing in edit mode)
- Today page container widened (max-w-6xl → max-w-7xl), gap reduced
- Timeline strip enlarged (12px → 16px blocks, legend added, tooltips with title)
- Program enrollment + event participation CRUD (6 API endpoints, 2 components)

### Stats Change

| Metric | Before | After |
|--------|--------|-------|
| Migrations | 81 | 82 |
| Tables | 17 | 17 |
| Routes | 29 | 34 |
| Pages | 12 | 13 |
| Components | 30 | 35 |
| Tests | 435 | 444 |
| Decisions | #366 | #373 |

### Decisions Logged
#367-373 (anchor_day fix, recurrence overhaul, People page, Today layout, RecurrenceEditor startEditing, enrollment/event CRUD, event participations always visible)

### Issues Noted for Future
- Today page right column clips content at narrower widths
- Timeline strip visual encoding has too many competing states
- Program enrollment dates don't show year for historical achievements
- 5 null-email participants in registry
- 58/80 enrollments have null program_id
- Vasion duplicate series needs merge
- KnowBe4, NinjaOne, Cloudaware standalones should become series roots
