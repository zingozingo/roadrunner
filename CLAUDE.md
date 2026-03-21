# Roadrunner (Relay)

> AI-powered partner engagement management for AWS PDMs. Forward emails → human-guided routing → AI synthesis → structured engagements → Airtable sync.
> 69 migrations · 17 tables · 31 API routes · 18 UI pages · 437 passing tests

---

## What This Is

Roadrunner turns scattered partner email threads into structured, trackable engagement records. A PDM forwards a partner email to `relay.stevenromero.dev` → Mailgun webhook receives it → Claude AI classifies it, extracts participants, links it to known programs/events/relationships → everything surfaces on a dashboard where you manage partner engagements. Forwarding an email is the only input required. Built for Steven Romero, PDM at AWS, managing ~20 ISV partner relationships. Deployed on Vercel at roadrunner-fawn.vercel.app.

---

## Key Terminology

| Term | Definition |
|------|-----------|
| **Engagement** | A trackable workstream with a partner. Has a living summary (current_state) that evolves as new emails arrive. |
| **Meeting** | A calendar event extracted from ICS attachments. Linked to a partner and optionally to an engagement. |
| **Partner** | An ISV in the portfolio. Catalog data owned by Airtable. |
| **Program** | An AWS partner program (ISV Accelerate, Security Competency, etc.). Catalog data owned by Airtable. |
| **Event** | A shared calendar anchor like re:Invent or a summit. NOT a partner-specific call. Catalog data owned by Airtable. |
| **Relationship** | A named relationship with an AWS person or team. Catalog data owned by Airtable. |
| **Task** | An action item extracted from meeting notes or created manually. Belongs to a partner, optionally linked to a meeting note. |
| **Participant** | A person in the system. The canonical person registry — every contact resolves here. |
| **Partner Context** | PDM scratchpad notes about a partner. Wired into AI context pipeline for meeting note summarization. |
| **Inbox** | Unrouted messages (engagement_id IS NULL). PDM triages via assign, create new, or discard. |

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless on Vercel) |
| Database | Supabase PostgreSQL |
| AI | Anthropic Claude Sonnet 4 |
| Email Ingestion | Mailgun (inbound webhook) |
| Partner Data | Airtable (REST API, bidirectional sync) |
| Deployment | Vercel |
| Domain | relay.stevenromero.dev |

---

## Directory Structure

