# Roadrunner Task Plan: People Architecture, Recurrence Engine & UI Polish
**Created:** 2026-03-28
**Status:** Active
**Phases:** 5

---

## Business Context

Roadrunner's data architecture is complete (3 rings, 23 tables, all syncing). A full UI overhaul was merged. What remains: 3 unsynced contact fields need wiring (People architecture), the meeting recurrence engine needs an anchor-day fix to prevent day-of-week drift, broken navigation links and formatting bugs need cleanup, the Today page needs its most important section (today's meetings), and the entire app needs an enterprise-quality UI polish pass.

**Key principle:** Structural phases (1-4) come before visual polish (5). You don't paint walls before the plumbing is done. The agent in Phase 5 inherits a complete, clean codebase with every data field wired.

**Reading order before starting:** north-star.md → SKILL.md → entity-model.md → ui-ux-best-practices.md

---

## Phase 1: People Data Wiring

**Intent:** Complete the People architecture — all 8 partner contact fields syncing into `partner_participants`, engagement contributors query available, People section on partner page shows three curated groups + activity pool.

**Context:** 5 of 8 contact fields already sync. CRM Contact has its field ID in field-maps.ts but pull.ts never reads it. AWS Contacts (`fldlVCqjgWbXtd6ev`) and Third Party Contacts (`fldWxSyo2pMcoXcpL`) are brand new AT fields. The `participants` table is the universal people registry. `partner_participants` links people to partners with roles. The contact parser (`parseContactList`) splits on `/[\n;]/` — both newlines and semicolons.

### Task 1.1: Wire CRM Contact sync
**Scope:** Add CRM Contact to the partner pull sync pipeline.
**What to do:**
- In `field-maps.ts`: verify `crmContact` key maps to field ID `fldq6edTVHpkupPVx` (it should already)
- In `pull.ts` `syncPartners()`: read the `crmContact` field from the AT record
- Parse it as a single contact via `parseRoleContact(raw, "CRM Contact")`
- Add to the partner's contact arrays with `org_type: "third_party"`
- Ensure `syncPartnerContactsToRegistry()` processes it
**Done when:** Run sync. Partners with CRM Contact data (Progress, Flexera) show the contact in `partner_participants` with role "CRM Contact" and org_type "third_party". Partner page People section renders them.

### Task 1.2: Wire AWS Contacts sync
**Scope:** Add AWS Contacts to the partner pull sync pipeline.
**What to do:**
- In `field-maps.ts`: add mapping for `awsContacts` → field ID `fldlVCqjgWbXtd6ev`
- In `pull.ts` `syncPartners()`: read the `awsContacts` field from the AT record
- Parse via `parseContactList(raw, "AWS Contact")` (multi-person field, may have multiple lines/semicolons)
- Add to the partner's AWS team arrays with `org_type: "internal"`
- Ensure `syncPartnerContactsToRegistry()` processes them
**Done when:** If any partner has AWS Contacts populated in AT, they appear in `partner_participants` with role "AWS Contact" and org_type "internal". (Field is currently empty across all partners — verify the pipeline works by temporarily adding a test contact in AT, confirming sync, then removing.)

### Task 1.3: Wire Third Party Contacts sync
**Scope:** Add Third Party Contacts to the partner pull sync pipeline.
**What to do:**
- In `field-maps.ts`: add mapping for `thirdPartyContacts` → field ID `fldWxSyo2pMcoXcpL`
- In `pull.ts` `syncPartners()`: read the `thirdPartyContacts` field from the AT record
- Parse via `parseContactList(raw, "Third Party")` (multi-person field)
- Add to the partner's contact arrays with `org_type: "third_party"`
- Ensure `syncPartnerContactsToRegistry()` processes them
**Done when:** Same verification pattern as Task 1.2.

