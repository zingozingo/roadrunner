# Plan 7: Services Layer Extraction
**Created:** 2026-04-08
**Branch:** plan-7/services-layer
**Scope:** Extract ~530 lines of business logic from 4 oversized API routes into dedicated service files. Routes become thin validation+response wrappers. Zero behavior changes — same logic, better organization. This completes Phase 1 (structural integrity) of the Roadrunner architecture vision.

## Context
Plan 6 centralized all database queries into src/lib/db/. The 4 largest API routes are now readable sequences of db function calls, but they still contain business logic that doesn't belong in route handlers: email processing pipelines, recurrence propagation, inbox resolution orchestration, and engagement merge coordination. This plan extracts that logic into src/lib/ service files, making routes thin (~60-130 lines each) and the business logic independently testable. Post-Plan-7, the architecture has clean layers: UI → thin API routes → service functions → db layer → Supabase.

## Success Criteria
- inbound/route.ts drops from 464 → ~120 lines
- meetings/[id]/route.ts drops from 218 → ~130 lines
- reviews/resolve/route.ts drops from 191 → ~60 lines
- engagements/merge/route.ts drops from 171 → ~70 lines
- 4 new/extended service files contain the extracted logic
- All 444 tests still pass
- All existing API behavior is identical

## Phases
No phases — 5 tasks, ordered by size (biggest extraction first). Each independently deployable.

## Write Access Rules
- src/lib/inbound-pipeline.ts (new)
- src/lib/inbox-resolver.ts (new)
- src/lib/engagement-merge.ts (new)
- src/lib/meeting-recurrence.ts (extend with propagation logic)
- src/app/api/inbound/route.ts
- src/app/api/meetings/[id]/route.ts
- src/app/api/reviews/resolve/route.ts
- src/app/api/engagements/merge/route.ts
- All tasks: docs/ (if decisions arise)

## SKILL.md Evolution
- No SKILL.md changes expected — this is backend-only structural cleanup

## Verification Protocol (applies to ALL tasks)
After every task, before reporting done:
1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all tests pass (expected: 444)
3. Verify the route file line count dropped as expected
4. Verify the service file is well-structured: exported function(s) at top, private helpers below, clear types for inputs/outputs
5. `git add -A && git commit -m "{type}: {description}"`

---

### Task 7.1 — Extract inbound email pipeline (464 → ~120 lines)

**Intent:** The inbound route is the largest file in the codebase at 464 lines. ~350 lines are a monolithic email processing pipeline (parse forwarder, resolve names, store messages, detect partner, extract ICS, create meeting, backfill partner). This is a single coherent pipeline that belongs in its own service file.

**Scope:** Extract the email processing pipeline from inbound/route.ts into src/lib/inbound-pipeline.ts. The route keeps: form field extraction from the HTTP request, signature verification gate, replay protection, and response formatting. Everything from "I have the Mailgun fields" through "messages stored + partner detected + meeting created" moves to the service.

**Pre-flight:**
- [ ] Read inbound/route.ts lines 225-446 — this is the SERVICE block range identified in the diagnostic
- [ ] Identify every import the pipeline logic needs (db functions, parsers, utils)
- [ ] Identify what data the pipeline needs as input (the extracted Mailgun fields) and what it returns (stored count, detected partner, meeting created, etc.)
- [ ] Check: do verifyMailgunSignature, extractFormFields, and selectEmailBody need to move too? They're helper functions defined at the top of the route file. If they're only used by this route, they should move with the pipeline.

**Implementation:**
Create `src/lib/inbound-pipeline.ts`:

```typescript
// Input: the parsed Mailgun fields (from, to, subject, body variants, attachments, signature fields)
// Output: { stored: number, partnerDetected: string | null, meetingCreated: boolean, errors: string[] }

export async function processInboundEmail(fields: InboundEmailFields): Promise<InboundResult> {
  // 1. Select email body (stripped-text vs body-plain heuristics)
  // 2. Parse forwarded email chain
  // 3. Stamp forwarder identity, strip PRVS
  // 4. Build name resolution map, resolve sender names
  // 5. Store messages
  // 6. Partner detection (domain match + subject fallback)
  // 7. ICS extraction + meeting creation (3-path: body-calendar, body-plain inline, attachment)
  // 8. Partner-meeting backfill (cross-stamp)
  // Return results
}
```