```
roadrunner/
├── docs/                          # Project documentation (3 files)
│   ├── CLASSIFICATION.md          #   AI synthesis pipeline documentation (rewrite pending)
│   ├── entity-model.md            #   Canonical schema — ERD + field-level registry + AT field IDs
│   └── goal-state.md              #   Living orientation doc — current state & next steps
├── decisions.md                   # Append-only architectural decision log (275 entries)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── api/                   #   API routes (31 route files, grouped by entity)
│   │   │   ├── engagements/       #     CRUD + merge + participants
│   │   │   ├── events/            #     CRUD
│   │   │   ├── health/            #     Health check
│   │   │   ├── inbound/           #     Mailgun webhook
│   │   │   ├── inbox/             #     Inbox grouped count + set-partner
│   │   │   ├── meetings/          #     CRUD
│   │   │   ├── notes/             #     Notes CRUD + summarize + tasks + context
│   │   │   ├── participants/      #     Update participant
│   │   │   ├── partners/          #     CRUD + partner context
│   │   │   ├── programs/          #     CRUD
│   │   │   ├── relationships/     #     CRUD
│   │   │   ├── reviews/           #     Inbox resolve (assign/create/discard)
│   │   │   └── sync/              #     Trigger Airtable sync
│   │   ├── engagements/           #   Engagement list + detail pages
│   │   ├── events/                #   Event list + detail pages
│   │   ├── inbox/                 #   Inbox triage UI
│   │   ├── meetings/              #   Meeting list + detail pages (inline NoteWorkspace)
│   │   ├── partners/              #   Partner list + detail pages
│   │   ├── programs/              #   Program list + detail pages
│   │   ├── relationships/         #   Relationship list + detail pages
│   │   ├── tasks/                 #   Cross-partner task dashboard
│   │   ├── layout.tsx             #   Root layout + sidebar
│   │   └── page.tsx               #   Redirects to /partners
│   ├── components/                # React components (33 across 7 groups)
│   │   ├── actions/               #   Entity action buttons + MergeButton (6 files)
│   │   ├── engagement/            #   Engagement-specific cards (1 file: CurrentStateCard)
│   │   ├── inbox/                 #   Inbox triage UI — InboxClient (1 file)
│   │   ├── layout/                #   App structure — sidebar, headers (4 files)
│   │   ├── notes/                 #   NoteWorkspace, ContextSidebar, PreviousNotes, TaskEditor, MeetingNotesSection
│   │   ├── partners/              #   PartnerTasksSection, PartnerScratchpad
│   │   └── shared/                #   Reusable primitives — CompactRow, DetailHeader, EngagementLinker, RecurrenceEditor, badges (14 files)
│   └── lib/                       # Core business logic
│       ├── classifier.ts          #   Synthesis orchestrator (synthesizeIntoEngagement, persistClassificationResult)
│       ├── claude.ts              #   Anthropic API client (synthesis calls)
│       ├── partner-detection.ts   #   Mechanical partner detection via domain matching
│       ├── phase2-prompt.ts       #   Synthesis system prompt + context builders
│       ├── prompt-builder.ts      #   Forwarder section builder (buildForwarderSection only)
│       ├── email-parser.ts        #   Forwarded email chain parser (two-pass)
│       ├── ics-parser.ts          #   ICS calendar event parser (RFC 5545)
│       ├── name-resolver.ts       #   Contact name resolution from JSONB columns
│       ├── contact-parser.ts      #   Universal "Name <email> (Title)" parser
│       ├── format-utils.ts        #   Display name formatting utilities
│       ├── meeting-recurrence.ts  #   Recurring meeting engine (spawn, overdue detection)
│       ├── notes-summarizer.ts    #   AI meeting note summarizer (Claude API)
│       ├── notes-context.ts       #   Context builders (buildPartnerContext, buildMeetingNoteContext, buildBrainContext)
│       ├── contact-display.ts     #   Contact display formatting for UI
│       ├── brain-synthesizer.ts   #   AI partner brain synthesis (structured executive briefing)
│       ├── types.ts               #   All shared TypeScript interfaces
│       ├── user-config.ts         #   Canonical user identity config
│       ├── airtable.ts            #   Airtable REST API client
│       ├── db/                    #   Database layer (13 modules)
│       │   ├── client.ts          #     Supabase singleton client
│       │   ├── engagements.ts     #     Engagement CRUD + history
│       │   ├── messages.ts        #     Message storage + fingerprint dedup
│       │   ├── meetings.ts        #     Meeting CRUD + ICS creation
│       │   ├── meeting-notes.ts   #     Meeting notes + tasks CRUD
│       │   ├── partners.ts        #     Partner queries (read-only)
│       │   ├── partner-context.ts #     Scratchpad CRUD
│       │   ├── catalog.ts         #     Events + Programs CRUD
│       │   ├── relationships.ts   #     Relationships + junction queries
│       │   ├── participants.ts    #     Participant upsert + registry joins
│       │   ├── engagement-links.ts #     Engagement↔program/event junction queries
│       │   ├── inbox.ts           #     Inbox queries, grouped count, set-partner, INBOX_GROUP_WINDOW_MS
│       │   └── index.ts           #     Barrel re-exports
│       ├── sync/                  #   Airtable sync engine
│       │   ├── pull.ts            #     AT → RR catalog sync
│       │   ├── push.ts            #     RR → AT activity sync
│       │   ├── field-maps.ts      #     Airtable field ID constants
│       │   └── utils.ts           #     Coercion helpers + validation
│       └── __tests__/             #   449 passing tests across 14 test files
├── supabase/
│   ├── migrations/                # 69 migration files (001-069)
│   └── (authoritative schema lives in migrations/)
├── scripts/
│   ├── seed-data.ts               # CLI script to seed events/programs
│   └── hydrate-contact-registry.ts # Backfill contact registry join tables
└── data/
    ├── seed-events.json           # Event catalog seed data
    └── seed-programs-v2.json      # Program catalog seed data
```

---

## Data Flow — Email to Dashboard

