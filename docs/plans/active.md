# Plan 5: Validation Centralization
**Created:** 2026-04-07
**Branch:** plan-5/validation-centralization
**Scope:** Deduplicate 7 duplicated VALID_* constants, create shared validation utilities, extract 2 repeated helper patterns, and normalize DELETE response shapes. Zero logic changes — purely structural cleanup that reduces duplication risk before the data layer centralization in Plan 6.

## Context
The codebase hygiene audit found 7 of 12 VALID_* constants duplicated across multiple route files (e.g., VALID_STATUSES defined separately in both engagements/route.ts and engagements/[id]/route.ts). Two are duplicated between sync/utils.ts and API routes, creating divergence risk between sync validation and API validation. Additionally, `resolvePartnerByName()` is an identical pattern copy-pasted across 3 route files, `cleanSubject()` in reviews/resolve overlaps with `cleanMeetingTitle` in format-utils.ts, and DELETE responses use inconsistent shapes ({status: "deleted"} vs {success: true}). This plan creates a single source of truth for all validation constants and shared helpers.

## Success Criteria
- Every VALID_* constant is defined exactly once and imported everywhere it's used
- A shared `validateEnum()` helper eliminates repeated inline validation formatting
- `resolvePartnerByName()` lives in the db layer (src/lib/db/partners.ts) and is imported by the 3 routes that need it
- `cleanSubject()` is merged into format-utils.ts
- All DELETE responses use a consistent shape
- Zero behavior changes — all existing validation logic works identically

## Phases
No phases needed — 5 focused tasks, each independently verifiable.

## Write Access Rules
- src/lib/validation.ts (new file)
- src/lib/db/partners.ts (add resolvePartnerByName)
- src/lib/format-utils.ts (add cleanSubject)
- src/lib/sync/utils.ts (imports change only)
- src/app/api/**/*.ts (imports change, constant removal, response normalization)
- All tasks: docs/ (if decisions arise)

## SKILL.md Evolution
- No SKILL.md changes expected — this is backend-only structural cleanup

