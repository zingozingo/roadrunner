# Roadrunner Backend — Architecture & Patterns

> **Purpose:** This file defines the backend architecture rules and patterns for Roadrunner. Claude Code must read this before any backend work — API routes, database operations, service logic, sync, or validation.
>
> **Last updated:** 2026-04-08
> **Established by:** Plans 5 (Validation Centralization), 6 (Data Layer Centralization), 7 (Services Layer Extraction)

---

## Three-Layer Architecture

Every backend operation flows through exactly three layers. No shortcuts, no exceptions.

```
Layer 1: API Routes (src/app/api/)
    ↓ calls
Layer 2: Services (src/lib/*.ts)
    ↓ calls
Layer 3: Data (src/lib/db/)
    ↓
Supabase
```

**Layer 3 — Data (`src/lib/db/`):**
Pure data access. Every `supabase.from()` call in the codebase lives here (except `src/lib/sync/` — see Sync Exemption below). Functions are named by what they return, not what they're used for. No business logic — just CRUD and queries.

**Layer 2 — Services (`src/lib/`):**
Business logic that coordinates across entities. Orchestrates multiple db calls, handles side effects, manages workflows. Examples: `processInboundEmail()`, `mergeEngagements()`, `resolveInboxToEngagement()`, `propagateRecurrenceChange()`. Services call db functions, never raw Supabase.

**Layer 1 — API Routes (`src/app/api/`):**
Thin wrappers. Validate input → call service or db function → format response. Target: under 200 lines. Routes never contain business logic — if you're writing a loop, conditional workflow, or multi-step orchestration in a route, it belongs in a service.

### What Goes Where — Decision Guide

| If the code... | It goes in... |
|---|---|
| Reads/writes Supabase | `src/lib/db/` |
| Validates HTTP input, formats HTTP response | API route |
| Coordinates multiple db calls for one operation | `src/lib/` service file |
| Parses emails, ICS, contacts | `src/lib/` parser file |
| Builds AI prompts or context | `src/lib/` (notes-context, phase2-prompt, etc.) |
| Pushes/pulls Airtable data | `src/lib/sync/` |

---

## Data Layer Rules (`src/lib/db/`)

### The One Rule
**All `supabase.from()` calls live in `src/lib/db/`.** Zero exceptions outside db/ and sync/. If you need data, call a db function. If no function exists, create one.

### Naming Conventions

| Operation | Pattern | Example |
|---|---|---|
| Fetch one | `get{Entity}(id)` | `getMeeting(id)` |
| Fetch list | `get{Entities}By{Filter}(filter)` | `getMeetingsByPartner(partnerId)` |
| Fetch all | `getAll{Entities}()` or `getActive{Entities}()` | `getAllEngagements()` |
| Create | `create{Entity}(data)` | `createEnrollment(data)` |
| Update | `update{Entity}(id, data)` | `updateMeeting(id, updates)` |
| Delete | `delete{Entity}(id)` | `deleteEngagement(id)` |
| Upsert (sync) | `upsert{Entity}(data)` | `upsertPartnerGoal(data)` |
| Move ownership | `reparent{Entities}To{Target}(fromId, toId)` | `reparentMessagesToEngagement(fromId, toId)` |
| Stamp/link | `stamp{Field}On{Entity}(ids, value)` | `stampPartnerOnMessages(ids, partnerId)` |
| Check existence | `validate{Entity}Exists(id)` or `find{Entity}By{Field}(value)` | `findParticipantByEmail(email)` |
| Resolve name→id | `resolve{Entity}ByName(name)` | `resolvePartnerByName(name)` |
| Composite read | `get{Entity}With{Enrichment}(id)` | `getEngagementParticipantsWithDetails(partnerId)` |

### DB File Organization

| File | Tables | Purpose |
|---|---|---|
| `partners.ts` | partners | Partner CRUD + name resolution |
| `engagements.ts` | engagements, messages (engagement-scoped) | Engagement CRUD + message queries |
| `meetings.ts` | meetings | Meeting CRUD + series/recurrence queries |
| `meeting-notes.ts` | meeting_notes, tasks | Notes + tasks CRUD + digests/summaries |
| `messages.ts` | messages | Message storage, stamping, linking |
| `participants.ts` | participants, partner_participants, meeting_participants, engagement_participants | Person registry + all junction tables |
| `partner-context.ts` | partner_context | Scratchpad + AI synthesis context |
| `catalog.ts` | programs, events | Catalog CRUD |
| `ring3.ts` | partner_program_enrollments, partner_event_participations, partner_goals, partner_funding_mpopp, partner_funding_mdf | Ring 3 junction tables — upserts (sync), CRUD (UI) |
| `inbox.ts` | messages (inbox-scoped) | Inbox queries, grouping, discard |
| `client.ts` | — | Singleton Supabase client |