```
1. USER FORWARDS EMAIL
   ↓
2. MAILGUN WEBHOOK → POST /api/inbound
   Receives raw email (body-plain, headers, calendar attachments)
   ↓
3. EMAIL PARSER (email-parser.ts)
   Extracts: sender, recipients, subject, body, forwarded content
   Strips: quoted replies, signatures, forwarding headers
   ↓
4. ICS PARSER (ics-parser.ts) — if calendar data present
   Extracts: meeting title, date, time, location, attendees, UID
   Source: Mailgun body-calendar field (NOT file attachments)
   ↓
5. MESSAGE STORED (db/messages.ts)
   Raw email saved to messages table with parsed metadata
   Per-message fingerprint dedup (sender_email + body prefix)
   ↓
6. PARTNER DETECTION (partner-detection.ts)
   Mechanical domain matching against contact registry
   Sets partner_id on message — no AI involved
   ↓
7. INBOX (messages WHERE engagement_id IS NULL)
   Messages appear in Inbox UI grouped by forwarded_at (5s window)
   PDM chooses: Assign to existing engagement, Create new, or Discard
   ↓
8. AI SYNTHESIS (classifier.ts → synthesizeIntoEngagement)
   Full thread history → deep analysis via Claude API
   Returns: current_state, participants, entity links, pillar, topic, goal
   ↓
9. PERSIST (classifier.ts → persistClassificationResult)
   Single function handles assign-existing, create-new, and merge paths:
   - Create or update engagement (current_state, topic, goal, pillar)
   - Upsert participants + link to engagement
   - Link engagement↔programs, engagement↔events, engagement↔relationships
   - Create meetings (if ICS data present)
   - Link message to engagement
   ↓
10. SYNC TO AIRTABLE (sync/push.ts — awaited)
    Push: engagements → Partner Engagements table
    Push: meetings → Meetings table
    Pull: partners, programs, events, relationships ← catalog tables
    ↓
11. DASHBOARD (Next.js pages)
    Server components query Supabase directly
    Client components use API routes for mutations
```

---

## Data Ownership

Airtable owns **catalog** (Ring 1: Partners, Programs, Events, Relationships). Roadrunner owns **activity** (Ring 2: Engagements, Meetings, Notes, Tasks, Messages, Participants, Partner Context). Airtable-only tables (Ring 3: Partner Programs, Partner Events, Plans, Funding) will be pulled in later. See `docs/entity-model.md` for the complete schema with all 19 tables, FK cascade behaviors, and Airtable field IDs.

---

## Core Principles

These are **NON-NEGOTIABLE**. Every code change must respect these:

