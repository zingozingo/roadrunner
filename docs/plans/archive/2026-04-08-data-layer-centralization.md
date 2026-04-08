# Plan 6: Data Layer Centralization
**Created:** 2026-04-08
**Branch:** plan-6/data-layer-centralization
**Scope:** Extract all ~90 direct supabase.from() queries outside src/lib/db/ (excluding sync/) into centralized db functions. Zero behavior changes — every query keeps doing exactly what it does today, just from the right place. This is the foundation that makes Plans 7-10 cleaner and enables the Roadrunner-standalone vision.

## Context
A codebase hygiene audit found 128 direct supabase.from() calls outside src/lib/db/. 38 are in sync/ (exempted — self-contained, eventually removed). The remaining 90 are scattered across 25 files: 84 in API routes, 8 in page files, and 36 in library files. The worst offenders are engagements/merge/route.ts (13 queries), notes-context.ts (10 queries), people/route.ts (8 queries), inbound/route.ts (7 queries), and meeting-recurrence.ts (6 queries). Additionally, 3 inline helpers were duplicated across routes (partner name resolution was extracted in Plan 5; remaining patterns will be caught here). After this plan, every supabase.from() call in the codebase lives in src/lib/db/ or src/lib/sync/ — nowhere else.

## Success Criteria
- `grep -rn "supabase\.\|getSupabaseClient\(\)" src/app/ src/lib/ --include="*.ts" | grep -v "node_modules" | grep -v "src/lib/db/" | grep -v "src/lib/sync/" | grep -v "src/lib/db.ts"` returns zero hits (no direct Supabase usage outside db/ and sync/)
- All 444 tests still pass
- All existing API behavior is identical — this is a move, not a rewrite
- New db functions are well-named, typed, and follow existing patterns in db/

## Phases
- **Phase 1 (Tasks 6.1–6.3):** Library files — notes-context.ts, meeting-recurrence.ts, brain-synthesizer.ts, classifier.ts. These are already in src/lib/ and the extractions are straightforward read/write wrappers.
- **Phase 2 (Tasks 6.4–6.7):** Heavy API routes — the 4 files with 5+ queries each. These require creating composite db functions that replace multiple sequential queries.
- **Phase 3 (Tasks 6.8–6.10):** Light API routes + page files — the remaining 1-4 query files. Smaller extractions, many can be grouped.

## Write Access Rules
- Phase 1: src/lib/db/ (new functions), src/lib/notes-context.ts, src/lib/meeting-recurrence.ts, src/lib/brain-synthesizer.ts, src/lib/classifier.ts
- Phase 2: src/lib/db/ (new functions), src/app/api/engagements/merge/, src/app/api/people/, src/app/api/inbound/, src/app/api/meetings/[id]/
- Phase 3: src/lib/db/ (new functions), remaining src/app/api/ routes, src/app/ page files
- All phases: docs/ (if decisions arise)

## SKILL.md Evolution
- No SKILL.md changes expected — this is backend-only structural cleanup

## Verification Protocol (applies to ALL tasks)
After every task, before reporting done:
1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all tests pass (expected: 444)
3. `grep -rn "supabase\.\|getSupabaseClient" {files-touched-in-this-task} | grep -v "src/lib/db/" | grep -v "src/lib/sync/"` — zero hits in the files you just changed (confirm queries were actually moved)
4. `git add -A && git commit -m "{type}: {description}"`

---

## Phase 1: Library Files

### Task 6.1 — Centralize notes-context.ts queries (10 queries)

**Intent:** notes-context.ts makes 10 direct Supabase queries to build AI context (partner data, engagement history, meeting summaries, notes). These should be db functions so the context builder works with clean data interfaces, not raw queries.

**Scope:** src/lib/notes-context.ts queries only. Do NOT change the context-building logic, prompt assembly, or AI call behavior.

**Pre-flight:**
- [ ] Read notes-context.ts end-to-end — identify every supabase.from() call, what table it hits, what columns it selects, and what the surrounding function uses the result for
- [ ] Check which of these queries overlap with existing db functions (e.g., does getPartner() already fetch what one of these queries fetches? Could it be reused?)
- [ ] Identify natural groupings — some queries might combine into a single db function that returns a composite object

