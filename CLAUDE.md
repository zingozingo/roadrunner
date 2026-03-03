# CLAUDE.md — Roadrunner Project Context

## What This Project Is

Roadrunner (codename **Relay**) is an AI-powered email classification and engagement tracking system for AWS Partner Development Managers. A PDM forwards a partner email to a Mailgun webhook, Claude AI classifies it into a structured engagement with participants, entity links, and a living summary, then syncs everything bidirectionally with Airtable. Deployed on Vercel at roadrunner-fawn.vercel.app.

## Architecture Overview

**Stack:** Next.js 16 (App Router, React 19) + TypeScript 5 + Tailwind 4 + Supabase (PostgreSQL) + Anthropic Claude Sonnet 4 + Airtable REST API + Mailgun webhooks + Vercel

**Two-phase classification pipeline:**
- Phase 1: Lightweight routing — "which engagement does this belong to?"
- Phase 2: Deep analysis — topic, goal, current_state, participants, entity matches, pillar

**Bidirectional Airtable sync:**
- Pull: Airtable owns catalog data (Partners, Programs, Events, AWS Relationships)
- Push: Roadrunner owns activity data (Engagements, Meetings)

**Directory structure:**
```
src/app/           → Next.js pages + API routes (22 routes, 15 pages)
src/components/    → React components (25, organized: layout/, shared/, inbox/, engagement/, actions/)
src/lib/           → Business logic (classification, parsing, sync, formatting)
src/lib/db/        → Database layer (10 modules)
src/lib/sync/      → Airtable sync (field-maps, push, pull, utils)
src/lib/__tests__/ → Test suites (14 suites, 427 tests)
supabase/          → Migrations (001-049) + schema_live.sql
docs/              → 7 documentation files (all current as of 2026-03-01)
```

## Core Architectural Principles

These are **NON-NEGOTIABLE**. Every code change must respect these:

1. **Curated input** — PDMs forward what matters. The classifier routes, it does not filter. Every forwarded email is relevant; the question is "which engagement?" not "is this important?"

2. **Engagement hub** — Everything connects through engagements. Meetings, entity links, participants, and AWS relationships all flow through the engagement. Meetings are timeline events within engagements — they inherit connections from their parent engagement. No standalone meetings. No orphan entities.

3. **Constrained intelligence** — The classifier matches to existing entities by ID, never fabricates new ones. Events, programs, and AWS relationships must exist in the catalog before they can be matched. Empty arrays are better than hallucinated matches.

4. **Data ownership boundary** — Airtable is authoritative for catalog data (Partners, Programs, Events, AWS Relationships). Roadrunner is authoritative for activity data (Engagements, Messages, Meetings, Participants). Never push catalog data TO Airtable. Never treat Roadrunner activity data as secondary.

5. **Await all async operations** — Every Airtable push, every DB write must be awaited. No fire-and-forget. Vercel serverless kills processes after the HTTP response completes — an unawaited promise WILL be silently murdered (this happened in production with the Qualys engagement).

6. **Single source of truth per concern** — `contact-parser.ts` for contact format, `user-config.ts` for PDM identity, `field-maps.ts` for Airtable field IDs, `types.ts` for TypeScript types. Don't scatter these.

7. **Measure twice, cut once** — Always diagnose before building. Read the relevant code before modifying it. Run tests before and after changes. Plan before implementing.

## Data Model (Quick Reference)

**Catalog tables** (Airtable → Roadrunner, pull only):
- `partners` — name, segment, focus_area[], aws_team(JSONB), partner_contacts(JSONB)
- `programs` — name, type, lifecycle_type, requirements, what_it_unlocks
- `events` — name, type, dates, host, geo, sponsor_option, partner_day
- `aws_relationships` — name, aws_org, aws_service, relationship_type, contacts(JSONB)

**Activity tables** (Roadrunner → Airtable, push only):
- `engagements` — name, status, partner_id(FK), pillar, topic, goal, program_id(FK), current_state
- `messages` — engagement_id(FK), sender_*, subject, body_text, content_type, classification_result(JSONB)
- `meetings` — engagement_id(FK), title, meeting_date, status, attendees(JSONB), ics_uid
- `participants` — email(UNIQUE), name, organization, title
- `approval_queue` — low-confidence items pending manual review

**Join/link tables:**
- `entity_links` — polymorphic: engagement↔event, engagement↔program (source_type, target_type)
- `engagement_aws_relationships` — engagement↔aws_relationship junction
- `meeting_aws_relationships` — meeting↔aws_relationship junction (retained in schema, not used by push)
- `participant_links` — participant↔engagement/event with role
- `notes` — engagement notes (CASCADE delete)

**Key relationships:**
- engagements belong to partners (`partner_id` FK)
- messages belong to engagements (`engagement_id` FK)
- meetings belong to engagements (`engagement_id` FK, engagement gate for AT push)
- entity_links connect engagements to programs/events
- engagement_aws_relationships connect engagements to AWS relationships