1. **Email-in, insight-out** — The user never leaves Outlook to feed the system. Forwarding is the only input.
2. **Human routes, AI synthesizes** — The PDM decides where emails go. AI handles deep analysis only after routing.
3. **Summaries are the product** — Raw emails are stored but never the primary view. `current_state` is the living output.
4. **Connect, don't create** — The AI is biased toward linking to existing entities, never fabricating new ones. Empty arrays over hallucinated matches.
5. **AI creates engagements only** — Programs, events, partners, and relationships are human-curated catalog data.
6. **Data ownership boundary** — Airtable owns catalogs (pull only). Roadrunner owns activity (push only). Never cross the boundary.
7. **Single source of truth per concern** — `contact-parser.ts` for contact format, `user-config.ts` for PDM identity, `field-maps.ts` for Airtable field IDs, `types.ts` for TypeScript types. Don't scatter.
8. **Await all async operations** — No fire-and-forget. Vercel serverless kills processes after HTTP response. An unawaited promise WILL be silently murdered (this happened in production — decisions.md #89).
9. **One persistence path** — Assign-existing, create-new, and merge all share `persistClassificationResult()`. No divergent code paths.
10. **Structured over freeform** — Categorization uses pillar, program links, and relationship links — not free-form labels.
11. **Resolve, don't duplicate** — Every piece of data has one authoritative home. Everything else references it.
12. **Partner is gravity** — Everything orbits the partner. Delete a partner, cascade everything.
13. **Design before code** — For UI work, solve the design problem before writing JSX.

---

## API Route Patterns

**Server Components (reads):** List and detail pages query Supabase directly via server-side functions in `db/`. No API route involved — the component IS the server.

**Client Components (writes):** Action buttons, forms, and mutations call API routes. The routes validate input and call `db/` functions.

**External Webhooks:** `/api/inbound` (Mailgun) and `/api/health` (monitoring) are called by external services, not the frontend.

**No stubbed routes.** The old `/api/classify` 410 stub was removed in Phase D cleanup.

---

## Development

### Environment Variables

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ANTHROPIC_API_KEY=
MAILGUN_API_KEY=
MAILGUN_WEBHOOK_SIGNING_KEY=
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=appy9TT1LRJTAuQ4W
```

### Local Commands

```bash
npm install                        # Install dependencies
npm run dev                        # Start Next.js dev server on :3000
npx vitest run --reporter=verbose  # Run tests (449 passing, 0 failures)
npx tsc --noEmit                   # TypeScript check (must pass with zero errors)
```

### Testing

**Framework:** Vitest · **Location:** `src/lib/__tests__/`

| Test File | Tests | Covers |
|-----------|-------|--------|
| email-parser.test.ts | 126 | Email chain parsing, forwarded content extraction, conference boilerplate splits |
| phase2-prompt.test.ts | 50 | Phase 2 prompt building, context sections, scratchpad/digests |
| contact-display.test.ts | 41 | Contact display formatting |
| format-utils.test.ts | 39 | Display name formatting utilities |
| contact-parser.test.ts | 34 | Universal contact format parsing/rendering |
| ics-parser.test.ts | 32 | ICS calendar parsing (RFC 5545), multi-VEVENT guardrail |
| name-resolver.test.ts | 27 | Contact name resolution from JSONB columns |
| partner-detection.test.ts | 25 | Mechanical partner detection via domain matching |
| meeting-recurrence.test.ts | 18 | Recurring meeting engine (calculateNextDate, overdue detection, spawn) |
| user-config.test.ts | 18 | User identity matching |
| meeting-pipeline.test.ts | 13 | Meeting creation, ICS parsing, linking |
| prompt-builder.test.ts | 3 | Forwarder section builder (buildForwarderSection) |
| dedup.test.ts | 6 | Message fingerprint deduplication |
| meeting-status-map.test.ts | 5 | Meeting status mapping (mapMeetingStatus in sync/utils) |

**DB mocking:** Supabase client is mocked via `vi.mock` with `vi.hoisted()` for mock variables — see existing tests for the pattern.

**Rule:** ALWAYS run tests after changes. NEVER commit with failing tests.

### Migrations

Sequential numbering in `supabase/migrations/` (currently 001-069). New migrations get the next number (070, 071, ...). Write idempotent SQL where possible.

### Key Conventions

- **Types:** All TypeScript types in `src/lib/types.ts` — keep them there, don't scatter.
- **API routes:** `src/app/api/{resource}/route.ts` pattern.
- **UI pages:** `src/app/{resource}/page.tsx` for list, `src/app/{resource}/[id]/page.tsx` for detail.
- **Components:** `src/components/` organized by concern — `layout/`, `shared/`, `inbox/`, `engagement/`, `actions/`, `notes/`, `partners/`.
- **No RLS:** Single-user app, service key auth. No row-level security policies.
- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Compiler-driven refactoring:** Strip from `types.ts` first, then use `tsc --noEmit` errors as the fix list. Order: Types → Lib → UI → API/Tests → Migration.

---

## Airtable Sync

### Adding a New Synced Field (End-to-End)

1. **Airtable:** Create or identify the field. Note the field ID (visible in API docs or URL).
2. **field-maps.ts:** Add the field ID to the appropriate constant (PTRF, PF, EF, RF, ENF, MF).
3. **pull.ts/push.ts:** Add the field mapping in the relevant build/map function.
4. **types.ts:** Add the field to the TypeScript interface.
5. **Migration:** Add the column to the Supabase table (if it doesn't exist).
6. **db/ module:** Update any query functions that need the new field.
7. **UI:** Add display in the relevant detail/list page.
8. **entity-model.md:** Document the new field in the field-level registry.

### Sync Constants

| Constant | Entity | Direction | Table ID |
|----------|--------|-----------|----------|
| PTRF | Partners | AT → RR | tbl9zC6nxfLEp8xUx |
| PF | Programs | AT → RR | tblpnW8ibVmkWi5Dt |
| EF | Events | AT → RR | tblPDGUSqSvn8mflJ |
| RF | Relationships | AT → RR | tblqVBssFsUeAt9bj |
| ENF | Engagements | RR → AT | tblTC491AUVcrKvq2 |
| MF | Meetings | RR → AT | tbl6LsEqSvEZgqBdW |

### Safe vs. Dangerous Airtable Changes

**Safe (no code changes needed):** Rename fields, reorder fields, add new non-synced fields, change colors, add views.

**Requires field-maps.ts update:** Change a field's type, change select option values, delete a synced field, add a new field you want Roadrunner to use.

**Key principle:** Field IDs are permanent. Names are cosmetic. Types are contracts.

---

## Common Gotchas

- **Airtable field IDs are opaque** — they change if you recreate a field. Always verify against live Airtable (via MCP on claude.ai) before assuming `field-maps.ts` is correct.
- **Supabase PostgREST** returns `{ data, error }` — always check `error` before using `data`.
- **ICS temporal gap** — ICS parsing creates meetings BEFORE classification. Meetings get linked to engagements AFTER Phase 2. The engagement gate in push.ts prevents orphan AT records. By design.
- **Email parser complexity** — Two-pass parser handles Outlook and Gmail differently. 126 tests cover edge cases. Don't simplify without running the full suite. Conference boilerplate is stripped BEFORE splitting (decision #258).
- **Mock hoisting** — `vi.mock()` factories hoist above variable declarations. Use `vi.hoisted()` for mock variables.
- **Fire-and-forget is forbidden** — Vercel serverless kills processes after HTTP response. Every async operation must be awaited.
- **Engagement status differs** — Roadrunner uses `active/planned/blocked/completed/archived`, Airtable mapping is in `sync/utils.ts` (`STATUS_TO_AIRTABLE`).

---

## File Quick Reference

**Classification:** `classifier.ts` → `phase2-prompt.ts` → `claude.ts` · Partner detection: `partner-detection.ts` · Brain: `brain-synthesizer.ts` → `notes-context.ts` (buildBrainContext)

**Sync:** `sync/pull.ts` / `sync/push.ts` → `sync/field-maps.ts` → `sync/utils.ts`

**Data layer:** `db/index.ts` → `db/engagements.ts` → `db/messages.ts` → `db/meetings.ts` → `db/meeting-notes.ts` → `db/participants.ts` → `db/partner-context.ts` → `db/catalog.ts` → `db/engagement-links.ts` → `db/relationships.ts` → `db/partners.ts` → `db/inbox.ts`

**Email:** `email-parser.ts` → `ics-parser.ts` → `name-resolver.ts` → `contact-parser.ts` → `format-utils.ts` · Recurrence: `meeting-recurrence.ts`

**Entry points:** `/api/inbound` (Mailgun webhook), `/api/reviews/resolve` (inbox routing — assign/create/discard), `/api/engagements/merge` (engagement merge), `/api/sync` (catalog sync)

---

## Documentation Map

| Doc | Purpose | When to Read |
|-----|---------|--------------|
| `CLAUDE.md` | This file — project overview, architecture, development | Start of every session |
| `docs/entity-model.md` | Complete schema — 19 tables, all FKs, AT field IDs, ring model | Schema/data work |
| `docs/CLASSIFICATION.md` | AI synthesis pipeline (rewrite pending — Phase 2 docs still accurate) | Prompt/AI work |
| `docs/goal-state.md` | Living status — current state + what's next | Session planning |
| `decisions.md` | Append-only architectural decision log (275 entries) | When you need "why" |

---

## What NOT to Do

- Do NOT add Airtable field IDs anywhere except `field-maps.ts`
- Do NOT create standalone meetings without an engagement (engagement gate)
- Do NOT use fire-and-forget for any Airtable or DB operation
- Do NOT modify the contact format without updating `contact-parser.ts` AND its 26 tests
- Do NOT add new types outside of `types.ts`
- Do NOT skip reading existing code before modifying — always read the file first
- Do NOT push catalog data TO Airtable — sync is pull-only for catalogs
- Do NOT simplify the email parser without running its 126-test suite
- Do NOT band-aid problems — find root cause, fix properly, verify with tests
