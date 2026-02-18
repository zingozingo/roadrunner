# Relay (Roadrunner)

AI-powered email classification and partner engagement management system for AWS Partner Development Managers. Forward a partner email → Claude AI classifies it → structured engagements appear on a dashboard.

Deployed at [roadrunner-fawn.vercel.app](https://roadrunner-fawn.vercel.app).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5, Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude API (Sonnet) |
| Email ingest | Mailgun inbound webhooks |
| Catalog sync | Airtable REST API |
| Hosting | Vercel (git push deploy) |
| Tests | Vitest |

## How It Works

```
Forward email → inbox@relay.stevenromero.dev
  │
  ▼
Mailgun webhook → Parse forwarded thread → Store messages
  │
  ▼
Claude API (single call)
  ├─ Context: engagements, partners, programs, events, relationships
  ├─ Returns: engagement match, participants, state update, open items
  │
  ▼
Routing
  ├─ ≥0.85 confidence → auto-assign to engagement
  ├─ <0.85 confidence → approval queue (resolved via Inbox UI)
  └─ Noise → skip
```

Airtable serves as the strategic portfolio hub. Catalog data (partners, programs, events, AWS relationships) is pulled from Airtable. Activity data (engagements, meetings) is pushed back.

## Documentation

| Doc | Purpose |
|-----|---------|
| [PROJECT.md](docs/PROJECT.md) | Business context, principles, terminology |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech stack, directory structure, data flow |
| [DATA-MODEL.md](docs/DATA-MODEL.md) | Entity schemas, relationships, sync architecture |
| [CLASSIFICATION.md](docs/CLASSIFICATION.md) | AI pipeline, prompt architecture, confidence routing |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, testing, adding fields/entities, workflows |
| [FIELD-MAPPING.md](docs/FIELD-MAPPING.md) | Airtable ↔ Supabase field ID reference |

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env.local

# Start dev server
npm run dev

# Run tests
npm test

# Type check
npx tsc --noEmit
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for classification |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | For inbound | Mailgun webhook signature verification |
| `RELAY_EMAIL_ADDRESS` | For inbound | The forwarding address (filtered from To/CC) |
| `AIRTABLE_API_KEY` | For sync | Airtable personal access token |

The app runs without Mailgun/Airtable — those features degrade gracefully. Supabase and Anthropic are required.

## Deploy

Push to `main` triggers Vercel auto-deploy:

```bash
git push origin main
```
