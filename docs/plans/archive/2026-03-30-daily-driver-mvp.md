# Plan 3: Daily Driver MVP

**Created:** 2026-03-30
**Branch:** `plan-3/daily-driver-mvp`
**Goal:** Transform Roadrunner from a functional prototype into a reliable, polished daily-driver tool. Fix critical data-loss bugs, modernize the layout system, complete the meeting recurrence experience, wire up people connectivity, and audit every surface for professional quality.

---

## Business Context

Steven is a PDM managing ~22 ISV partners. He opens Roadrunner most often to take meeting notes, second to look at a partner, third to manage tasks. The app works — the data architecture is complete, the AI pipeline is stable, the sync layer is solid. What's missing is the layer of trust and polish that makes him reach for Roadrunner instinctively instead of reluctantly. Meetings get rescheduled every week and the recurrence system can't handle it cleanly. Notes can be lost mid-workflow. The layout wastes screen space on a 13" laptop. Tasks require endless scrolling. The sidebar looks unfinished. This plan fixes all of it.

---

## Before Starting

1. Read these documents in this order:
   - `docs/north-star.md` — Vision, page specs, UX standards, anti-patterns
   - `.claude/roadrunner-ui/SKILL.md` — Living design system (Layer 1: Visual Foundations, Layer 2: Interaction Patterns, Layer 3: Data Visualization)
   - `docs/entity-model.md` — All 17 tables, FKs, cascade rules, ring model
   - `.claude/references/ui-ux-best-practices.md` — Interaction pattern guidance
   - View reference screenshots in `.claude/references/` to calibrate quality bar
2. Create the plan branch: `git checkout -b plan-3/daily-driver-mvp`
3. After Task 1.1, push and STOP — report to Steven so he can create the draft PR

## Phase-Specific Write Access

Default guardrails from CLAUDE.md apply unless overridden here:

- **Phase 1–3 (Layout, Save States, Page Layouts):** High-confidence paths + `src/app/layout.tsx`. Phase 2 may create shared hooks in `src/components/shared/` or `src/lib/` (e.g., `useUnsavedChanges`).
- **Phase 4 (Recurrence):** Full write access to `src/app/api/meetings/`, `src/lib/meeting-recurrence.ts`, and `src/lib/db/meetings.ts`. If a new migration is needed (e.g., exception tracking column), document the need in task completion notes — Steven will create it.
- **Phase 5 (People):** Read all lib/db files for data shape understanding. Write access to components and pages. If API changes needed for people linking, write access to `src/app/api/people/` and `src/app/api/participants/`.
- **Phase 6 (Robustness):** Write access to any file needed to fix audit findings. Note every medium-confidence file changed in commit messages.

---

## Verification Protocol (Every Task)

After EVERY task, before reporting ready:
1. `npx tsc --noEmit` — must pass clean
2. `npx vitest run` — all tests must pass
3. `bash scripts/ui-audit.sh` — must pass clean
4. If UI changes: screenshot all changed pages at 1280 AND 1440, VIEW screenshots, compare against `.claude/references/`, fix anything that looks off
5. If interaction changes: run `scripts/interact.ts` tests for changed flows
6. If you established or improved a pattern: update SKILL.md
7. `git commit` with descriptive message (one commit per task)
8. `git push` after each task

Screenshots go in `.claude/screenshots/2026-03-30-plan3-{phase}-{task}/`

---

## Phase 1: Foundation — Layout System & Sidebar

**Why first:** Every subsequent phase touches pages that will shift when the layout changes. Get the container and shell right, then build on a stable base.

### Task 1.1: Universal PageContainer Component

**Scope:** Create a single `PageContainer` component that replaces all ad-hoc container patterns across the app. Replace every page's individual `mx-auto max-w-*` pattern with this component.

**Intent:** Eliminate the scattered, inconsistent container classes (11+ files using different max-widths with no rationale) and establish a single layout primitive that every current and future page inherits.

**Context:**
- Diagnostic found: 11+ files independently set `mx-auto max-w-* p-6 lg:p-8`, with an arbitrary split between `max-w-7xl` and `max-w-5xl` and two pages with no max-width at all
- Decision: fluid container with `max-w-[1600px]`, consistent horizontal padding (`px-6`), no vertical padding in the container (pages control their own vertical spacing)
- The root layout (`src/app/layout.tsx`) currently has: sidebar (`w-56` fixed) + `<main className="flex-1 overflow-y-auto">`
- PageContainer lives inside `<main>`, wrapping each page's content

**Implementation notes:**
- Create `src/components/layout/PageContainer.tsx`
- Props: `children`, optional `className` for page-specific additions (no width overrides — the container IS the width)
- Replace the container pattern in ALL 13 pages. Search for `mx-auto` in `src/app/` to find every instance
- Verify the two unbounded pages (program detail, event detail) now get proper containment
- The Today page has a different internal layout (two-column grid) — that's fine, PageContainer wraps the outer shell, the page controls its internal grid

**Done-when:**
- Single `PageContainer` component exists and is used by all 13 pages
- `grep -r "max-w-5xl\|max-w-6xl\|max-w-7xl" src/app/` returns zero matches (all pages use PageContainer)
- All pages render correctly at 1280px and 1440px viewport widths
- Screenshots confirm content is wider than before on all pages, with consistent padding
- No page has content going edge-to-edge without padding

**After this task:** Push to branch and STOP. Report to Steven: "First task committed and pushed to `plan-3/daily-driver-mvp`. Ready for you to create the draft PR."

