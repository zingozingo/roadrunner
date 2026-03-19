# Relay (Roadrunner)

AI-powered partner engagement management system for AWS Partner Development Managers. Forward a partner email → it lands in your inbox → you route it → Claude AI synthesizes it into structured engagement intelligence.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5, Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude API (Sonnet) |
| Email ingest | Mailgun inbound webhooks |
| Catalog sync | Airtable REST API |
| Hosting | Vercel |
| Tests | Vitest (449 tests) |

## How It Works

```
Forward email or calendar invite → inbox@relay.stevenromero.dev
  │
  ▼
Mailgun webhook → Parse forwarded thread → Store messages
  ├─ Email: split thread, extract senders, detect partner (domain matching)
  └─ Calendar (.ics): parse meeting details, detect partner (attendee matching)
        │
        ▼
Inbox (human-guided routing)
  ├─ Partner auto-detected → choose: assign to engagement / create new / discard
  ├─ Unknown partner → pick partner first, then route
  └─ Discard → hard delete
        │
        ▼
Claude AI synthesis (single call, after routing)
  ├─ Context: engagement history, partner profile, contacts, catalogs
  └─ Produces: participants, current_state, topic, goal, matched entities
        │
        ▼
Dashboard: partner pages, engagement timelines, meeting notes, tasks, AI brain
```

## Key Features

- **Human-guided intake** — you decide where emails go, AI does the deep analysis after
- **Three-layer partner detection** — email domain matching, ICS attendee parsing, manual picker
- **10 meeting types** — interaction-based (cadence, QBR, demo, executive, etc.), not pillar-based
- **Recurring meetings** — weekly/biweekly/monthly/quarterly with auto-spawn on page load
- **Meeting notes + AI summarization** — write notes, get prose summaries + extracted tasks
- **Living brain** — per-partner AI synthesis from all meetings, notes, engagements, and scratchpad
- **Engagement merge** — combine duplicates, transfer all linked data, re-synthesize
- **Bidirectional Airtable sync** — pull catalogs, push activity. AT is removable.

## Project Structure

```
src/
├── app/                    # Next.js pages + API routes (18 pages, 31 routes)
│   ├── api/                # REST endpoints (inbound, inbox, meetings, engagements, etc.)
│   └── [page]/             # UI pages (partners, engagements, meetings, inbox, tasks, notes)
├── components/             # React components (33 total)
│   ├── shared/             # Reusable (EngagementLinker, RecurrenceEditor, ContactGroup, etc.)
│   └── [domain]/           # Page-specific (InboxClient, MeetingsClient, etc.)
└── lib/                    # Core logic
    ├── db/                 # Database modules (13)
    ├── sync/               # Airtable sync layer (5 modules)
    ├── __tests__/          # Test suites (14 files, 449 tests)
    ├── email-parser.ts     # Forwarded thread splitting + conference boilerplate stripping
    ├── ics-parser.ts       # Calendar invite parsing
    ├── meeting-recurrence.ts  # Auto-spawn engine
    ├── brain-synthesizer.ts   # Per-partner AI synthesis
    ├── classifier.ts       # Engagement synthesis after routing
    └── types.ts            # 36 types/interfaces
```

## Documentation

| Doc | Purpose |
|-----|---------|
| `CLAUDE.md` | Project context for Claude Code CLI |
| `decisions.md` | Append-only architectural decision log (259 decisions) |
| `docs/goal-state.md` | Current system status and priorities |
| `docs/entity-model.md` | Complete schema — tables, FKs, Airtable field IDs |
| `docs/CLASSIFICATION.md` | Intake pipeline and AI synthesis documentation |

## Quick Start

```bash
npm install
cp .env.example .env.local   # Fill in values
npm run dev                   # Start dev server
npm test                      # Run tests
npx tsc --noEmit              # Type check
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI synthesis |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | For inbound | Webhook signature verification |
| `RELAY_EMAIL_ADDRESS` | For inbound | The forwarding address |
| `AIRTABLE_API_KEY` | For sync | Airtable personal access token |

The app runs without Mailgun/Airtable — those features degrade gracefully. Supabase and Anthropic are required.

## System Stats

| Metric | Count |
|--------|-------|
| Migrations | 67 |
| Database tables | 17 |
| API routes | 31 |
| UI pages | 18 |
| Components | 33 |
| Tests | 449 |
| Architectural decisions | 259 |

## Deploy

Push to `main` triggers Vercel auto-deploy.