Move the 3 helper functions (verifyMailgunSignature, extractFormFields, selectEmailBody) into the service file as private (non-exported) functions — they're implementation details of the pipeline.

The route becomes:
```typescript
export async function POST(req: Request) {
  // 1. Extract form fields from request (~20 lines)
  // 2. Signature verification + replay protection (~40 lines)
  // 3. Call processInboundEmail(fields) (~5 lines)
  // 4. Build response (~10 lines)
}
```

Define `InboundEmailFields` and `InboundResult` types — either in the service file or in types.ts if they'll be reused.

**Verification (in addition to plan-level protocol):**
- [ ] inbound/route.ts is ~120 lines or less
- [ ] inbound-pipeline.ts contains processInboundEmail() as the single exported function
- [ ] The 3 helper functions (verify, extract, selectBody) are in the pipeline file, not exported
- [ ] Route has zero business logic — it's request parsing → service call → response

**Done when:** inbound/route.ts is a thin wrapper. All email processing logic lives in inbound-pipeline.ts.

**Steven checkpoint:** STOP. Report before/after line counts for the route. Show the service file's export surface. Wait for confirmation.

---

### Task 7.2 — Extract inbox resolution orchestration (191 → ~60 lines)

**Intent:** The reviews/resolve route has two branches (create_new and assign_existing) that share ~80% of their logic: build Phase1 synthetic result → run AI synthesis → persist classification → link meetings → push to Airtable. This duplication should be a shared service function.

**Scope:** Extract the create_new and assign_existing orchestration into src/lib/inbox-resolver.ts. The route keeps: input validation, action branching (discard/create/assign), and response formatting.

**Pre-flight:**
- [ ] Read reviews/resolve/route.ts lines 61-176 — the two SERVICE blocks
- [ ] Map exactly which lines are shared between create_new and assign_existing vs unique to each
- [ ] Identify the shared pattern: both do synthesis → persist → link meetings → AT push
- [ ] Check what buildSyntheticPhase1Result and synthesizeIntoEngagement expect as inputs

**Implementation:**
Create `src/lib/inbox-resolver.ts`:

```typescript
// Shared orchestration for inbox resolution
export async function resolveInboxToEngagement(params: {
  messages: Message[];
  engagement: Engagement;  // either newly created or existing
  partnerId: string;
  partnerName: string;
  forwarderNote?: string;
  isNew: boolean;  // controls whether to merge or replace current_state
}): Promise<ResolvedEngagement> {
  // 1. Build synthetic Phase1 result
  // 2. Run AI synthesis (synthesizeIntoEngagement)
  // 3. Persist classification result (or manual fallback)
  // 4. Link meetings to engagement
  // 5. Push engagement to Airtable
  // Return the updated engagement
}
```

The two branches become:
- create_new: `createEngagement()` → `resolveInboxToEngagement({ ...params, isNew: true })`
- assign_existing: `getEngagementById()` → validate partner match → `resolveInboxToEngagement({ ...params, isNew: false })`

The route becomes:
```typescript
export async function POST(req: Request) {
  // 1. Validate input (~10 lines)
  // 2. Fetch messages + partner name (~10 lines)
  // 3. Branch on action:
  //    - discard: discardInboxItem() + return (~3 lines)
  //    - create_new: createEngagement() + resolveInboxToEngagement() + return (~10 lines)
  //    - assign_existing: fetch + validate + resolveInboxToEngagement() + return (~15 lines)
  // 4. Error handling (~5 lines)
}
```

**Verification (in addition to plan-level protocol):**
- [ ] reviews/resolve/route.ts is ~60 lines or less
- [ ] inbox-resolver.ts has one exported function
- [ ] The duplicated synthesis+persist+link+push pattern exists exactly once (in the service), not twice (in the route)