---

### Task 1.2: Sidebar Revamp

**Scope:** Redesign the sidebar to be full-height, cleaner, and more visually balanced. Kill the gradient. Improve vertical distribution so there's no dead space cutoff after Events.

**Intent:** The sidebar currently cuts off after Events with empty space below, has a gradient treatment that doesn't fit the enterprise aesthetic, and looks boxy/unfinished. Make it look like it belongs in a professional tool.

**Context:**
- Current sidebar: `w-56` (224px) fixed width, likely has a gradient background
- Steven likes the current font choices and icon set — keep those
- North Star Part 4 defines the nav hierarchy: Primary (Today, Partners, Inbox with badge), Secondary (Tasks, Meetings), Tertiary (Programs, Events)
- Reference the `.claude/references/` screenshots for quality bar — look at how Linear, Notion, and Vercel handle sidebars
- Design system: `--surface: #1a1b23`, `--border: #2a2b35`, `--background: #0f1117`
- Anti-patterns from North Star: gradient text fades, anything flashy

**Implementation notes:**
- Sidebar should stretch full viewport height (min-h-screen or flex-based stretching from root layout)
- Background: solid color, likely `--surface` or a tone between `--surface` and `--background`. No gradients.
- Subtle right border using `--border` color instead of heavy visual separation
- Nav items: primary group at top, secondary group below with subtle separator, tertiary at bottom. Distribute vertically so the sidebar feels intentionally composed, not front-loaded.
- Keep the "Roadrunner" wordmark/title at top
- Keep inbox badge count
- Consider: the sidebar should feel like quiet furniture — always there, never demanding attention. The content area is the star.

**Done-when:**
- Sidebar stretches full viewport height, no dead space below Events
- No gradient anywhere in the sidebar
- Clean flat background with subtle right border
- Primary/Secondary/Tertiary groups visually distinguished but cohesive
- Looks professional at both 1280px and 1440px
- Screenshots compared against reference material — quality bar met

---

## Phase 2: Save States & Navigation Safety

**Why second:** This fixes the most critical trust issue — data loss. The layout is now stable, so component structures won't shift under us.

### Task 2.1: Build `useUnsavedChanges` Framework

**Scope:** Create a reusable React hook that provides unsaved-changes protection for any component. Handles both browser-level (beforeunload) and app-level (Next.js route) interception.

**Intent:** Build the protection framework ONCE so every surface in the app can wire in with a single hook call. This is the foundation for Tasks 2.2 and 2.3.

**Context:**
- Diagnostic found 7 unprotected surfaces (2 Critical, 2 High, 3 Moderate)
- NoteWorkspace has a partial beforeunload handler (review phase only) but NO Next.js route interception — sidebar clicks bypass it entirely
- Next.js App Router route interception: research the current best approach. Options include `next/navigation` router events, `beforePopState`, or a custom Link wrapper that checks dirty state before navigating.
- North Star Part 8 explicitly specifies: "Unsaved changes warn before navigation. Browser beforeunload + route interception."
- The hook should also support modal close protection (ESC key and click-outside)

**Implementation notes:**
- Create `src/components/shared/useUnsavedChanges.ts` (or `.tsx` if it needs to render a dialog)
- API should be simple: `const { setDirty, clearDirty, ConfirmDialog } = useUnsavedChanges()`
- `setDirty()` — marks unsaved changes exist
- `clearDirty()` — marks changes saved/discarded
- The hook registers beforeunload and route interception when dirty
- A `<ConfirmDialog>` component renders the "You have unsaved changes" modal when triggered
- Consider: should the dialog be a shared component or inline? Shared is cleaner.
- Test with Playwright: navigate away from a dirty page via sidebar click, via browser back, via tab close. All three should intercept.

**Done-when:**
- Hook exists and is importable from `src/components/shared/`
- Browser tab close on a dirty page shows native "Leave site?" dialog
- Sidebar navigation on a dirty page shows custom confirmation dialog
- Browser back button on a dirty page shows custom confirmation dialog
- Confirming "Leave" navigates away; confirming "Stay" keeps the user on the page
- Playwright interaction tests verify all three interception paths

---

### Task 2.2: Protect NoteWorkspace — The Critical Path

**Scope:** Wire `useUnsavedChanges` into NoteWorkspace for both the editing phase and the review phase.

**Intent:** The #1 daily workflow (take meeting notes → generate summary → save & lock) is currently the #1 data-loss risk. This task eliminates that risk entirely.

**Context:**
- Diagnostic findings for NoteWorkspace:
  - **Editing phase:** Has 30s auto-save interval, but no beforeunload. Up to 30s of notes at risk on tab close. No route guard at all.
  - **Review phase:** Has beforeunload, but no route guard. Sidebar clicks bypass protection entirely. AI-generated summary + extracted tasks can be lost.
- The editing phase auto-save is a good backstop but NOT a substitute for navigation protection. Users expect their last keystrokes to be there.
- The review phase is the highest-risk moment: the user just waited for AI generation and hasn't saved yet.

**Implementation notes:**
- Editing phase: call `setDirty()` on any textarea change, `clearDirty()` after auto-save completes or manual save
- Review phase: call `setDirty()` when summary is generated, `clearDirty()` only when "Save & Lock" completes
- Saved phase (Mode 3): no dirty state — user is viewing read-only content
- Consider: should "Generate Summary" also trigger a save of raw notes as a safety measure?
- Test the full flow with Playwright: type notes → generate summary → try to navigate away → confirm dialog appears → stay → save & lock → navigate away freely

