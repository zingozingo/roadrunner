# Relay (Roadrunner)

AI-powered engagement tracker for an AWS Partner Development Manager. Forward an email to the relay address and the system parses, classifies, and organizes it into an engagement — a tracked workstream with a specific partner toward a specific goal.

Deployed at [roadrunner-fawn.vercel.app](https://roadrunner-fawn.vercel.app).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5, Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude API (Sonnet) |
| Email ingest | Mailgun inbound webhooks |
| SMS notifications | Twilio |
| Catalog sync | Airtable REST API |
| Hosting | Vercel (git push deploy) |
| Tests | Vitest (73 tests across 5 suites) |

## Architecture

### Constrained Intelligence Pattern

Claude operates within a closed vocabulary of known entities. Programs, events, and AWS relationships are human-curated reference data synced from Airtable. Claude receives their UUIDs in context and matches against them by ID — it never creates programs or events, never fabricates IDs, and never does fuzzy name resolution.

Engagements are the only entity Claude can create.

### Data Flow

```
                    ┌─────────────────────────────┐
                    │          Airtable            │
                    │   (strategic portfolio hub)  │
                    └──────┬──────────────▲────────┘
                   pull    │              │  push
                (catalogs) │              │ (activity)
                    ┌──────▼──────────────┴────────┐
                    │         Roadrunner            │
                    │   (email classification hub)  │
                    └──────▲──────────────┬────────┘
                           │              │
                     inbound│         SMS  │
                     webhook│    notification
                    ┌──────┴──────────────▼────────┐
                    │    Mailgun      Twilio        │
                    └─────────────────────────────┘
```

### Sync Directions

Each entity type has one authoritative source. Sync never overwrites the authority.

| Entity | Authority | Direction | Trigger |
|--------|-----------|-----------|---------|
| Partners | Airtable | Airtable → Supabase | Manual button |
| Programs | Airtable | Airtable → Supabase | Manual button |
| Events | Airtable | Airtable → Supabase | Manual button |
| AWS Relationships | Airtable | Airtable → Supabase | Manual button |
| Engagements | Roadrunner | Supabase → Airtable | Auto on classify/edit + manual button |
| Meetings | Roadrunner | Supabase → Airtable | Auto on create/ICS/link/delete + manual button |

Catalog sync is idempotent with change detection. First sync matches by name, stores `airtable_record_id`, and all subsequent syncs match by ID (rename-safe). Activity push is fire-and-forget — Airtable being unavailable never blocks classification. See `docs/sync-architecture.md` for full details.

### Classification Pipeline

```
Mailgun webhook → POST /api/inbound
  ├─ Parse Outlook-style forwarded headers (From/Sent/To/CC/Subject)
  ├─ Extract forwarder identity from Mailgun envelope
  ├─ Dedup check (sender + subject + first 100 chars)
  ├─ Store messages in Supabase (unclassified)
  │
  ▼
Claude API (single call per email group)
  ├─ Context: all active engagements (with current_state),
  │           all programs (with IDs), all events (with IDs),
  │           forwarder identity, email content
  │
  ├─ Returns: engagement match, matched programs/events (by ID),
  │           participants, current_state update, open items, tags
  │
  ▼
Routing
  ├─ Noise → skip
  ├─ ≥0.85 confidence + existing engagement → auto-assign
  ├─ ≥0.85 confidence + new engagement → auto-create
  └─ <0.85 confidence → approval queue + SMS notification
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── inbound/          # Mailgun webhook endpoint
│   │   ├── classify/         # Classification test endpoints
│   │   ├── engagements/      # Engagement CRUD
│   │   ├── events/           # Event read + update
│   │   ├── meetings/         # Meeting CRUD
│   │   ├── participants/     # Participant edit
│   │   ├── participant-links/# Unlink participants
│   │   ├── partners/         # Partner CRUD
│   │   ├── programs/         # Programs list
│   │   ├── relationships/    # AWS Relationship read + update
│   │   ├── reviews/resolve/  # Approval queue resolution
│   │   ├── sms/              # SMS send + webhook
│   │   ├── sync/             # Airtable sync trigger
│   │   ├── health/           # Health check
│   │   └── inbox/            # Inbox count + list
│   ├── engagements/          # Engagement list + detail pages
│   ├── events/               # Event list + detail pages
│   ├── meetings/             # Meeting list + detail pages
│   ├── partners/             # Partner list + detail pages
│   ├── programs/             # Programs list + detail pages
│   ├── relationships/        # AWS Relationship list + detail pages
│   ├── inbox/                # Approval review page
│   ├── test/                 # Classification test page
│   ├── globals.css           # CSS variables + Tailwind v4 theme
│   ├── layout.tsx            # Root layout with sidebar
│   └── page.tsx              # Dashboard home
├── components/               # 22 React components (mix of server + client)
│   ├── Sidebar.tsx           # Navigation with inbox badge
│   ├── StatusBadge.tsx       # Status pill (planned/active/paused/completed/archived)
│   ├── EngagementActions.tsx  # Edit form with 5-status selector
│   ├── InboxClient.tsx       # Approval review cards
│   ├── SyncButton.tsx        # Airtable sync trigger
│   └── ...
└── lib/
    ├── types.ts              # All TypeScript interfaces
    ├── supabase.ts           # Supabase client + all DB operations (~1700 lines)
    ├── claude.ts             # System prompt + Claude API call + response parser
    ├── classifier.ts         # Orchestration: process → route → persist
    ├── email-parser.ts       # Outlook-style forwarded email parser
    ├── sms.ts                # Twilio SMS send + reply parsing
    ├── airtable.ts           # Airtable REST client (no SDK dependency)
    ├── sync.ts               # Bidirectional sync: catalog pull + activity push
    ├── ics-parser.ts         # RFC 5545 ICS/VCALENDAR parser (no dependencies)
    └── __tests__/            # 5 test suites, 73 tests
        ├── email-parser.test.ts  # 26 tests — header parsing, multi-message, edge cases
        ├── ics-parser.test.ts    # 18 tests — ICS/VCALENDAR parsing, attendee extraction
        ├── classifier.test.ts    # 9 tests — routing, auto-assign, auto-create, grouping
        ├── claude.test.ts        # 11 tests — prompt building, response parsing
        └── sms.test.ts           # 9 tests — SMS formatting, reply parsing

scripts/
└── seed-data.ts              # Idempotent seed loader (npm run seed -- data/file.json)

data/
├── seed-events.json          # 32+ event records
└── seed-programs-v2.json     # 33 program records

docs/
├── goal-state.md             # Target architecture specification
├── field-mapping-guide.md    # Airtable ↔ Supabase field-by-field mapping
├── sync-architecture.md      # Sync model, hooks, buttons, match strategy
└── master-spec.md            # (deprecated) Original spec

supabase/
└── migrations/               # 28 sequential SQL migrations (001–028)

decisions.md                  # 90+ architecture decision records
```

## Database Schema

14 tables in Supabase PostgreSQL, managed through 28 sequential migrations.

### Core Tables

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| `engagements` | Partner workstreams — the primary entity | `status CHECK (planned, active, paused, completed, archived)` |
| `messages` | Inbound parsed emails | FK → engagements (SET NULL on delete) |
| `participants` | People extracted from emails | email UNIQUE (nullable) |
| `participant_links` | Connects participants ↔ engagements | UNIQUE(participant_id, entity_type, entity_id) |
| `entity_links` | Polymorphic engagement ↔ event/program links | Deduplicated on insert |
| `approval_queue` | Low-confidence classification reviews | `type CHECK ('engagement_assignment')` |
| `notes` | User notes on engagements | FK → engagements (CASCADE) |

### Reference Data (Airtable-sourced)

| Table | Purpose | Records |
|-------|---------|---------|
| `partners` | Partner companies with contact info | ~20 |
| `events` | Conferences, summits, deadlines | ~32 |
| `programs` | AWS programs, competencies, motions | ~33 |
| `aws_relationships` | AWS team contacts and org links | ~7 |

### Junction Tables

| Table | Purpose |
|-------|---------|
| `engagement_aws_relationships` | Many-to-many: engagements ↔ AWS relationships |
| `meeting_aws_relationships` | Many-to-many: meetings ↔ AWS relationships |

### Activity Tables

| Table | Purpose |
|-------|---------|
| `meetings` | Meetings linked to engagements and/or events |

All tables use UUID primary keys (`gen_random_uuid()`). `engagements` has an `updated_at` trigger. No RLS — single-user app with service key auth.

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (bypasses RLS) |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for classification |
| `TWILIO_ACCOUNT_SID` | For SMS | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For SMS | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | For SMS | Twilio sender number |
| `USER_PHONE_NUMBER` | For SMS | PDM phone number for review notifications |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | For inbound | Mailgun webhook signature verification |
| `RELAY_EMAIL_ADDRESS` | For inbound | The forwarding address (filtered from To/CC) |
| `AIRTABLE_API_KEY` | For sync | Airtable personal access token |

The app runs without Twilio/Mailgun/Airtable — those features degrade gracefully. Supabase and Anthropic are required.

## Sync Rules — What to Edit Where

| If you want to change... | Edit in... | Why |
|--------------------------|-----------|-----|
| Partners, programs, events, AWS relationships | Airtable, then pull via Sync button | Airtable is the catalog authority |
| Engagement status, tags, open items | Roadrunner UI, auto-pushes to Airtable | Roadrunner is the activity authority |
| Strategic fields (stakeholders, plans, dates) | Airtable directly | Roadrunner never touches these fields |
| Engagement current_state | Either — Roadrunner evolves it from emails | Claude updates on each classified email |
| Notes on Airtable Partner Engagements | Both — marker-separated sections | `=== Roadrunner Activity Summary ===` markers protect manual content |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Seed reference data
npm run seed -- data/seed-programs-v2.json
npm run seed -- data/seed-events.json

# Build for production
npm run build
```

### Migrations

Migrations are in `supabase/migrations/` numbered sequentially. Apply via the Supabase SQL editor or CLI:

```bash
supabase db push
```

### Deploy

Push to `main` triggers Vercel auto-deploy:

```bash
git push origin main
```

## Roadmap

Completed and pending work tracked in `docs/goal-state.md` and `decisions.md`.

**Completed recently:**
- ~~Meetings sync: Roadrunner → Airtable push~~ ✅
- ~~ICS calendar attachment parsing for meeting extraction~~ ✅
- ~~Partners as first-class entity with catalog sync~~ ✅
- ~~Sync architecture documented~~ ✅

**Pending:**
- Classifier prompt refinement: inject partner/relationship contact emails for deterministic matching
- Tag filter chips on engagements list page
- Admin page for program/event management (currently seed-only)
- Drop legacy `summary` column (superseded by `current_state`)
- Audit and remove unused debug routes
- Populate partner contact emails in Airtable for deterministic matching
