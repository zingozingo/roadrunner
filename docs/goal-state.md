# Roadrunner Goal State

## What Roadrunner Is

AI-powered email classification and engagement tracking for AWS Partner Development Managers. Forward a partner email to Mailgun, Claude AI classifies it into a structured engagement with participants, entity links, and a living summary, then syncs everything bidirectionally with Airtable.

## Current State

- 55 migrations, 15 DB tables, 29 API routes, 17 UI pages, 427 tests across 14 suites
- Two-phase classification pipeline: curated-input Phase 1 (enriched engagement index with participants, pillar, topic, goal, current_state, entity links) + deep-analysis Phase 2 (full thread history, entity matching, state evolution)
- Phase 1 decision framework: 6-step content-evaluation-required (no single-engagement shortcuts)
- Meeting pipeline: ICS parse → create record → classify → link to engagement (unconditional) → inherit partner → Airtable push
- Bidirectional Airtable sync: pull catalogs (partners + 7 profile fields, programs, events, relationships), push activity (engagements with topic+goal, meetings with meeting_type+notes)
- Sync alignment: all synced columns either sync now or are documented as "sync later" — no dead columns on synced tables (decisions 120-130)
- Entity model: unified docs/entity-model.md with Mermaid ERD + field-level registry (AT field IDs, sync directions, ownership badges)
- Engagement-hub architecture: meetings and entity links flow through engagements, not independently
- Contact architecture: universal JSONB format `{name, email, title, role}`, single parser (`contact-parser.ts`)
- Push reliability: all Airtable push/delete calls awaited (no fire-and-forget)
- 5 active engagements processing real email data (Nozomi Networks, Spacelift x3, Qualys)
- Meeting notes: 3-phase workspace (setup → editing → stacked review), unified AI summarizer (flat prose, no flags), 2-state status model (draft/complete), PDM-grounded task extraction with done-state gate, deadline rule, and 4-step contact matching, task materialization on summarize with origin tracking (ai/manual), manual task form with contact quick-pick (decisions 110-119)
- Partner profile enrichment: architecture, listing_types, pricing_model, ISVa/deployed status, PRM/CRM status synced from Airtable into AI context and partner detail UI (decision 109)

## MVP Target

A system where a PDM forwards an email and Roadrunner:
1. Correctly routes it to the right engagement (or creates a new one) with high accuracy
2. Extracts participants, topics, and entity links automatically
3. Syncs the structured data to Airtable in real-time
4. Requires human review only for genuinely ambiguous cases

## What's Next

- Real email testing with rewritten Phase 1 prompt (validate multi-engagement disambiguation)
- Clean up 2 orphaned meetings (1 has message_id but pre-dates fix, 1 has no message_id)
- Phase 2 prompt review through same curated-input lens
- Inbox UX redesign (sender names, assign buttons, simpler with engagement-hub model)
- ~~Meeting notes feature (replace OneNote)~~ — **Implemented** (decisions 101-108)
- Meeting notes follow-ups: apply migrations 051-055 to production, seed historical OneNote data, task dashboard view
- UI consistency pass across all entity pages

## Architecture Principles

- **Curated input** — PDMs forward what matters. Route, don't filter.
- **Engagement hub** — Everything connects through engagements. One resolution path.
- **Constrained intelligence** — Match to existing entities, never fabricate.
- **Data ownership** — Airtable owns catalogs, Roadrunner owns activity.
- **Measure twice, cut once** — Diagnose before building, plan before implementing.