### When Creating New DB Functions
1. Check if an existing function already returns the data you need — reuse before creating
2. Keep functions focused — one query per function unless the operation is inherently compound (e.g., create + link)
3. Return typed data — use interfaces from `types.ts`, not `any`
4. Handle errors at the db layer — throw or return null, don't swallow errors silently
5. Use `.single()` for single-record fetches, not `.limit(1)` with array indexing

---

## API Route Rules (`src/app/api/`)

### Route Structure Template
```typescript
export async function POST(req: Request) {
  try {
    // 1. Parse + validate input (use validateEnum from validation.ts)
    const body = await req.json();
    const error = validateEnum("status", body.status, VALID_ENGAGEMENT_STATUSES);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // 2. Call service or db function
    const result = await someServiceFunction(body);

    // 3. Return response
    return NextResponse.json({ engagement: result }, { status: 201 });
  } catch (err) {
    console.error("POST /api/engagements:", err);
    return NextResponse.json({ error: "Failed to create engagement" }, { status: 500 });
  }
}
```

### Response Shapes
| Operation | Shape | Status |
|---|---|---|
| Read (single) | `{ meeting: {...} }` | 200 |
| Read (list) | `{ meetings: [...] }` | 200 |
| Create | `{ engagement: {...} }` | 201 |
| Update | `{ meeting: {...} }` | 200 |
| Delete | `{ deleted: true }` | 200 |
| Validation error | `{ error: "field must be one of: ..." }` | 400 |
| Not found | `{ error: "Meeting not found" }` | 404 |
| Server error | `{ error: "Failed to ..." }` | 500 |

### Validation
- All validation constants live in `src/lib/validation.ts` — never define `VALID_*` constants in route files
- Use `validateEnum(field, value, validSet)` from validation.ts for enum validation
- Validate required fields before calling any service/db function
- Return 400 with a clear error message for validation failures

### What Routes Must NOT Do
- ❌ Direct `supabase.from()` calls — use db functions
- ❌ Business logic (loops, multi-step orchestration, conditional workflows) — extract to services
- ❌ Define `VALID_*` constants locally — import from validation.ts
- ❌ Return inconsistent response shapes — follow the table above
- ❌ Exceed 200 lines — if a route is growing, extract logic to a service

---

## Services Layer Rules (`src/lib/`)

### Existing Service Files

| File | Exported Function | Purpose |
|---|---|---|
| `inbound-pipeline.ts` | `processInboundEmail()` | Full email ingestion pipeline: parse → store → detect partner → create meeting → backfill |
| `inbox-resolver.ts` | `resolveInboxToEngagement()` | Inbox resolution: AI synthesis → persist → link meetings → AT push |
| `engagement-merge.ts` | `mergeEngagements()` | Merge pipeline: reparent → enrich → delete source → re-synthesize → push |
| `meeting-recurrence.ts` | `propagateRecurrenceChange()`, `spawnNextOccurrence()` | Recurrence: date calculation, series propagation, occurrence spawning |
| `classifier.ts` | `synthesizeIntoEngagement()` | AI classification + engagement synthesis |
| `notes-summarizer.ts` | `summarizeNotes()` | AI meeting note summarization |
| `brain-synthesizer.ts` | `synthesizePartnerBrain()` | AI partner brain synthesis |
| `notes-context.ts` | `buildPartnerContext()`, `buildMeetingNoteContext()`, `buildBrainContext()` | AI context assembly |

### When to Create a New Service
Create a service function when:
- An API route is orchestrating 3+ db calls in sequence for one logical operation
- The same multi-step pattern appears in more than one route
- Business logic needs to be tested independently of HTTP concerns
- A workflow has side effects (AT push, AI calls, cascading updates)

### Service Design Patterns
- **One exported function per operation** — the function name describes the operation, not the implementation
- **Private helpers stay in the same file** — don't export implementation details
- **Services call db functions, never raw Supabase** — the db layer is the only data access point
- **Services can call other services** — but avoid deep nesting (2 levels max)
- **Return typed results** — define result types for complex operations (e.g., `MergeResult`, `InboundResult`)
- **Log at the service level** — operations worth tracking go here, not in db functions

---

## Validation Rules (`src/lib/validation.ts`)

### The One Rule
**Every `VALID_*` constant is defined exactly once in `validation.ts`.** Routes import them. Sync re-exports them. Nobody defines their own.