**Done when:** reviews/resolve/route.ts is a thin branching dispatcher. Shared resolution logic lives in inbox-resolver.ts.

**Steven checkpoint:** STOP. Report before/after line counts. Confirm the duplication between create_new and assign_existing is eliminated. Wait for confirmation.

---

### Task 7.3 — Extract engagement merge pipeline (171 → ~70 lines)

**Intent:** The merge route orchestrates a multi-step pipeline: reparent entities → delete source from AT → enrich target → delete source from DB → re-synthesize → push to AT. This is a single coherent operation that should be callable from one function.

**Scope:** Extract the merge pipeline into src/lib/engagement-merge.ts. The route keeps: input validation, fetch both engagements, same-partner guard, and response formatting.

**Pre-flight:**
- [ ] Read engagements/merge/route.ts lines 67-147 — the SERVICE blocks
- [ ] Identify what the merge function needs as input (source and target engagement objects) and what it returns (the merged engagement + counts of moved entities)
- [ ] Check: does the re-synthesis block reuse the same pattern as inbox resolution? If so, note it but don't abstract further — keep each service file self-contained for now

**Implementation:**
Create `src/lib/engagement-merge.ts`:

```typescript
export async function mergeEngagements(
  source: Engagement,
  target: Engagement
): Promise<MergeResult> {
  // 1. Reparent messages, meetings, notes, tasks from source → target
  // 2. Merge participants (deduplicate)
  // 3. Delete source from Airtable (if it has an AT record)
  // 4. Enrich target's current_state with source's content
  // 5. Delete source engagement from DB
  // 6. Re-synthesize target (fetch messages → build Phase1 → synthesize → persist)
  // 7. Push merged target to Airtable
  // Return { engagement, moved: { messages, meetings, notes, tasks, participants } }
}
```

The route becomes:
```typescript
export async function POST(req: Request) {
  // 1. Validate sourceId + targetId (~5 lines)
  // 2. Fetch both engagements (~5 lines)
  // 3. Validate same partner + both exist (~15 lines)
  // 4. Call mergeEngagements(source, target) (~3 lines)
  // 5. Fetch updated target, build response (~10 lines)
}
```

**Verification (in addition to plan-level protocol):**
- [ ] engagements/merge/route.ts is ~70 lines or less
- [ ] engagement-merge.ts has one exported function: mergeEngagements()
- [ ] The route has zero orchestration logic — just validate → merge → respond

**Done when:** engagements/merge/route.ts is a thin wrapper. All merge orchestration lives in engagement-merge.ts.

**Steven checkpoint:** STOP. Report before/after line counts. Wait for confirmation.

---

### Task 7.4 — Extract meeting recurrence propagation (218 → ~130 lines)

**Intent:** The meetings/[id] PUT handler has a ~50-line block (lines 100-149) that propagates changes to future meetings in a recurrence series. This is complex business logic (fetch future siblings, check which have notes, recalculate dates, cascade updates) that belongs in the recurrence module, not a route handler. There's also a ~30-line engagement side-effects block that handles AT push and task cascade.

**Scope:** Extract the propagation block into meeting-recurrence.ts (which already exists with recurrence calculation logic). Optionally extract the engagement side-effects block if it's cleanly separable. The route keeps: GET handler, input validation, field building, DELETE handler, and response formatting.

**Pre-flight:**
- [ ] Read meetings/[id]/route.ts lines 100-179 — the SERVICE blocks
- [ ] Read meeting-recurrence.ts — understand the existing exports and where propagation logic fits
- [ ] Check: does propagateRecurrenceChange need access to the "updates" object built by the route? If so, define a clean interface for what gets passed in

**Implementation:**
Add to `src/lib/meeting-recurrence.ts`:

```typescript
export async function propagateRecurrenceChange(params: {
  meetingId: string;
  existing: Meeting;
  updates: Partial<Meeting>;
  recurrencePattern?: string;
  anchorDay?: string;
  recurrenceEnd?: string;
}): Promise<{ updatedCount: number }> {
  // 1. Get future meetings in series (excluding current)
  // 2. Check which have notes (skip those — user has customized them)
  // 3. Recalculate dates based on new anchor/pattern
  // 4. Cascade field updates to eligible future meetings
  // 5. Push each updated meeting to Airtable
  // Return count of updated meetings
}
```