## Classification Pipeline

**Phase 1** (`phase1-prompt.ts`): Lightweight routing with curated-input philosophy.
- Input: Enriched engagement index (grouped by partner, with participant emails, pillar, entity links) + compact partner catalog + email content + meeting hint
- 7-step decision framework: forwarder note → participant match → partner match → disambiguation (5 sub-signals) → internal/third-party senders → new engagement → flag for review
- Output: `Phase1Result` — content_type + engagement_match (ID, confidence, is_new)
- Early exit on noise (skip Phase 2)

**Phase 2** (`phase2-prompt.ts`): Deep analysis with full engagement history.
- Input: Engagement history (all prior messages) + catalogs (events, programs, relationships) + matched partner details + new email marked with `>>> NEW EMAIL — CLASSIFY THIS <<<`
- Extracts: topic (3-8 words, stable), goal (one sentence), engagement_name ("{Partner} - {topic}"), current_state (3-8 sentence point-in-time snapshot), participants (6 roles), matched entities (strict evidence rules), pillar
- Output: `CombinedClassificationResult` — Phase1 fields echoed + all Phase 2 extractions

**Confidence routing:**
- ≥0.85 → auto-assign (existing) or auto-create (new engagement)
- <0.85 → approval_queue item, resolved via Inbox UI

**Persistence** (`persistClassificationResult` in `classifier.ts`):
- Updates messages with classification + engagement link
- Updates engagement fields (current_state evolved, topic, goal, name, pillar)
- Creates entity links (engagement↔event, engagement↔program) by ID
- Links AWS relationships via junction table
- Upserts participants + backfills sender names
- Pushes to Airtable (awaited)
- Idempotent — safe to call multiple times

## Airtable Sync

- **Pull:** `syncAllCatalogs()` in `src/lib/sync/pull.ts` pulls Partners, Programs, Events, AWS Relationships. Idempotent with change detection. Name-based initial match → ID-based ongoing match.
- **Push:** `pushEngagementToAirtable()` and `pushMeetingToAirtable()` in `src/lib/sync/push.ts`. Engagement push resolves partner, program, event (via entity_links), and AWS relationship linked records. Meeting push only carries meeting-specific data + engagement link (partner/program/event shown via AT lookup fields).
- **Field IDs:** ALL Airtable field IDs live in `src/lib/sync/field-maps.ts` — NEVER hardcode field IDs elsewhere. Constants: `PF` (programs), `EF` (events), `RF` (relationships), `PTRF` (partners), `ENF` (engagements), `MF` (meetings).
- **Notes merging:** Roadrunner section delimited by `NOTES_MARKER`/`NOTES_FOOTER` markers. Manual Airtable content outside markers is preserved.
- **Engagement gate:** Meetings without an `engagement_id` don't push to Airtable (prevents ICS temporal gap from creating orphan records).
- **All push calls are awaited** — see principle #5.

## Contact Format

Universal format: `Name <email> (Title)`
- Self-documenting placeholders: `<—>` for missing email, `(—)` for missing title
- Parser: `src/lib/contact-parser.ts` — parseContact, renderContact, parseContactList, renderContactList
- Storage: JSONB arrays on `partners` (aws_team, partner_contacts), `aws_relationships` (contacts)
- Name resolution: `src/lib/name-resolver.ts` — priority chain: aws_relationships.contacts > partners.aws_team > partners.partner_contacts > participants table
- PDM identity: `src/lib/user-config.ts` — canonical email, aliases, PRVS stripping, corpmail detection

## Testing

- **Framework:** Vitest
- **Run:** `npx vitest run --reporter=verbose`
- **Current:** 427 tests across 14 suites, all passing
- **Location:** `src/lib/__tests__/{module}.test.ts`
- **Suites:** email-parser (123), phase2-prompt (54), phase1-prompt (45), format-utils (39), ics-parser (31), name-resolver (28), contact-parser (26), user-config (18), meeting-pipeline (13), classifier (11), prompt-builder (11), dedup (6), meeting-status-map (5), resolve-route (4)
- **DB mocking:** Supabase client is mocked via `vi.mock` with `vi.hoisted()` for mock variables — see existing tests for the pattern
- **Type checking:** `npx tsc --noEmit` — must pass with zero errors
- **Rule:** ALWAYS run tests after changes. NEVER commit with failing tests.

## Development Workflow

Steven's workflow is two-layer:
1. **Claude web** (claude.ai) — Airtable MCP access, architectural planning, session management, diagnostic design
2. **Claude Code CLI** — Code execution, file changes, test runs, git operations