**Implementation:**
For each direct query in notes-context.ts:
1. If an existing db function already returns the same data → replace the inline query with a call to that function
2. If no equivalent exists → create a new function in the appropriate db file (e.g., partner queries → db/partners.ts, engagement queries → db/engagements.ts, meeting queries → db/meetings.ts)
3. If multiple queries are always called together for the same purpose → consider a composite function (e.g., `getPartnerBrainContext(partnerId)` that returns partner + engagements + recent notes in one call)

Naming convention: follow existing patterns in db/. Read operations are `get*()` or `list*()`. The function name should describe what data comes back, not what it's used for.

Do NOT create a single monolithic `buildPartnerContextData()` in the db layer — that mixes data access with context-building concerns. Create focused data-fetching functions; notes-context.ts orchestrates them.

**Verification (in addition to plan-level protocol):**
- [ ] `grep -n "supabase\.\|getSupabaseClient\|\.from(" src/lib/notes-context.ts` returns zero hits
- [ ] notes-context.ts now imports only from src/lib/db/ for data access
- [ ] All existing AI context-building behavior is unchanged

**Done when:** notes-context.ts has zero direct Supabase queries. All data access goes through db functions.

**Steven checkpoint:** STOP. Report which db functions were created (new) vs reused (existing). Show the query count reduction. Wait for confirmation.

---

### Task 6.2 — Centralize meeting-recurrence.ts queries (6 queries)

**Intent:** meeting-recurrence.ts makes 6 direct queries for recurring meeting operations (past occurrences, future siblings, root anchor, insert new occurrence, copy participants). These should be db functions.

**Scope:** src/lib/meeting-recurrence.ts queries only. Do NOT change recurrence calculation logic (calculateNextDate, snapToAnchor, etc.).

**Pre-flight:**
- [ ] Read meeting-recurrence.ts — identify every supabase.from() call
- [ ] Check which overlap with existing db/meetings.ts functions (e.g., getSeriesSiblings already exists)
- [ ] Check if any of the insert/copy operations have equivalents in db/meetings.ts or db/participants.ts

**Implementation:**
For each direct query:
1. Reuse existing db function if it returns the same data
2. Create new db function if needed — likely in db/meetings.ts for meeting queries, db/participants.ts for participant copy
3. The "insert new occurrence" query may overlap with createMeeting() — check if createMeeting can be called instead, or if the recurrence path needs a slimmer variant

**Verification (in addition to plan-level protocol):**
- [ ] `grep -n "supabase\.\|getSupabaseClient\|\.from(" src/lib/meeting-recurrence.ts` returns zero hits
- [ ] Recurrence spawn still works: meeting-recurrence.ts imports db functions, calculates dates, calls db to insert

**Done when:** meeting-recurrence.ts has zero direct Supabase queries.

**Steven checkpoint:** STOP. Report changes. Wait for confirmation.

---

### Task 6.3 — Centralize brain-synthesizer.ts and classifier.ts queries (4 queries)

**Intent:** brain-synthesizer.ts (2 queries: delete + insert partner_context) and classifier.ts (2 queries: stamp classification on messages, update engagement) have small numbers of direct queries that should go through the db layer.

**Scope:** These 2 files only. Do NOT change AI synthesis or classification logic.

**Pre-flight:**
- [ ] Read both files — identify the 4 queries
- [ ] Check if db/partner-context.ts already has delete/insert functions that can be reused
- [ ] Check if db/engagements.ts updateEngagement() and db/messages.ts have equivalents

**Implementation:**
- brain-synthesizer.ts: the delete+insert pattern for partner_context with source='ai_synthesis' → create `replacePartnerSynthesis(partnerId, text)` in db/partner-context.ts (or use existing functions if they support the source filter)
- classifier.ts: stamp classification → likely a new `stampMessageClassification(messageId, data)` in db/messages.ts; update engagement → reuse updateEngagement() from db/engagements.ts

**Verification (in addition to plan-level protocol):**
- [ ] `grep -n "supabase\.\|getSupabaseClient\|\.from(" src/lib/brain-synthesizer.ts src/lib/classifier.ts` returns zero hits

**Done when:** Both files have zero direct Supabase queries.

**Steven checkpoint:** STOP. Report changes. Wait for confirmation before Phase 2.

---

## Phase 2: Heavy API Routes

### Task 6.4 — Centralize engagements/merge/route.ts queries (13 queries)

**Intent:** The merge route has 13 direct queries spanning 7 tables — the highest concentration in the codebase. These need to move to db functions, making the route readable and the merge logic testable.

**Scope:** engagements/merge/route.ts queries only. Do NOT change merge business logic or the order of operations. The route should still orchestrate the steps — it just calls db functions instead of raw queries.