For the engagement side-effects block (AT push + task cascade when engagement_id changes), either:
- Extract as `handleEngagementLinkChange(meetingId, newEngId, oldEngId)` in the same file
- Or leave it inline if it's only 10-15 lines — not worth a function for that little

Use judgment based on what the code looks like post-Plan-6. If it's already clean and short, leave it.

**Verification (in addition to plan-level protocol):**
- [ ] meetings/[id]/route.ts is ~130 lines or less
- [ ] The propagation logic lives in meeting-recurrence.ts alongside the existing recurrence functions
- [ ] The route's PUT handler reads as: validate → build updates → updateMeeting → propagate if series → side effects → respond

**Done when:** meetings/[id]/route.ts has no complex business logic blocks. Propagation lives with recurrence logic.

**Steven checkpoint:** STOP. Report before/after line counts. Wait for confirmation.

---

### Task 7.5 — Final verification + documentation

**Intent:** Verify all 4 routes are thin, all service files are well-structured, and documentation reflects the new architecture.

**Scope:** Verification + docs only. No new code unless issues are found.

**Pre-flight:**
- [ ] Get line counts for all 4 routes and all service files
- [ ] Verify no route has business logic beyond validation + service call + response

**Implementation:**
1. Run line counts on all 4 routes — confirm they meet targets:
   - inbound: ≤120
   - meetings/[id]: ≤130
   - reviews/resolve: ≤60
   - engagements/merge: ≤70
2. Run line counts on service files — document them
3. Verify each route follows the pattern: validate input → call service → format response
4. Update CLAUDE.md:
   - Add service files to the architecture section
   - Document the rule: "API routes are thin wrappers. Business logic lives in src/lib/ service files."
   - Update file inventory
5. Update goal-state.md: mark Plan 7 as completed, update any relevant stats
6. Move plan to docs/plans/archive/

**Verification (in addition to plan-level protocol):**
- [ ] All 4 routes meet line count targets
- [ ] Documentation reflects the three-layer architecture (routes → services → db)
- [ ] tsc clean, 444 tests passing

**Done when:** Phase 1 is complete. The codebase has clean architectural layers. Documentation is current.

**Steven checkpoint:** STOP. Report final stats: route line counts before/after, service file sizes, total lines moved. This is the Phase 1 completion checkpoint.

---

## Completion Summary

Plan 7 extracted business logic from the 4 largest API routes into dedicated service files, completing the three-layer architecture: UI → thin API routes → service functions → db layer → Supabase. All 444 tests pass. Zero behavior changes — purely structural refactoring.

### Stats Change
| Metric | Before | After |
|--------|--------|-------|
| inbound/route.ts | 464 lines | 205 lines |
| meetings/[id]/route.ts | 219 lines | 185 lines |
| reviews/resolve/route.ts | 192 lines | 114 lines |
| engagements/merge/route.ts | 172 lines | 65 lines |
| New/extended service files | 0 | 4 |
| inbound-pipeline.ts | — | 318 lines |
| inbox-resolver.ts | — | 81 lines |
| engagement-merge.ts | — | 138 lines |
| meeting-recurrence.ts | 196 lines | 256 lines |

Route targets vs actuals: inbound (120 target, 205 actual — keeps 2 HTTP/security helpers), reviews/resolve (60 target, 114 actual — keeps validation for 3 action branches), merge (70 target, 65 actual), meetings/[id] (130 target, 185 actual — has 3 HTTP handlers, only PUT was extractable). All routes have zero business logic — purely validation → delegate → respond.

### Decisions Logged
No new decisions — this was a structural refactoring with no architectural changes.

### Docs Updated
- CLAUDE.md: three-layer architecture rule, service files in directory structure and file quick reference, updated test count
- goal-state.md: Plan 7 marked complete