**Done-when:**
- Typing in note editor and clicking a sidebar link shows confirmation dialog
- Generating a summary and clicking a sidebar link shows confirmation dialog
- After Save & Lock, navigation is free (no dialog)
- Browser tab close during editing or review shows native dialog
- Auto-save still works on its 30s interval (not broken by the hook)
- Playwright interaction test covers: edit → navigate (blocked) → save → navigate (allowed)

---

### Task 2.3: Protect Remaining Surfaces

**Scope:** Wire `useUnsavedChanges` into the remaining 5 unprotected surfaces identified in the audit.

**Intent:** Complete the safety net. Every place in the app where a user can enter data is now protected.

**Context:**
- Surfaces to protect (from diagnostic):
  - **PartnerScratchpad** (High): typed text lost on navigation. Requires explicit Enter to save.
  - **TasksClient modal** (High): multi-field "Add Task" form discarded on X/Escape
  - **EnrollmentSection modal** (Moderate): 5-field form discarded silently
  - **EventParticipationSection modal** (Moderate): 3-field form discarded silently
  - **RecurrenceEditor** (Moderate): pattern config lost on navigate-away
- For modals: the protection pattern is different from full-page protection. Modal close (X button, ESC, click-outside) should show a "Discard changes?" confirmation if the form has been modified.
- For Scratchpad: track dirty state from first keystroke, clear on successful save.

**Implementation notes:**
- Each surface needs: dirty state tracking, confirmation on attempted exit, clear on successful save
- Modals may need a `useModalUnsavedChanges` variant or the same hook with a modal-close integration
- Scratchpad: consider whether auto-save would be better than explicit Enter. If the user types and navigates, auto-save prevents data loss. But the current explicit-save was a design choice — preserve it and add navigation protection instead.
- Test each surface with Playwright: enter data → try to close/navigate → confirm dialog

**Done-when:**
- All 5 surfaces show confirmation when user tries to discard unsaved data
- Modal close on dirty forms asks "Discard changes?" with Stay/Discard options
- Scratchpad navigation shows confirmation if unsaved text exists
- RecurrenceEditor navigation shows confirmation if pattern was modified
- Playwright tests verify protection on each surface

---

## Phase 3: Page Layouts — Information Density & Clarity

**Why third:** The universal container is in place (Phase 1), the safety net is complete (Phase 2). Now optimize how each page uses the wider space.

### Task 3.1: Today Page — Proper Two-Column Dashboard

**Scope:** Redesign the Today page two-column layout to work correctly within the new fluid container. Fix content clipping, kill the mystery gray bar, show more tasks, improve visual balance.

**Intent:** The Today page is the first thing Steven sees every morning. It should immediately answer "What do I need to do right now?" without clipping, truncation, or visual artifacts. The current implementation has the right idea (two columns) but the execution is broken — right column clips, proportions are off, gray bar artifact at bottom.

**Context:**
- North Star Part 2 defines Today: meetings left, tasks + inbox right. "Launchpad, not destination."
- Current: `max-w-7xl` (now PageContainer), 60/40 split, task cap at 6, right column clips
- Decision: 55/45 or 50/50 proportions. Show 10-12 tasks instead of 6. Both columns aligned top.
- The mystery gray bar at the bottom needs investigation — likely a CSS artifact from the layout structure
- Today page shows: Today's Meetings count, Upcoming section, My Tasks count, Inbox count