**Pre-flight:**
- [ ] Read engagements/merge/route.ts — list every supabase.from() call with table, operation, and purpose
- [ ] Map each to existing db functions or identify new ones needed
- [ ] Check which operations are simple (single table update) vs compound (fetch + loop + upsert)

**Implementation:**
Create focused db functions for operations that don't already exist. Likely new functions:
- `reparentMessagesToEngagement(fromEngId, toEngId)` in db/engagements.ts or db/messages.ts
- `reparentMeetingsToEngagement(fromEngId, toEngId)` in db/meetings.ts
- `reparentNotesToEngagement(fromEngId, toEngId)` in db/meeting-notes.ts
- `reparentTasksToEngagement(fromEngId, toEngId)` in db/meeting-notes.ts
- `mergeEngagementParticipants(fromEngId, toEngId)` in db/participants.ts
- Reuse existing: getEngagementById(), deleteEngagement(), updateEngagement(), getMessagesByEngagement()

The route should read like a step-by-step recipe after this: fetch both → validate → reparent messages → reparent meetings → reparent notes → reparent tasks → merge participants → enrich → delete source → re-synthesize → push.

**Verification (in addition to plan-level protocol):**
- [ ] `grep -n "supabase\.\|getSupabaseClient\|\.from(" src/app/api/engagements/merge/route.ts` returns zero hits
- [ ] The merge route is significantly shorter (expect ~80-100 lines of db function calls vs 215 lines of inline queries)

**Done when:** engagements/merge/route.ts has zero direct Supabase queries.

**Steven checkpoint:** STOP. Report new db functions created. Show before/after line count. Wait for confirmation.

---

### Task 6.5 — Centralize people/route.ts queries (8 queries)

**Intent:** The people API route has 8 direct queries for participant management (fetch partner participants, fetch engagement participants with enrichment, duplicate check, insert, link to partner). These should be db functions in participants.ts.

**Scope:** people/route.ts queries only.

**Pre-flight:**
- [ ] Read people/route.ts — list every query
- [ ] Check db/participants.ts for existing functions that overlap
- [ ] Note the enrichment joins (engagement participants need engagement names, partner names) — these may need new composite queries

**Implementation:**
Create db functions for each operation that doesn't already exist. Likely:
- `getPartnerParticipantsWithDetails(partnerId)` — partner contacts with enrichment
- `getEngagementParticipantsWithDetails(partnerId)` — engagement participants with engagement/partner names
- `checkDuplicateParticipantEmail(email)` — dedup check
- `createParticipantAndLinkToPartner(data, partnerId, role)` — create + link in one call
- Reuse existing functions where possible

**Verification (in addition to plan-level protocol):**
- [ ] `grep -n "supabase\.\|getSupabaseClient\|\.from(" src/app/api/people/route.ts` returns zero hits

**Done when:** people/route.ts has zero direct Supabase queries.

**Steven checkpoint:** STOP. Report changes. Wait for confirmation.

---

### Task 6.6 — Centralize inbound/route.ts queries (7 queries)

**Intent:** The inbound email route has 7 direct queries for partner stamping on messages and meetings. These should be db functions.

**Scope:** inbound/route.ts queries only. Do NOT change email parsing, signature verification, or ICS extraction logic.

**Pre-flight:**
- [ ] Read inbound/route.ts — identify the 7 direct queries
- [ ] Check if db/inbox.ts setPartnerForInboxGroup() or db/messages.ts already handle partner stamping
- [ ] Note which queries are for messages vs meetings — they may go to different db files

**Implementation:**
Create db functions for partner stamping operations:
- `stampPartnerOnMessages(messageIds, partnerId)` in db/messages.ts
- `stampPartnerOnMeetings(meetingIds, partnerId)` in db/meetings.ts  
- `getPartnerNameById(partnerId)` in db/partners.ts (if not already available via getPartner)
- `checkMeetingHasPartner(meetingId)` in db/meetings.ts
- Reuse existing functions where possible

**Verification (in addition to plan-level protocol):**
- [ ] `grep -n "supabase\.\|getSupabaseClient\|\.from(" src/app/api/inbound/route.ts` returns zero hits

**Done when:** inbound/route.ts has zero direct Supabase queries.

**Steven checkpoint:** STOP. Report changes. Wait for confirmation.

---

### Task 6.7 — Centralize meetings/[id]/route.ts queries (3 queries)