## Verification Protocol (applies to ALL tasks)
After every task, before reporting done:
1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all tests pass (expected: 444)
3. If any validation behavior changed (it shouldn't): test the affected API route with a curl request
4. `git add -A && git commit -m "{type}: {description}"`

---

### Task 5.1 — Create validation.ts with all VALID_* constants

**Intent:** Establish a single source of truth for all validation constants so routes import rather than redefine them. Eliminates the risk of adding a status value in one file but missing it in another.

**Scope:** Create the new file and populate it. Do NOT update imports yet — that's Task 5.2.

**Pre-flight:**
- [ ] Read sync/utils.ts — identify which VALID_* constants live there and are used by both sync and API routes
- [ ] Grep for `VALID_` across all files in src/ — build the complete list of constants, their locations, and their values
- [ ] Confirm values match between duplicates (if they've diverged, flag it before proceeding)

**Implementation:**
Create `src/lib/validation.ts` with all 12 VALID_* constants:
- VALID_PROGRAM_CATEGORIES (from sync/utils.ts)
- VALID_PROGRAM_SUBTYPES (from sync/utils.ts)
- VALID_EVENT_TYPES (from sync/utils.ts)
- VALID_LIFECYCLE_TYPES (from sync/utils.ts)
- VALID_ENGAGEMENT_STATUSES (currently "VALID_STATUSES" in engagements/route.ts)
- VALID_ENGAGEMENT_PILLARS (currently "VALID_PILLARS" in engagements/route.ts)
- VALID_MEETING_STATUSES (currently "VALID_STATUSES" in meetings/route.ts)
- VALID_MEETING_TYPES (from meetings/route.ts)
- VALID_RECURRENCE_PATTERNS (from meetings/route.ts)
- VALID_EVENT_PARTICIPATION_STATUSES (from event-participations/route.ts)
- VALID_ENROLLMENT_STATUSES (from enrollments/route.ts)
- VALID_TASK_OWNERS (from notes/tasks/route.ts)
- VALID_SYNC_ENTITIES (from sync/route.ts)

Also add a `validateEnum()` helper:
```typescript
export function validateEnum(field: string, value: string, validSet: readonly string[]): string | null {
  if (!validSet.includes(value)) {
    return `${field} must be one of: ${validSet.join(", ")}`;
  }
  return null;
}
```

Disambiguate the name collisions: the 4 separate "VALID_STATUSES" become VALID_ENGAGEMENT_STATUSES, VALID_MEETING_STATUSES, VALID_EVENT_PARTICIPATION_STATUSES, VALID_ENROLLMENT_STATUSES.

For constants that already live in sync/utils.ts (VALID_PROGRAM_CATEGORIES, VALID_PROGRAM_SUBTYPES, VALID_EVENT_TYPES, VALID_LIFECYCLE_TYPES): move the canonical definition to validation.ts and have sync/utils.ts re-export from it — sync should not define its own copies.

**Verification (in addition to plan-level protocol):**
- [ ] `grep -r "VALID_" src/lib/validation.ts` shows all 12+ constants
- [ ] File has zero logic beyond the constants and validateEnum helper
- [ ] tsc clean (file compiles, nothing imports it yet — that's fine)

**Done when:** validation.ts exists with all constants and the validateEnum helper. No other files changed yet.

**Steven checkpoint:** STOP. Report the complete list of constants and whether any value divergences were found between duplicates. Wait for confirmation before Task 5.2.

---

### Task 5.2 — Update all route imports to use validation.ts

**Intent:** Replace every locally-defined VALID_* constant in API routes with an import from validation.ts. After this task, no route file defines its own validation constants.

**Scope:** API route files only. Do NOT change sync/utils.ts yet (Task 5.3). Do NOT change any validation logic — only where constants come from.

**Pre-flight:**
- [ ] List every file that defines a VALID_* constant locally (from Task 5.1 grep)
- [ ] For each, confirm the local values exactly match validation.ts values (Task 5.1 should have flagged divergences)

**Implementation:**
For each API route file that defines VALID_* constants:
1. Remove the local constant definition
2. Add import from `@/lib/validation`
3. Update references if the name changed (e.g., `VALID_STATUSES` → `VALID_ENGAGEMENT_STATUSES` in engagement routes)
4. Replace inline validation error formatting with `validateEnum()` where the pattern matches: `if (!VALID_X.includes(value)) return error`

Files to update (from audit):
- engagements/route.ts (VALID_STATUSES → VALID_ENGAGEMENT_STATUSES, VALID_PILLARS → VALID_ENGAGEMENT_PILLARS)
- engagements/[id]/route.ts (same)
- meetings/route.ts (VALID_STATUSES → VALID_MEETING_STATUSES, VALID_RECURRENCE_PATTERNS, VALID_MEETING_TYPES)
- meetings/[id]/route.ts (VALID_STATUSES → VALID_MEETING_STATUSES)
- programs/[id]/route.ts (VALID_PROGRAM_CATEGORIES)
- events/[id]/route.ts (VALID_EVENT_TYPES)
- partners/[id]/enrollments/route.ts (VALID_STATUSES → VALID_ENROLLMENT_STATUSES)
- partners/[id]/enrollments/[enrollmentId]/route.ts (same)
- partners/[id]/event-participations/route.ts (VALID_STATUSES → VALID_EVENT_PARTICIPATION_STATUSES)
- partners/[id]/event-participations/[participationId]/route.ts (same)
- notes/tasks/route.ts (VALID_OWNERS → VALID_TASK_OWNERS)
- sync/route.ts (VALID_ENTITIES → VALID_SYNC_ENTITIES)

**Verification (in addition to plan-level protocol):**
- [ ] `grep -rn "const VALID_" src/app/` returns zero hits (no locally-defined validation constants in any route)
- [ ] Every route that previously had a VALID_* constant now imports from @/lib/validation
- [ ] All validation error messages are unchanged (same user-facing strings)

**Done when:** Zero locally-defined VALID_* constants in any API route file. All imports point to validation.ts.

**Steven checkpoint:** STOP. Report how many files changed and confirm grep shows zero local VALID_ definitions in src/app/. Wait for confirmation.

---

### Task 5.3 — Migrate sync/utils.ts to re-export from validation.ts

**Intent:** sync/utils.ts currently defines VALID_PROGRAM_CATEGORIES, VALID_PROGRAM_SUBTYPES, VALID_EVENT_TYPES, VALID_LIFECYCLE_TYPES independently. These should come from validation.ts so there's truly one source of truth.

**Scope:** sync/utils.ts only. Make it import and re-export from validation.ts instead of defining its own copies.

**Pre-flight:**
- [ ] Read sync/utils.ts — identify what else it exports beyond the VALID_* constants (there may be sync-specific validation functions that should stay)
- [ ] Confirm pull.ts and push.ts import these constants from sync/utils.ts (they'll get them via re-export, no changes needed in pull/push)

**Implementation:**
In sync/utils.ts:
1. Remove the local VALID_PROGRAM_CATEGORIES, VALID_PROGRAM_SUBTYPES, VALID_EVENT_TYPES, VALID_LIFECYCLE_TYPES definitions
2. Add: `export { VALID_PROGRAM_CATEGORIES, VALID_PROGRAM_SUBTYPES, VALID_EVENT_TYPES, VALID_LIFECYCLE_TYPES } from "@/lib/validation";`
3. Keep any sync-specific functions that aren't validation constants

**Verification (in addition to plan-level protocol):**
- [ ] sync/utils.ts no longer defines these 4 constants — only re-exports them
- [ ] pull.ts and push.ts still compile and import correctly (they import from sync/utils, which now re-exports from validation.ts)
- [ ] `grep -rn "const VALID_" src/lib/sync/` returns zero hits

**Done when:** sync/utils.ts re-exports validation constants from the canonical source. Sync pipeline works identically.

**Steven checkpoint:** STOP. Confirm sync re-exports work. Wait for confirmation.

---

### Task 5.4 — Extract resolvePartnerByName and cleanSubject helpers

**Intent:** Two helper patterns are duplicated across routes. resolvePartnerByName (identical in 3 files) should live in db/partners.ts. cleanSubject (in reviews/resolve) overlaps with cleanMeetingTitle in format-utils.ts and should be consolidated.

**Scope:** Extract these 2 helpers. Do NOT refactor any other business logic in the routes.

**Pre-flight:**
- [ ] Read the 3 resolvePartnerByName implementations (meetings/route.ts, meetings/[id]/route.ts, engagements/[id]/route.ts) — confirm they're truly identical
- [ ] Read cleanSubject in reviews/resolve/route.ts and cleanMeetingTitle in format-utils.ts — identify overlap and differences

**Implementation:**

**resolvePartnerByName:**
Add to src/lib/db/partners.ts:
```typescript
export async function resolvePartnerByName(name: string): Promise<string | null> {
  // Case-insensitive partner name → id lookup
  // Return the partner UUID or null if not found
}
```
Use the exact query pattern from the existing inline implementations. Update the 3 route files to import and call this function instead of inline queries.

**cleanSubject:**
Add to src/lib/format-utils.ts (or extend cleanMeetingTitle if they do the same thing):
- If cleanSubject and cleanMeetingTitle are identical → just export cleanMeetingTitle and import it in reviews/resolve
- If they differ → add cleanSubject as a separate export and document the difference
Update reviews/resolve/route.ts to import from format-utils.ts instead of defining locally.

**Verification (in addition to plan-level protocol):**
- [ ] `grep -rn "resolvePartnerByName\|ilike.*partner_name\|\.eq.*name.*partner" src/app/` confirms no inline partner-name-to-id queries remain in route files
- [ ] cleanSubject no longer defined locally in reviews/resolve/route.ts
- [ ] The 3 routes that used inline partner resolution now call the db function

**Done when:** Both helpers extracted. Routes are shorter. Partner name resolution is centralized.

**Steven checkpoint:** STOP. Report what changed. Wait for confirmation.

---

### Task 5.5 — Normalize DELETE response shapes

**Intent:** DELETE responses use inconsistent shapes across routes: some return `{status: "deleted"}`, others `{success: true}`, others `{deleted: true}`. Normalize to a single pattern.

**Scope:** All DELETE handlers across API routes. Response shape only — do NOT change delete logic.

**Pre-flight:**
- [ ] Grep for all DELETE handlers and their return statements: `grep -A5 "case.*DELETE\|method.*DELETE\|async.*DELETE" src/app/api/`
- [ ] List every current DELETE response shape and which route uses it

**Implementation:**
Normalize all DELETE responses to: `{ deleted: true }` with status 200.

This is the simplest shape — a boolean confirmation. Update every DELETE handler to use this exact response. If any route currently returns additional data in the DELETE response (e.g., the deleted entity's ID), preserve that: `{ deleted: true, id: "..." }`.

**Verification (in addition to plan-level protocol):**
- [ ] Every DELETE handler returns `{ deleted: true }` (plus optional id)
- [ ] No DELETE handler returns `{status: "deleted"}` or `{success: true}`
- [ ] Frontend components that check DELETE responses still work (search for fetch + DELETE in components — verify they don't rely on the old shape)

**Done when:** All DELETE responses are consistent. Frontend handles them correctly.

**Steven checkpoint:** STOP. Report what changed. Show the before/after of each DELETE response shape. Wait for confirmation.

---

## Completion Summary
{Filled in after all tasks are done}

### Stats Change
| Metric | Before | After |
|--------|--------|-------|
| Duplicated VALID_* constants | 7 | 0 |
| Inline partner resolution queries | 3 | 0 |
| Inconsistent DELETE shapes | ~3 patterns | 1 pattern |
| New files | 0 | 1 (validation.ts) |

### Decisions Logged
{List decisions made during execution}

### Docs Updated
{List docs that need updating}