### Task 1.4: Build Engagement Contributors query
**Scope:** Create a query function that returns all participants from a partner's engagements and meetings, deduplicated, with engagement context.
**What to do:**
- Create `getEngagementContributors(partnerId: string)` in `src/lib/db/participants.ts` (or new file)
- Query: find all engagement_participants and meeting_participants where the engagement/meeting belongs to this partner
- Join with `participants` to get name, email, title, organization
- Deduplicate by participant_id
- Return grouped by engagement (engagement name + list of contributors with their side: internal/partner/third_party)
- Exclude anyone already in `partner_participants` for this partner (they're in the curated tier)
**Done when:** Function returns correct data for a partner with multiple engagements. Contributors appear grouped by engagement with no duplicates.

### Task 1.5: Update People section on partner page
**Scope:** Render three curated groups + collapsed engagement contributors.
**What to do:**
- Fetch `partner_participants` for the partner, grouped by org_type and role
- Fetch engagement contributors via the new query
- Render: AWS Team (PSA, Account Manager, PMM, AWS Contacts), Partner Team (Alliance Lead, Partner Contacts), Third Parties (CRM Contact, Third Party Contacts)
- Below: "Engagement Contributors (N people across M engagements)" — collapsed by default, expandable, grouped by engagement name
- Each contributor shows: name, role/side badge, email
**Done when:** Partner page People section shows all three curated groups with correct data. Engagement Contributors section is collapsible and shows grouped participants.

**Phase 1 verification:** tsc --noEmit clean. All tests pass. Run sync and confirm partner_participants has correct entries for CRM Contact. Screenshot partner pages to verify People section rendering.

---

## Phase 2: Cleanup & Quick Fixes

**Intent:** Remove dead code, fix broken navigation, correct display formatting. Small independent changes.

### Task 2.1: Dissolve Relationships
**Scope:** Remove the Relationships system from Roadrunner.
**What to do:**
- Check if any contacts on the 7 AT relationship records have useful emails not already in `participants` — if so, ensure they exist in participants via a one-time insert
- Create migration: DROP TABLE `relationship_participants`, DROP TABLE `relationships`
- Remove `/relationships/[id]` page (src/app/relationships/)
- Remove any relationship-related components
- Clean up imports in any file that references relationships
- Remove relationship sync from pull.ts and push.ts if present
- Update types.ts — remove Relationship type and RelationshipType enum if no longer referenced
**Done when:** No references to relationships anywhere in src/. Migration runs clean. No 404 pages. tsc clean. All tests pass.

### Task 2.2: Fix breadcrumb 404s
**Scope:** Engagement and relationship detail pages have breadcrumbs pointing to deleted list pages.
**What to do:**
- Engagement detail (`/engagements/[id]`): breadcrumb currently links to `/engagements` (404). Change to link to the parent partner page: fetch the engagement's partner_id, link to `/partners/[partner_id]`
- If relationship detail page still exists after Task 2.1, update its breadcrumb similarly (or it's already removed)
**Done when:** Navigate to any engagement detail page. Breadcrumb links to the correct partner page, not a 404.

### Task 2.3: Fix meeting type formatting
**Scope:** Meeting types display raw enum values (`partner_cadence`) instead of formatted labels (`Partner Cadence`).
**What to do:**
- The `MEETING_TYPE_DISPLAY` map already exists in `field-maps.ts`
- Find all UI components that render `meeting.meeting_type` — at minimum: meeting detail page, meetings list, Today page upcoming section
- Replace CSS `capitalize` with a lookup against the display map, or a simple `.replace(/_/g, ' ')` with proper title casing
- Create a shared utility if one doesn't exist: `formatMeetingType(type: string): string`
**Done when:** Every place a meeting type is displayed shows "Partner Cadence" not "Partner_cadence" or "partner_cadence".

### Task 2.4: Update CLAUDE.md and goal-state.md
**Scope:** Correct stale numbers and references.
**What to do:**
- CLAUDE.md: correct page count, component count, remove references to deleted components (PartnerReferencePanel, CompactRow, DetailHeader)
- goal-state.md: correct migration count, test count, page count
- Both: update decision count to reflect current state
- Verify the Documentation Map in CLAUDE.md matches the actual file structure (including the new plans/ and sessions/ directories from the other chat)
**Done when:** All numbers in CLAUDE.md and goal-state.md match reality. No references to components that don't exist.

**Phase 2 verification:** tsc clean. All tests pass. No 404s from any navigation path. Meeting types display formatted everywhere.

---

## Phase 3: Meeting Recurrence Engine

**Intent:** Fix day-of-week drift, add series management, improve create flow. The biggest single phase.

**Context:** Current engine in `meeting-recurrence.ts` uses `calculateNextDate(currentDate, pattern)` which advances from the previous occurrence's actual date. No anchor concept. `spawnNextOccurrence` copies all fields from the source meeting. Series is linked by `series_id` (UUID of the root meeting). `getSeriesSiblings(seriesId)` already exists for series navigation.

### Task 3.1: Add anchor_day column
**Scope:** Database migration only.
**What to do:**
- Create migration: `ALTER TABLE meetings ADD COLUMN anchor_day smallint`
- No NOT NULL constraint — existing non-recurring meetings will be NULL
- Update `Meeting` type in types.ts to include `anchor_day: number | null`
- Update db/meetings.ts create and update functions to handle anchor_day
**Done when:** Migration runs. tsc clean. anchor_day column exists and is nullable.

### Task 3.2: Update calculateNextDate with anchor snapping
**Scope:** Core engine logic change.
**What to do:**
- Add `anchorDay?: number` parameter to `calculateNextDate`
- After advancing, if anchorDay is provided and pattern is weekly/biweekly: snap the result to the correct day of week (find the nearest target day that's >= today)
- If pattern is monthly/quarterly and anchorDay is provided: snap to the correct day of month (with clamping for short months)
- If no anchorDay, behave exactly as before (backward compatible)
- Update tests to cover: normal advance, advance with anchor snap, advance with rescheduled occurrence + anchor snap, missed occurrences with anchor
**Done when:** A weekly Wednesday meeting (anchor_day=3) whose last occurrence was rescheduled to Thursday spawns the next occurrence on Wednesday, not Thursday. All existing tests still pass.

### Task 3.3: Update spawnNextOccurrence to use anchor
**Scope:** Spawn engine reads anchor from series root.
**What to do:**
- In `spawnNextOccurrence`, before calling `calculateNextDate`, look up the series root meeting (where id = series_id) to get its anchor_day
- Pass anchor_day to calculateNextDate
- When spawning, copy anchor_day to the new meeting (so the chain is consistent)
**Done when:** Spawned meetings have correct anchor_day. Day-of-week drift is eliminated.

### Task 3.4: Update create meeting flow
**Scope:** UI improvements for creating recurring meetings.
**What to do:**
- When "Recurring meeting" is checked in the create modal: show a day-of-week picker (Mon-Sun) for weekly/biweekly patterns, auto-populated from the selected meeting date
- Show a preview of the next 4 occurrence dates based on the selected pattern + anchor
- On create: set anchor_day on the meeting (which becomes the series root via the self-referential series_id pattern)
- Pattern picker should show: Weekly, Biweekly, Monthly, Quarterly
**Done when:** Creating a recurring weekly meeting on Wednesday clearly shows Wednesday as the anchor day. Preview shows next 4 Wednesdays. The created meeting has correct anchor_day value.

### Task 3.5: Add series management UI
**Scope:** Meeting detail page controls for managing a recurring series.
**What to do:**
- Add series context display: "Weekly on Wednesdays · Occurrence 5 of series (since Jan 8)" using `getSeriesSiblings` + anchor_day
- Add "Edit Series" control: allows changing pattern, anchor day, end date. Updates the series root meeting. All future spawns use new values.
- Add "Skip This One" control: deletes/cancels just this occurrence. Doesn't affect the series. The spawn engine will create the next occurrence from the most recent non-skipped one.
- Add "End Series" control: sets recurrence_pattern and recurrence_end on the series root (and current meeting if different), stopping future spawns.
- When editing a recurring meeting's date: prompt "Just this meeting" vs "This and future meetings"
**Done when:** Can edit series anchor from Wednesday to Tuesday — future spawns move to Tuesday. Can skip one occurrence without breaking the chain. Can end a series.

### Task 3.6: Backfill existing recurring meetings
**Scope:** Set correct anchor_day on all existing series root meetings.
**What to do:**
- Find all meetings where id = series_id (series roots)
- Compute the day of week from the root meeting's meeting_date
- Set anchor_day = that day of week
- Migration or one-time script
**Done when:** All series root meetings have correct anchor_day values.

### Task 3.7: Add visual indicators
**Scope:** Show recurring status in all meeting displays.
**What to do:**
- Add ↻ icon next to recurring meeting titles on: Today page, meetings list, partner detail recent meetings
- Meeting detail: show series badge with context (pattern + anchor day + occurrence number)
- Ensure non-recurring meetings don't show any recurrence UI
**Done when:** Can visually distinguish recurring from non-recurring meetings at a glance on every page that shows meetings.

**Phase 3 verification:** tsc clean. All tests pass (including new recurrence tests). Create a weekly Wednesday meeting. Reschedule one to Thursday. Verify next spawn is Wednesday. Edit series to Tuesday. Verify future spawns on Tuesday. End series. Verify no more spawns.

---

## Phase 4: Today Page Improvements

**Intent:** Make Today the launchpad from the North Star — today's meetings front and center, tasks interactive, upcoming below.

### Task 4.1: Split Today's Meetings from Upcoming
**Scope:** Filter and display today's meetings as a separate, prominent section.
**What to do:**
- Query meetings where meeting_date = today
- Render at the top of the page with partner name, title, type badge, and prominent "Open Notes" action button
- If no meetings today, section collapses gracefully (not an empty state that wastes space)
- Upcoming section below: next 7 days, lower visual priority
**Done when:** On a day with meetings, "Today's Meetings" appears at top with one-click note access. On a day with no meetings, section is hidden.

### Task 4.2: Improve task interaction
**Scope:** Make tasks interactive on the Today page.
**What to do:**
- Add checkboxes for inline task completion (API call to update task status)
- Group tasks by partner
- Highlight due dates: overdue in red/warning, approaching (within 3 days) in amber
- Show partner name on each task
**Done when:** Can complete a task directly from the Today page. Tasks are grouped by partner with due date highlighting.

**Phase 4 verification:** tsc clean. All tests pass. Screenshot Today page on a weekday with meetings — meetings at top, tasks below with checkboxes, upcoming at bottom.

---

## Phase 5: UI/UX Polish Pass

**Intent:** Bring every page to enterprise-grade visual quality. This is the agent's domain — creative latitude within the design system constraints.

**Prerequisites:** Phases 1-4 complete. All data wired, broken things fixed, recurrence working, Today page restructured.

**Reading order:** north-star.md → SKILL.md → ui-ux-best-practices.md

**Scope:**
- Visual consistency across all pages (badges, spacing, typography, colors)
- Enterprise loading states on all async operations
- Navigation safety (unsaved changes warnings)
- Button disabled states during operations
- Confirmation dialogs on destructive actions
- Empty states that are clean and helpful
- Dark theme polish (intentional, not afterthought)
- Mobile sidebar behavior
- Financial number formatting consistency
- Any orphaned components or dead imports
- Use scripts/interact.ts for interaction testing alongside screenshots

**Self-check after each page:**
- [ ] tsc --noEmit clean
- [ ] All tests pass
- [ ] Run `bash scripts/ui-audit.sh` for mechanical checks
- [ ] Screenshot the page at 1440x900 and compare to design intent
- [ ] No raw enum values
- [ ] Every async button disables during operation
- [ ] Every destructive action has confirmation
- [ ] Empty states are helpful, not broken-looking
- [ ] Dark theme looks native

**Done when:** Every page passes the self-check. Screenshots in `.claude/screenshots/` show professional, enterprise-grade UI across all pages.

---

## Verification Sequence (run after every task)

1. `tsc --noEmit` — zero type errors
2. `npx vitest run` — all tests pass
3. Visual check — screenshot relevant pages
4. Navigation check — no 404s from any link

---

*Plan complete. Execute in order. Commit after each task. Move to `docs/plans/archive/` when all phases are done.*