**Implementation notes:**
- Use CSS Grid (`grid-cols-[1fr_1fr]` or `grid-cols-[55fr_45fr]`) instead of flexbox for predictable column sizing
- Right column: remove any overflow-hidden or max-height constraints that cause clipping
- Tasks: increase visible count from 6 to ~12, with "View all" link to /tasks
- Investigate and kill the gray bar — check for stray border-bottom, background, or pseudo-elements
- Both columns should independently scroll if content exceeds viewport? Or page scrolls as a whole? Page-level scroll is simpler and more predictable.
- Test at 1280px (13" laptop) — both columns must be usable without horizontal overflow

**Done-when:**
- Two-column layout with no content clipping in either column
- Tasks show 10-12 items (not capped at 6)
- No mystery gray bar
- Both columns aligned at top with consistent gap
- Page looks intentional and balanced at 1280px and 1440px
- Long task descriptions wrap properly, never truncate or overflow
- Screenshot comparison shows clear improvement over current state

---

### Task 3.2: Tasks Page — Full-Width Density

**Scope:** Optimize the Tasks page to show more tasks in less vertical space using the full width of the fluid container.

**Intent:** With 61 open tasks, the current narrow single-column layout requires excessive scrolling. The wider container should display tasks more densely while maintaining readability.

**Context:**
- Current: `max-w-5xl` (1024px), single column, one task per row, lots of vertical space per row
- Now gets PageContainer width (up to 1600px on large monitors, ~1050px on 13" after sidebar)
- The page already has: search bar, filter pills (All/Me/Internal/Partner/Third Party), Group by Partner toggle, task count
- Each task row shows: checkbox, description, provenance subtitle, owner badge, delete icon
- 61 tasks grouped by partner means ~15 partner groups averaging 4 tasks each

**Implementation notes:**
- Keep the list paradigm (not cards) — tasks are text-heavy and variable-length
- Tighten row vertical padding — reduce from current spacing to more compact rows
- With the wider container, descriptions have more horizontal room and won't need to wrap as much
- Consider: at wide viewports (1440+), could the task list use two columns? E.g., two side-by-side task lists? This would be aggressive but could work with the Group by Partner view — left column gets A-L partners, right gets M-Z. Only do this if it looks natural and doesn't feel forced.
- The search bar and filter pills should span the full width
- "51 of 61 tasks" count should be visible without scrolling

**Done-when:**
- Tasks page uses full PageContainer width
- Row height is tighter — visibly more tasks per viewport
- Descriptions don't truncate — they have room to display fully
- Filter pills and search bar span the available width
- Page feels professional and dense (not cramped) at both viewport sizes
- Screenshot shows measurable improvement in tasks-per-viewport

---

### Task 3.3: Partner Detail — Smart Section Pairings

**Scope:** Optimize the partner detail page to reduce scroll depth by pairing complementary sections side-by-side where it makes sense, while preserving the top-to-bottom narrative flow.

**Intent:** Partner detail is a long dossier-style page (13 sections). On a 13" screen with the old narrow container, you scroll forever. The wider container helps, but some sections are naturally complementary and can sit side-by-side to reduce depth without losing readability.

**Context:**
- North Star Part 2 defines the section order: Identity Bar → Brain → Co-Sell Performance → Active Engagements → Open Tasks → Recent Meetings → Program Enrollments → Strategic Goals → Funding → People → Solution Profile → Operational Status → Scratchpad
- Co-Sell Performance already has an internal two-column layout (MP TCV left, LARR right)
- Natural pairings that could go side-by-side:
  - **Program Enrollments + Strategic Goals** — both are reference lists, complementary
  - **MPOPP Funding + MDF Funding** — both are funding tables, naturally paired
  - **Solution Profile + Operational Status** — both are reference metadata
- Sections that should stay full-width: Brain (needs reading width), Engagements (complex cards), Tasks (action items), Meetings (digests), People (multiple groups), Scratchpad (editing)

**Implementation notes:**
- Use CSS Grid within partner detail for the paired sections
- Each pair: `grid-cols-2` with equal width columns and consistent gap
- Single sections: `col-span-2` or a separate full-width row
- The pairs should gracefully stack to single-column on narrow viewports (but we're designing for 1280+ so this is a safety net, not the primary experience)
- Don't change the section ORDER — just the spatial arrangement
- Each section's internal layout stays the same; this is about how sections relate to each other on the page

**Done-when:**
- At least 3 section pairs display side-by-side on the partner detail page
- Scroll depth is noticeably reduced (screenshot comparison)
- Full-width sections (Brain, Engagements, Tasks, Meetings, etc.) still read well
- Paired sections are visually balanced — neither side looks cramped or empty
- Page still reads as a coherent narrative from top to bottom
- Works at 1280px without horizontal overflow

---

### Task 3.4: List Pages Polish Pass

**Scope:** Quick pass across all list pages (Partners, Meetings, People, Programs, Events, Engagements) to ensure they render well with the new fluid container.

**Intent:** The fluid container automatically gives these pages more width. This task ensures nothing looks broken and applies minor improvements where the extra space creates opportunity.

**Context:**
- These pages are simpler than Today/Tasks/Partner detail — mostly table-like lists with filters
- The Partners list has segment grouping with performance bars
- The Meetings list has date grouping
- The People page has search + org_type filters + partner filter
- Programs/Events/Engagements are straightforward lists

**Implementation notes:**
- Verify each page renders correctly with PageContainer
- Check: do tables or lists stretch uncomfortably wide? If so, consider internal max-width constraints on the list content while keeping the page header full-width
- Look for truncated text that now has room to display fully
- Check filter/search bars span the width naturally
- This should be a quick pass, not a redesign. If something needs significant work, note it for Phase 6 rather than expanding scope here.

**Done-when:**
- All 6 list pages render cleanly with PageContainer
- No content overflow or broken layouts
- Filter bars and headers use the space well
- Screenshots at 1280px and 1440px show clean rendering
- Any issues that need deeper work are noted for Phase 6

---

### Task 3.5: SKILL.md Layout System Documentation

**Scope:** Document the new layout system in SKILL.md as a foundational layer. Capture PageContainer, page-type patterns, section pairing rules, and the sidebar treatment.

**Intent:** Future pages and refactors should follow the layout system without rediscovering it. This is the "design before code" principle applied retroactively — now that we've built the system, document it as the authority.

**Context:**
- SKILL.md has three layers: Visual Foundations, Interaction Patterns, Data Visualization Patterns
- The layout system is a new sub-section of Layer 1 (Visual Foundations) or a new Layer 0 (Structural Foundations)
- Document: PageContainer (width, padding), page-type patterns (dashboard-grid, list-page, detail-page, workspace-page), section pairing rules, sidebar treatment

**Done-when:**
- SKILL.md has a Layout System section covering all patterns established in Phase 1 and 3
- Each pattern has: name, when to use, implementation, rationale
- Future pages can reference this section to know which pattern to follow

---

## Phase 4: Meeting Recurrence — Complete Experience

**Why fourth:** The layout is stable, safety nets are in place, pages look right. Now fix the most complex feature gap — meetings get rescheduled every week and the system needs to handle it cleanly.

**Phase-specific context:** Read `src/lib/meeting-recurrence.ts`, `src/lib/db/meetings.ts`, `src/app/api/meetings/[id]/route.ts`, and all recurrence-related components (`RecurrenceEditor`, `SeriesDisplay`, `SeriesActions`, `SeriesTimeline`) before starting any task in this phase. Understand the current data model: meetings have `series_id` (self-referential FK to series root), `recurrence_pattern`, `recurrence_end`, `anchor_day`, `meeting_date`.

### Task 4.1: Verify Pattern Save & Diagnostic

**Scope:** Confirm that the recurrence pattern save bug (weekly → biweekly not persisting) is resolved by migration 082's anchor_day fix. Run a Playwright test that changes a pattern and verifies persistence.

**Intent:** The diagnostic suggested this is already fixed but we need confirmation. If it's still broken, we need to understand why before building more features on top.

**Context:**
- Diagnostic found: the full pipeline (RecurrenceEditor → PUT route → updateMeeting → Supabase) handles all 4 fields correctly
- The original bug was likely caused by the missing anchor_day column (fixed in migration 082)
- Need to verify with an actual interaction test, not just code reading

**Implementation notes:**
- Use Playwright (`scripts/interact.ts`) to:
  1. Navigate to a recurring meeting detail page
  2. Open the recurrence editor
  3. Change the pattern (e.g., weekly → biweekly)
  4. Save
  5. Reload the page
  6. Verify the pattern shows the updated value
- If the test passes: pattern save is confirmed working, move to 4.2
- If the test fails: investigate the actual failure point, fix it, then move to 4.2

**Done-when:**
- Playwright test confirms pattern changes persist through save and reload
- Test is saved as a reusable script for regression checking
- If a fix was needed, it's committed with clear explanation

---

### Task 4.2: Scope-Aware Editing — "Just This Meeting" vs "This and Future"

**Scope:** Add scope logic to meeting editing so changes to a series child can apply to just that occurrence or to the series going forward.

**Intent:** Steven reschedules meetings every week. Right now, changing a child meeting's date works but there's no way to say "move all future meetings to Thursday instead of Wednesday." The system needs to distinguish between one-off rescheduling and series pattern changes.

**Context:**
- Current: editing a meeting always writes to that single row. No scope concept.
- Needed: when editing a field that affects the series (recurrence_pattern, anchor_day, meeting_date on a child), prompt the user for scope.
- Series root detection: `series_id IS NULL AND recurrence_pattern IS NOT NULL` = this is a root
- Child detection: `series_id IS NOT NULL` = this is a child in a series
- "Just this meeting" = edit the child row only. Note that its date differs from anchor (it's an exception).
- "This and future" = update the series root's pattern/anchor and potentially update future unattended meetings. This is more complex.
- Individual meeting date changes via MeetingActions already work (just update meeting_date on that row)

**Implementation notes:**
- Add a `scope` parameter to PUT `/api/meetings/[id]`: `"this_one" | "this_and_future"` (default: `"this_one"` for backward compat)
- For `"this_one"`: update only the target meeting row. If the meeting_date differs from what the anchor would produce, it's an exception — the shifted-occurrence indicator already handles this visually.
- For `"this_and_future"`: update the series root's recurrence_pattern and/or anchor_day. Find all future meetings in the series (meeting_date > today, no notes taken) and update their meeting_dates to match the new pattern. This is the complex path.
- UI: When RecurrenceEditor opens on a series child, show a scope picker BEFORE the edit form. When it opens on a series root, no scope needed (changes always affect the series).
- Consider: should MeetingActions date editing also get scope? Probably yes — "Move this meeting to Thursday" (just this one) vs "Move all meetings to Thursdays" (series pattern change).
- Write tests for `calculateNextDate` with the new scope logic if it changes

**Done-when:**
- Editing a series child shows scope picker ("Just this meeting" / "This and future")
- "Just this meeting" changes only the target meeting
- "This and future" updates the series root and propagates to future meetings
- Editing a series root directly updates the series (no scope picker needed)
- API accepts scope parameter and handles both paths correctly
- Tests cover both scope paths
- Playwright test: change a child's pattern with "this and future", reload, verify series root updated

---

### Task 4.3: Reschedule Affordance & Exception Tracking

**Scope:** Make rescheduling an individual meeting a clear, discoverable action. Track exceptions so the system knows when a meeting was moved off its anchor day.

**Intent:** "Move this meeting from Wednesday to Thursday" should be obvious and one-click. And the system should remember that this meeting was rescheduled, not just silently have a different date.

**Context:**
- MeetingActions can already change meeting_date, but there's no prominent "Reschedule" button or date picker
- The shifted-occurrence indicator (amber date) already exists in SeriesTimeline when meeting_date differs from anchor_day
- What's missing: a clear UI affordance to reschedule, and a way to note WHY it's off-anchor

**Implementation notes:**
- Add a "Reschedule" action to MeetingActions for series children (or all meetings). Opens a date picker.
- When a series child is rescheduled, it's an exception to the pattern. The amber indicator already shows this.
- Consider: should we store a flag like `is_exception: boolean` or `original_date: date` on the meeting? Or is the implicit check (meeting_date doesn't match what anchor_day would produce) sufficient? The implicit check is simpler and already works for the timeline strip.
- The reschedule action should work with the scope system from 4.2: rescheduling is inherently "just this meeting" (you're moving one occurrence), but the user should have the option to say "move ALL future meetings to this new day" which becomes a "this and future" anchor_day change.

**Done-when:**
- Clear "Reschedule" affordance on meeting detail for series children
- Date picker allows selecting a new date
- Rescheduled meetings show the shifted-occurrence indicator
- Playwright test: reschedule a meeting, verify date changes and indicator appears

---

### Task 4.4: Timeline Strip Simplification

**Scope:** Simplify the SeriesTimeline visual encoding from 4 competing states to a cleaner design with 2 primary states and subtle exception indicators.

**Intent:** The current timeline strip has too many visual states (colors, shapes, borders) competing for attention. Simplify so it communicates the essential information: what happened and what's coming.

**Context:**
- Current: 4+ visual states with different colors and treatments
- Target: 2 primary states — **past** (muted, completed) and **future** (active, upcoming) — with a subtle indicator for exceptions (rescheduled meetings off anchor day)
- The timeline strip is a compact horizontal visualization, not a detailed calendar. Less is more.
- Consider: is the timeline strip worth keeping at all? If simplified well, yes — it gives a quick visual rhythm of the series. If it can't be simplified cleanly, consider replacing with a simple text list of occurrences.

**Implementation notes:**
- Reduce color palette: past meetings get `--muted`, future meetings get `--foreground` or `--accent`
- Exception indicator: a subtle dot, underline, or offset — not a whole different color
- Remove any state that isn't immediately obvious in meaning
- Legend: if needed at all, keep it minimal (1 line)
- Tooltips should still show date and any exception info

**Done-when:**
- Timeline strip has 2 clearly distinguishable primary states (past/future)
- Exceptions have a subtle indicator that doesn't compete with primary states
- Visual encoding is immediately understandable without studying a legend
- Strip feels clean and professional, not busy
- Screenshot comparison shows clear simplification

---

### Task 4.5: Recurrence Display Coherence

**Scope:** Unify SeriesDisplay, SeriesTimeline, SeriesActions, and RecurrenceEditor into a coherent recurrence experience on the meeting detail page.

**Intent:** These four components were built incrementally across Plan 1 and Plan 2. They work individually but feel like separate features rather than a unified system. Make them feel like one cohesive recurrence section.

**Context:**
- SeriesDisplay: "Weekly on Mondays · Since Mar 23" format
- SeriesTimeline: compact horizontal occurrence history (just simplified in 4.4)
- SeriesActions: skip/end/edit buttons (secondary visual treatment)
- RecurrenceEditor: pattern + day + preview (simplified in Plan 2)
- These should feel like layers of the same information: summary → visual → actions → edit

**Implementation notes:**
- Consider grouping all recurrence info into a single visual block on meeting detail
- Hierarchy: SeriesDisplay at top (always visible) → SeriesTimeline below it → SeriesActions as subtle affordances (not separate buttons floating somewhere)
- RecurrenceEditor opens inline or as a modal from the actions
- The whole block should be visually contained — maybe a subtle card or section treatment
- Test the full flow: see series info → see timeline → click edit → choose scope → make change → see updated info

**Done-when:**
- All recurrence components feel like one unified section on meeting detail
- Visual hierarchy is clear: info → visual → actions
- No redundant information across components
- The section is visually contained and professional
- Playwright flow test: view → edit → save → verify updated display

---

## Phase 5: People & Data Connectivity

**Why fifth:** The app is now stable, safe, well-laid-out, and the recurrence system works. Now wire the data connections so everything links together.

### Task 5.1: People Linkability Sweep

**Scope:** Make participant names clickable across every surface in the app, linking to `/people?q={name}` for instant person lookup.

**Intent:** Names appear everywhere — partner detail People section, engagement contributors, meeting detail participants, engagement detail stakeholders, task provenance. Currently they're just text. Making them clickable turns Roadrunner into a connected system where you can always answer "who is this person?"

**Context:**
- The `/people` page already has search that works: `GET /api/people?q={query}`
- Target: clicking a name anywhere navigates to `/people?q={encoded_name}`
- Surfaces where names appear (audit these — this list may be incomplete):
  - Partner detail → People section (3 curated groups + engagement contributors)
  - Partner detail → engagement cards (stakeholder names)
  - Meeting detail → participants list
  - Engagement detail → stakeholder names
  - Task provenance → owner names
  - ContactGroup / ContactRow components (shared rendering)
- ContactRow is the shared component used by most contact surfaces — modifying it once may handle many surfaces

**Implementation notes:**
- The most efficient approach: if ContactRow/ContactGroup handle most name rendering, add clickability there. Check if all surfaces use these shared components or if some render names directly.
- Use Next.js `Link` component for client-side navigation
- The link should not look like a blue underlined hyperlink — it should be subtle (slightly different text treatment on hover, cursor pointer) to maintain the professional look
- Names that are just text (no email) should still link — the search will find them by name
- Playwright test: click a name on partner detail → verify navigation to /people with search populated

**Done-when:**
- Participant names are clickable on ALL surfaces where they appear
- Clicking a name navigates to `/people?q={name}`
- The /people page shows search results for that person
- Visual treatment is subtle — names don't look like links until hover
- Playwright test verifies the flow from at least 3 different surfaces

---

### Task 5.2: Data Linking Audit & Entity Model Verification

**Scope:** Audit the data relationships across the system. Verify that entity-model.md accurately reflects the current schema. Check for orphaned records, broken FKs, or missing connections.

**Intent:** As the app has evolved rapidly (82 migrations, 3 dissolved tables, Ring 3 addition), there's risk that documentation has drifted from reality or that some data relationships are incomplete. Verify the ground truth before building more on top.

**Context:**
- `docs/entity-model.md` should document all 17 tables, FKs, cascade behaviors, and AT field IDs
- Known data issues from goal-state.md:
  - 58/80 program enrollments have null program_id (display works via program_name fallback)
  - 5 null-email participants in registry
  - 41 tasks without engagement_id (need backfill via meeting→engagement chain)
  - Vasion duplicate Partner Cadence series
  - KnowBe4, NinjaOne, Cloudaware standalone cadence meetings that should become series roots
- This task is about verifying the MODEL, not fixing all the data (data cleanup is manual work Steven does)

**Implementation notes:**
- Read the current `docs/entity-model.md`
- Query the actual database schema via Supabase to verify tables, columns, and FKs match documentation
- Check each FK relationship: does it cascade as documented? Are there orphaned records?
- Verify participant linkage: `partner_participants`, `engagement_participants`, `meeting_participants` — are these complete and consistent?
- If entity-model.md is out of date, update it
- Produce a brief report of data health findings: orphaned records, null FK counts, documentation gaps
- Note any cleanup tasks that Steven should do manually (these become pre-existing issues for next plan)

**Done-when:**
- entity-model.md accurately reflects the current database schema
- All FK relationships verified as correctly documented
- Report of data health findings produced (counts of orphans, nulls, etc.)
- Any documentation gaps fixed
- No code changes in this task — it's a verification and documentation task

---

## Phase 6: Robustness Audit & Polish

**Why last:** Everything structural is done. This phase is the final quality sweep — find and fix every rough edge.

### Task 6.1: Systematic Playwright Robustness Audit

**Scope:** Walk every page and every interactive element in the app with Playwright. Produce a comprehensive findings report of anything that doesn't meet the enterprise UX standard.

**Intent:** A systematic, machine-assisted audit catches things humans miss. Every button, every loading state, every error case, every visual edge case gets checked. The output is a prioritized fix list for Task 6.2.

**Context:**
- North Star Part 8 defines the enterprise UX standards: loading states (short/medium/long), error handling, navigation safety, confirmation dialogs, button labels
- Check EVERY page: Today, Partners (list + detail), Inbox, Tasks, Meetings (list + detail), People, Programs (list + detail), Events (list + detail), Engagements (list + detail)
- Check EVERY interactive element: buttons, links, forms, modals, toggles, dropdowns, checkboxes

**Implementation notes:**
- Create a systematic Playwright script that:
  1. Navigates to each page, screenshots it
  2. Checks for: loading states present, no raw enum values, no "undefined" or "null" text, no weird characters, professional button labels, no truncated text that should wrap
  3. Clicks every button/link, checks the result (loading indicator appears, confirmation dialog for destructive actions, etc.)
  4. Checks double-click protection on action buttons
  5. Tests error states where possible (e.g., submit with empty required fields)
- Output: a markdown file in `.claude/audit/` with findings categorized by severity (Critical / High / Medium / Low) and page
- Don't fix anything in this task — just audit and report

**Done-when:**
- Every page and every interactive element has been checked
- Findings report exists with categorized issues
- Report includes screenshots of each issue
- Zero known issues are missed (comprehensive coverage)

---

### Task 6.2: Fix Audit Findings

**Scope:** Address all findings from the robustness audit in priority order (Critical → High → Medium → Low).

**Intent:** Close every gap found in the audit. When this task is done, every surface in the app meets the enterprise UX standard.

**Context:**
- Work from the findings report produced in Task 6.1
- Some fixes will be trivial (change a label, add a loading spinner)
- Some may be moderate (add error handling to an API call, fix a layout issue)
- If any finding requires significant work (new feature, schema change), note it as a pre-existing issue for the next plan rather than expanding scope

**Implementation notes:**
- Work through findings in priority order
- Each fix: make the change, screenshot the before/after, verify the fix
- Batch related fixes (e.g., all button label fixes in one pass, all loading state fixes in one pass)
- Run the full verification sequence after each batch, not after each individual fix

**Done-when:**
- All Critical and High findings are fixed
- All Medium findings are fixed or documented as deferred with rationale
- Low findings are fixed where trivial, deferred where not
- Re-run the audit (abbreviated) to confirm fixes resolved the issues
- App passes a full visual review at 1280px and 1440px

---

### Task 6.3: Final Polish & Cleanup

**Scope:** Fix remaining minor issues, update all documentation, and prepare for plan completion.

**Intent:** Everything that doesn't fit neatly into another task. Date formatting, visual tweaks, documentation updates, SKILL.md finalization.

**Context:**
- Known remaining items:
  - Program enrollment dates don't show year for non-current-year achievements
  - Any visual issues noted during Phase 3 that were deferred to here
  - Any documentation that's out of date after all the changes
- SKILL.md should be fully current after all phases — do a final review
- goal-state.md needs comprehensive update with new stats
- entity-model.md may need updates from Task 5.2 findings

**Implementation notes:**
- Fix enrollment date formatting: use a date formatter that shows full year when the date is not in the current year
- Do a final SKILL.md review: every pattern established in this plan should be documented
- Update goal-state.md: new stats (migrations, tests, components, decisions), move completed items, update What's Next
- Final screenshot pass at 1280px and 1440px of every page — the "after" gallery

**Done-when:**
- All known minor issues resolved
- SKILL.md reflects every pattern from Plan 3
- goal-state.md updated with current state
- entity-model.md current and verified
- Final screenshot gallery captured
- App is ready for daily use

---

## Plan Completion Protocol

When all tasks are done:
1. Run final verification sequence across the entire app
2. Append a "## Completion Summary" to this plan: what was accomplished, stats change, decisions logged, pre-existing issues
3. Move this file to `docs/plans/archive/2026-03-30-daily-driver-mvp.md`
4. Replace `docs/plans/active.md` with the empty placeholder
5. Update `docs/goal-state.md` with the new current state
6. Update CLAUDE.md stats if changed
7. Final push to branch — Steven reviews and merges the PR

---

## Task Summary

| # | Task | Phase | Complexity |
|---|------|-------|------------|
| 1.1 | Universal PageContainer | Foundation | Moderate |
| 1.2 | Sidebar Revamp | Foundation | Moderate |
| 2.1 | useUnsavedChanges Framework | Save States | Significant |
| 2.2 | Protect NoteWorkspace | Save States | Moderate |
| 2.3 | Protect Remaining Surfaces | Save States | Moderate |
| 3.1 | Today Page Two-Column | Page Layouts | Moderate |
| 3.2 | Tasks Page Density | Page Layouts | Moderate |
| 3.3 | Partner Detail Pairings | Page Layouts | Moderate |
| 3.4 | List Pages Polish | Page Layouts | Light |
| 3.5 | SKILL.md Layout Documentation | Page Layouts | Light |
| 4.1 | Verify Pattern Save | Recurrence | Trivial |
| 4.2 | Scope-Aware Editing | Recurrence | Significant |
| 4.3 | Reschedule Affordance | Recurrence | Moderate |
| 4.4 | Timeline Strip Simplification | Recurrence | Moderate |
| 4.5 | Recurrence Display Coherence | Recurrence | Moderate |
| 5.1 | People Linkability Sweep | People | Moderate |
| 5.2 | Data Linking Audit | People | Moderate |
| 6.1 | Playwright Robustness Audit | Robustness | Significant |
| 6.2 | Fix Audit Findings | Robustness | Variable |
| 6.3 | Final Polish & Cleanup | Robustness | Light |

**Total: 20 tasks across 6 phases**
---

## Completion Summary

**Completed:** 2026-04-01
**Branch:** `plan-3/daily-driver-mvp` (17 commits, pending merge to main)

### Plan Execution (20 tasks, 6 phases)

All 20 tasks completed and verified. Key deliverables:

**Phase 1 — Layout & Navigation Foundation:**
- Universal PageContainer component (max-w-[1600px]) applied to all 13 pages
- Sidebar revamp: full-height, no gradient, anchored tertiary nav
- Horizontal overflow bug diagnosed and fixed (CSS Grid min-width: auto + min-w-0)

**Phase 2 — Navigation Safety:**
- useUnsavedChanges framework with 3 interception layers (beforeunload, popstate, sidebar clicks)
- 7 data-loss surfaces protected: NoteWorkspace (editing + review), PartnerScratchpad, TasksClient, EnrollmentSection, EventParticipationSection, RecurrenceEditor

**Phase 3 — Page Layouts:**
- Today page: 55/45 CSS Grid, 12-task cap, responsive stacking
- Tasks page: full-width density, tighter row padding
- Partner detail: 3 section pairings (enrollments+goals, funding+events, solution+ops)

**Phase 4 — Meeting Recurrence Completion:**
- Recurrence pattern save verified (anchor_day migration 082 confirmed working)
- Scope-aware editing: "this and future" propagation with notes protection
- Reschedule affordance on meeting detail
- Timeline strip simplified (4→2 visual states)
- Recurrence display coherence across all surfaces

**Phase 5 — People Connectivity:**
- Names linkable across all surfaces (partner contacts, attendees, engagement contributors)
- Data linking audit: engagement-partner coverage verified

**Phase 6 — Quality Audit:**
- Full Playwright robustness audit across all 13 pages
- All findings fixed, audit clean

### Post-Plan Interactive Work (decisions #381-387)

After plan completion, extensive interactive polish:

- **Recurrence card consolidation:** 4 components (SeriesDisplay, SeriesActions, SeriesTimeline, inline RecurrenceEditor) → 1 RecurrenceCard + modal editor. Timeline strip killed. 3 files deleted, net -31 lines.
- **Meeting Edit as modal:** Inline form expansion replaced with modal dialog. Context-aware fields (recurring meetings hide Date, show Reschedule affordance).
- **Reschedule merged into Edit:** Header simplified from Edit/Reschedule/Delete to Edit/Delete. Single entry point for all meeting-instance changes.
- **Scope-aware propagation fix:** Series root date changes now always propagate anchor_day to future meetings.
- **People page enrichment:** Partner badge enrichment from engagement_participants path. 143 previously invisible participants now show partner connections.
- **Duplicate participant merge:** 2 confirmed pairs merged (Jordan Spiers, Sebastien Ronzeaud). Reusable script created.
- **Defensive meeting_notes query:** .maybeSingle() → .order().limit(1) to prevent crash on duplicate rows. Data fix for Supabase meeting.
- **Recurring indicator prominence:** ↻ icon changed from muted gray to accent purple globally (4 pages).
- **interact.ts enhancement:** Added `select` action type for Playwright select option testing.

### Stats Change

| Metric | Before Plan 3 | After |
|--------|---------------|-------|
| Components | 35 | 37 (+5 new, -3 deleted) |
| Decisions | #373 | #387 |
| Tests | 444 | 444 |
| Pages | 13 | 13 |

### Pre-existing Issues Noted

- 58/80 program enrollments have null program_id (display works via program_name fallback)
- 5 null-email participants, 4 nameless participants
- 41 tasks without engagement_id
- Vasion duplicate series needs manual merge
- KnowBe4, NinjaOne, Cloudaware standalones should become series roots
- 11 orphaned participants (no partner or engagement links)
- meeting_notes needs UNIQUE constraint on meeting_id (migration required)