### Current Constants (12)
- `VALID_ENGAGEMENT_STATUSES` — active, blocked, completed, archived
- `VALID_ENGAGEMENT_PILLARS` — Co-Sell, Co-Market, Co-Build
- `VALID_MEETING_STATUSES` — scheduled, completed, cancelled, did_not_occur
- `VALID_RECURRENCE_PATTERNS` — weekly, biweekly, monthly, quarterly
- `VALID_PROGRAM_CATEGORIES` — Specialization, Funding, Agreement, Operational, Enablement
- `VALID_PROGRAM_SUBTYPES` — Competency, Service Ready, MSP, Sub-Category, MDF, Credit Program, Hybrid, SCA, Co-Sell, Channel, Migration, Workshop, Certification
- `VALID_EVENT_TYPES` — conference, summit, workshop, trade_show, training, webinar, roundtable
- `VALID_LIFECYCLE_TYPES` — indefinite, recurring, expiring
- `VALID_EVENT_PARTICIPATION_STATUSES` — interested, invited, registered, attended, declined
- `VALID_ENROLLMENT_STATUSES` — not_started, in_progress, submitted, approved, interested, denied, expired
- `VALID_TASK_OWNERS` — me, internal, partner, third_party
- `VALID_SYNC_ENTITIES` — partners, programs, events, engagements, meetings

### Adding a New Validation Constant
1. Add it to `validation.ts` with a descriptive name: `VALID_{ENTITY}_{FIELD}`
2. Use `ReadonlySet<string>` type (matches existing pattern)
3. If sync needs it: add a re-export in `sync/utils.ts`
4. If a route needs it: import from `@/lib/validation`

### The validateEnum Helper
```typescript
validateEnum(fieldName: string, value: string, validSet: ReadonlySet<string>): string | null
// Returns null if valid, error message string if invalid
```

---

## Sync Rules (`src/lib/sync/`)

### Sync Exemption
The sync layer is **exempt** from the db-layer-only rule. `push.ts` and `pull.ts` make direct Supabase calls because:
- Sync is self-contained in `src/lib/sync/`
- It does AT-specific operations (upserts with conflict handling, orphan cleanup) that don't belong in the general db layer
- It will eventually be removed when Airtable is unplugged

### Sync Direction
Every synced table has exactly **one owner** and **one direction**. No two-way sync.

| Direction | Tables | Owner |
|---|---|---|
| AT → RR (pull) | partners, programs, events, partner_goals, partner_program_enrollments, partner_event_participations, partner_funding_mpopp, partner_funding_mdf | Airtable |
| RR → AT (push) | engagements, meetings | Roadrunner |

### Pull Sync Rules
- All 8 pull tables have orphan cleanup: after upserting, delete Supabase rows whose `airtable_id` no longer exists in AT
- Junction tables (enrollments, event participations) guard on null foreign keys — skip rather than upsert with null
- Sync order matters: parents before children (partners → programs → events → junctions → funding)

### Push Sync Rules
- Engagements push on every mutation: create, update, merge, inbox resolve
- Meetings push on every update (PUT), notes auto-complete, ICS creation, recurrence spawn
- Bulk sync (POST /api/sync) pushes all meetings and engagements
- Notes content reaches AT via engagement `current_state` field, not directly

### Meeting Status Lifecycle
- Created as `scheduled`
- Auto-flips to `completed` when notes are saved for the first time (idempotent — POST /api/notes checks for existing note before creating)
- `cancelled` and `did_not_occur` are manual-only — never auto-set
- Status changes push to Airtable on every update

---

## Type Rules (`src/lib/types.ts`)

- **Zero `any` in production code** — use proper types or `unknown` with type narrowing
- **Types live in `types.ts`** — don't define interfaces inline in components or routes unless they're truly local (used by one function in one file)
- **Validation sets use `ReadonlySet<string>`** — not arrays
- **DB function return types** should use interfaces from types.ts
- **Service function params and results** should be typed — define `{Operation}Params` and `{Operation}Result` interfaces for complex operations

---

## Idempotency Rules

- **POST endpoints that create resources** should check for duplicates first — return the existing resource if it already exists (200), only create if new (201). Example: POST /api/notes checks for existing meeting note before inserting.
- **Upserts** use `ON CONFLICT` with appropriate conflict targets
- **Auto-triggers** (like notes → meeting status flip) must be safe to fire multiple times — use guards (module-level Sets, ref checks, status precondition checks)

---

## Error Handling

- **DB layer:** Throw on unexpected errors. Return null for "not found" cases.
- **Service layer:** Catch and log with context. Re-throw or return error results — don't swallow.
- **Route layer:** Wrap everything in try/catch. Log with route path prefix. Return appropriate status codes.
- **Never expose internal errors to the client** — map to user-friendly messages in the route layer.

---

## File Checklist for New Features

When adding a new feature that touches the backend:

1. **Types:** Define interfaces in `types.ts` if they'll be reused
2. **Validation:** Add constants to `validation.ts` if new enum values are introduced
3. **DB functions:** Add to the appropriate `db/*.ts` file — never write raw Supabase outside db/
4. **Service logic:** If the operation coordinates multiple db calls, create a service function in `src/lib/`
5. **API route:** Thin wrapper — validate → call service/db → respond
6. **Sync:** If the data syncs with Airtable, update field-maps.ts and the appropriate pull/push function
7. **Tests:** Existing tests must still pass (444+). Add tests for new logic if applicable.