**Intent:** The meeting detail route has 3 remaining direct queries: partner name resolution (already extracted in Plan 5 — verify it's gone), get future series meetings, check which have notes.

**Scope:** meetings/[id]/route.ts queries only.

**Pre-flight:**
- [ ] Read meetings/[id]/route.ts — identify remaining direct queries (Plan 5 should have already extracted resolvePartnerByName — confirm)
- [ ] Check if getSeriesSiblings() in db/meetings.ts covers the "future series meetings" query
- [ ] Check if getMeetingNoteByMeetingId() covers the "check which have notes" query

**Implementation:**
For each remaining query:
1. If an existing db function covers it → use it
2. If not → create a minimal new function (e.g., `getFutureSeriesMeetings(seriesId, afterDate)` in db/meetings.ts, `getMeetingIdsWithNotes(meetingIds)` in db/meeting-notes.ts)

**Verification (in addition to plan-level protocol):**
- [ ] `grep -n "supabase\.\|getSupabaseClient\|\.from(" src/app/api/meetings/*/route.ts` returns zero hits

**Done when:** meetings/[id]/route.ts has zero direct Supabase queries.

**Steven checkpoint:** STOP. Report changes. Wait for confirmation before Phase 3.

---

## Phase 3: Light Routes + Page Files

### Task 6.8 — Centralize remaining light API routes (~20 queries, ~10 files)

**Intent:** The remaining API route files each have 1-4 direct queries. These are small extractions that can be done as a batch.

**Scope:** All remaining API route files with direct Supabase queries. This includes:
- partners/[id]/route.ts (4 queries)
- reviews/resolve/route.ts (4 queries — partner name fetch, engagement fetch, message linking ×2)
- inbox/redetect/route.ts (3 queries)
- partners/[id]/enrollments/[enrollmentId]/route.ts (2 queries)
- partners/[id]/event-participations/[participationId]/route.ts (2 queries)
- engagements/[id]/route.ts (1 query — verify Plan 5 extracted partner resolution)
- inbox/set-partner/route.ts (1 query)
- meetings/route.ts (1 query — verify Plan 5 extracted partner resolution)
- notes/tasks/route.ts (1 query)
- notes/[id]/summarize/route.ts (1 query)
- partners/[id]/enrollments/route.ts (1 query)
- partners/[id]/event-participations/route.ts (1 query)

**Pre-flight:**
- [ ] For each file: read it, identify the direct queries, check for existing db equivalents
- [ ] Group by db module — enrollment CRUD goes to a new or existing db file, event participation CRUD similarly
- [ ] Note: enrollment and event participation CRUD functions will be needed for Phase 2 (Roadrunner ownership flip) — designing them well now pays off later

**Implementation:**
Create db functions as needed. Key new functions likely include:
- `createPartnerProgramEnrollment(data)`, `updatePartnerProgramEnrollment(id, data)`, `deletePartnerProgramEnrollment(id)` in db/ring3.ts (or a new db/enrollments.ts)
- `createPartnerEventParticipation(data)`, `updatePartnerEventParticipation(id, data)`, `deletePartnerEventParticipation(id)` in db/ring3.ts
- `linkMessagesToEngagement(messageIds, engagementId)` in db/messages.ts
- `getUnroutedMessages()` in db/messages.ts or db/inbox.ts
- `resolveEngagementIdFromMeeting(meetingId)` in db/meetings.ts
- `createTask(data)` — may already exist in db/meeting-notes.ts
- `validatePartnerExists(partnerId)` in db/partners.ts

For files where Plan 5 already extracted the partner resolution (engagements/[id], meetings/route.ts), confirm zero queries remain.

**Verification (in addition to plan-level protocol):**
- [ ] `grep -rn "supabase\.\|getSupabaseClient\|\.from(" src/app/api/ | grep -v "src/lib/db/" | grep -v "src/lib/sync/"` returns zero hits across ALL API routes
- [ ] Every new CRUD function for enrollments and event participations is cleanly typed and ready for future UI consumption

**Done when:** Zero direct Supabase queries in any API route file.

**Steven checkpoint:** STOP. Report all new db functions created across this task. Confirm the full API route grep is clean. Wait for confirmation.

---

### Task 6.9 — Centralize page file queries (8 queries, 4 files)

**Intent:** Four page files (server components) have direct Supabase queries for data fetching. These should go through the db layer.

**Scope:** 
- partners/[id]/page.tsx (4 queries: engagements by partner, meeting titles for tasks, engagement names for tasks, plus any other partner detail data)
- meetings/[id]/page.tsx (2 queries: previous notes tier 1 same-engagement, tier 2 same-series)
- page.tsx / Today (1 query: series root anchor_days)
- engagements/[id]/page.tsx (1 query: meeting note condensed summaries)

**Pre-flight:**
- [ ] Read each page file — identify the direct queries
- [ ] Check for existing db functions that return the same data
- [ ] Note: partners/[id]/page.tsx is 823 lines — do NOT refactor the page itself, only extract its queries

**Implementation:**
Create db functions:
- `getEngagementsByPartner(partnerId)` in db/engagements.ts (may already exist)
- `getMeetingTitlesForTasks(taskIds)` in db/meetings.ts or db/meeting-notes.ts
- `getEngagementNamesForTasks(taskIds)` in db/engagements.ts
- `getPreviousNotesForMeeting(meetingId, engagementId?, seriesId?)` in db/meeting-notes.ts
- `getSeriesRootAnchorDays(rootIds)` in db/meetings.ts
- `getMeetingNoteSummariesForEngagement(engagementId)` in db/meeting-notes.ts

**Verification (in addition to plan-level protocol):**
- [ ] `grep -rn "supabase\.\|getSupabaseClient\|\.from(" src/app/**/page.tsx | grep -v "src/lib/db/"` returns zero hits
- [ ] All pages render identically — no visual changes

**Done when:** Zero direct Supabase queries in any page file.

**Steven checkpoint:** STOP. Report changes. Wait for confirmation.

---

### Task 6.10 — Final sweep + documentation

**Intent:** Verify zero rogue queries remain anywhere outside db/ and sync/. Update documentation to reflect the new architecture.

**Scope:** Verification + docs only. No new code unless the sweep finds something missed.

**Pre-flight:**
- [ ] Run the full success criteria grep: `grep -rn "supabase\.\|getSupabaseClient\(\)" src/app/ src/lib/ --include="*.ts" | grep -v "node_modules" | grep -v "src/lib/db/" | grep -v "src/lib/sync/" | grep -v "src/lib/db.ts"`
- [ ] If any hits remain, extract them before proceeding to docs

**Implementation:**
1. Fix any remaining rogue queries found in the sweep
2. Update CLAUDE.md: add a note in the architecture section that all Supabase queries live in src/lib/db/ (except sync/), and that this is a project rule going forward
3. Update goal-state.md: mark Plan 6 as completed, update stats
4. Count final db function inventory — how many exported functions now vs the 88 at plan start?

**Verification (in addition to plan-level protocol):**
- [ ] The full success criteria grep returns zero hits
- [ ] Documentation is updated
- [ ] `npx tsc --noEmit` clean
- [ ] All 444 tests pass

**Done when:** Zero rogue queries confirmed. Documentation reflects the new architecture rule. Plan 6 is complete.

**Steven checkpoint:** STOP. Report final stats: rogue queries before (90) vs after (0), db functions before (88) vs after, files changed total. Wait for confirmation.

---

## Completion Summary

All 10 tasks completed across 3 phases. Every direct `supabase.from()` call outside `src/lib/db/` and `src/lib/sync/` has been extracted into typed, centralized db functions. Zero behavior changes — all 444 tests pass unchanged. The db layer grew from 114 to 160 exported functions (+46 new). This establishes the foundation for services layer extraction (Plan 7) and the Airtable-removable-plug vision.

The original audit estimated 90 rogue queries. Reconciliation found 82 actual `.from()` queries pre-Plan-5 (the estimate overcounted import and setup lines). Plan 5 extracted 3, Plan 6 extracted the remaining 79. Final verified: zero rogue queries.

### Stats Change
| Metric | Before | After |
|--------|--------|-------|
| Rogue queries outside db/sync | 79 (82 pre-Plan-5) | 0 |
| Exported db functions | 114 | 160 (+46) |
| Files with direct Supabase access outside db/sync | 23 | 0 |
| CreateTaskInput.meeting_note_id | `string` (required) | `string \| null` (nullable) |

### Decisions Logged
- #430 — Data layer centralization: all Supabase queries in src/lib/db/ (project rule)
- #431 — Composite db functions for multi-table operations

### Docs Updated
- CLAUDE.md — db-only query rule in API Route Patterns and What NOT to Do, stats updated
- goal-state.md — Plan 6 completion, stats, What's Next updated
- decisions.md — #430-#431 appended