**Session protocol:**
1. Read CLAUDE.md and `docs/goal-state.md` for orientation
2. Run diagnostic if needed (test status, schema state, recent changes)
3. Plan before implementing — discuss approach, identify affected files
4. Implement with verification (tests + type check after every change)
5. Update docs if state has changed (goal-state.md, decisions.md)
6. Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`

## Key Conventions

- **Migrations:** Sequential numbering in `supabase/migrations/` (currently 001-049). New migrations get the next number (050, 051, ...).
- **Types:** All TypeScript types in `src/lib/types.ts` — keep them there, don't scatter.
- **API routes:** `src/app/api/{resource}/route.ts` pattern. All CRUD follows same pattern.
- **UI pages:** `src/app/{resource}/page.tsx` for list, `src/app/{resource}/[id]/page.tsx` for detail.
- **Components:** `src/components/` organized by concern — `layout/`, `shared/`, `inbox/`, `engagement/`, `actions/`.
- **Error handling:** Try/catch on all async operations, especially Airtable pushes. Log errors, don't swallow them.
- **Formatting:** Use `format-utils.ts` for display formatting, `contact-parser.ts` for contact rendering.
- **No RLS:** Single-user app, service key auth. No row-level security policies.
- **Compiler-driven refactoring:** When removing fields from shared interfaces, strip from `types.ts` first, then use `tsc --noEmit` errors as the exhaustive fix list. Chunk order: Types → Lib → UI → API/Tests → Migration.

## Common Gotchas

- **Airtable field IDs are opaque** — they change if you recreate a field. Always verify against live Airtable (via MCP on claude.ai) before assuming `field-maps.ts` is correct.
- **Supabase PostgREST** returns `{ data, error }` — always check `error` before using `data`.
- **ICS temporal gap** — ICS parsing creates meetings BEFORE classification. Meetings get linked to engagements AFTER Phase 2, not during creation. The engagement gate in push.ts prevents orphan AT records. This is by design.
- **Email parser complexity** — Two-pass parser handles Outlook and Gmail differently. 123 tests cover edge cases. Don't simplify without running the full suite.
- **Mock hoisting** — `vi.mock()` factories hoist above variable declarations. Use `vi.hoisted()` for mock variables used in factories.
- **Fire-and-forget is forbidden** — Vercel serverless kills processes after HTTP response. Every async operation must be awaited (see decisions.md entry 89 for the production incident).
- **JSONB in Supabase** — `select("*")` returns parsed objects, but check existing code patterns for INSERT/UPDATE handling before assuming.
- **Engagement status differs between systems** — Roadrunner uses `active/blocked/completed/archived`, Airtable mapping is in `sync/utils.ts` (`STATUS_TO_AIRTABLE`).

## File Quick Reference

**Classification chain:**
`classifier.ts` → `phase1-prompt.ts` → `phase2-prompt.ts` → `prompt-builder.ts` → `claude.ts`

**Sync chain:**
`sync/index.ts` → `sync/push.ts` / `sync/pull.ts` → `sync/field-maps.ts` → `sync/utils.ts`

**Data layer:**
`db/index.ts` → `db/engagements.ts` → `db/messages.ts` → `db/meetings.ts` → `db/participants.ts` → `db/catalog.ts` → `db/entity-links.ts` → `db/relationships.ts` → `db/partners.ts` → `db/inbox.ts`

**Email processing:**
`email-parser.ts` (two-pass split + cleaning) → `ics-parser.ts` (calendar parsing) → `name-resolver.ts` (display names)

**Entry points:**
- Mailgun webhook: `src/app/api/inbound/route.ts`
- Classification trigger: `src/app/api/classify/route.ts`
- Approval resolution: `src/app/api/reviews/resolve/route.ts`
- Catalog sync: `src/app/api/sync/route.ts`

**Types & identity:**
`types.ts` (all interfaces) → `user-config.ts` (PDM identity) → `contact-parser.ts` (format) → `format-utils.ts` (display)

## Current State

See `docs/goal-state.md` for the living version:
- 49 migrations, 14 tables, 22 API routes, 15 UI pages, 427 tests across 14 suites
- 5 active engagements (Nozomi Networks, Spacelift x3, Qualys)
- Phase 1 prompt: curated-input philosophy, 6-step decision framework, enriched engagement index
- Engagement-hub architecture: meetings and entity links flow through engagements
- Meeting pipeline: ICS parse → create → classify → link to engagement (unconditional) → inherit partner → AT push
- All Airtable pushes awaited (no fire-and-forget)
- Docs: 7 files in `docs/`, all current as of 2026-03-02

## What NOT to Do

- Do NOT add Airtable field IDs anywhere except `field-maps.ts`
- Do NOT create standalone meetings without an engagement (engagement gate)
- Do NOT use fire-and-forget for any Airtable or DB operation
- Do NOT modify the contact format without updating `contact-parser.ts` AND its 26 tests
- Do NOT add new types outside of `types.ts`
- Do NOT skip reading existing code before modifying — always read the file first
- Do NOT push catalog data (partners, programs, events, relationships) TO Airtable — sync is pull-only for catalogs
- Do NOT "band-aid" problems — find root cause, fix properly, verify with tests
- Do NOT simplify the email parser without running its 123-test suite
