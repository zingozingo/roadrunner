# Roadrunner Goal State

## What Roadrunner Is

AI-powered email classification and engagement tracking for AWS Partner Development Managers. Forward a partner email to Mailgun, Claude AI classifies it into a structured engagement with participants, entity links, and a living summary, then syncs everything bidirectionally with Airtable.

## Current State

- 62 migrations, 18 active tables, 30 API routes, 18 UI pages, 427 tests across 14 suites
- Two-phase classification pipeline: curated-input Phase 1 (enriched engagement index) + deep-analysis Phase 2 (full thread history, entity matching, state evolution)
- Entity model fully rewritten with ring architecture (Catalog → Activity → People → Posture) in docs/entity-model.md
- Documentation consolidated: 5 docs total (CLAUDE.md master orientation, entity-model.md schema reference, CLASSIFICATION.md pipeline, goal-state.md status, decisions.md through #179)
- Dead weight cleaned: notes table dropped (migration 061), orphaned components removed (PillGrid, CalendarCard, TableList, SyncStatus), decisions.md merged from two files into one
- Contact registry: 76 participants, 85 partner links, 4 dedicated join tables, sync layer auto-maintains registry — engagement pipeline fully rewired, UI still reads JSONB contacts (17 locations across 10 files)
- Tasks promoted to partner-level entities with owner_participant_id FK (decisions 170-175)
- Relationships universally renamed from aws_relationships (decision 173)
- Meeting notes: 3-phase workspace, AI summarizer, task extraction, scratchpad wired into AI context (decisions 101-119, 156-167)
- Partner detail: four-layer model (Profile → Living Context → Engagements → Activity → Tasks → Relationships)
- 5 active engagements processing real email data (Nozomi Networks, Spacelift x3, Qualys)
- All Airtable push/delete calls awaited (no fire-and-forget)

## MVP Target

A system where a PDM forwards an email and Roadrunner:
1. Correctly routes it to the right engagement (or creates a new one) with high accuracy
2. Extracts participants, topics, and entity links automatically
3. Syncs the structured data to Airtable in real-time
4. Requires human review only for genuinely ambiguous cases

## What's Next

### This Session (in progress)
- UI audit — systematically verify every page reflects the real data model
- Contact registry UI rewire — JSONB contact reads remain (17 locations across 10 files)
- Manual meeting quick-capture form

### Next Session
- JSONB column drops (aws_team, partner_contacts, contacts)
- Brain synthesis (AI Call 3)
- Seed notes → scratchpad migration

### Soon
- Classifier prompt revision (partner-level meeting routing)
- UI Skill doc rewrite (.claude/roadrunner-ui/SKILL.md)
- Ring 3 pull sync planning

### Later
- Ring 3 pull sync (Partner Programs, Events, Plans, Funding)
- Slot registry v1
- Financial fields on partners table
- Recurring meeting series engine
- Pre-meeting briefing (AI-generated)

### Completed
- ~~Meeting notes feature~~ ✅ (decisions 101-108)
- ~~Sidebar visual redesign~~ ✅ (decision 146)
- ~~Pulse page~~ ✅ Killed (decision 145)
- ~~Task dashboard~~ ✅ `/tasks` (decision 153)
- ~~Meetings + notes merge~~ ✅ (decisions 156-160, 166-167)
- ~~Partner detail convergence~~ ✅ (decisions 161-162)
- ~~Partner scratchpad + AI wiring~~ ✅ (decisions 163-165)
- ~~/notes route redirects~~ ✅ (decision 166)
- ~~Contact registry tables + sync wiring~~ ✅ (decisions 168-169, 176-178)
- ~~Task promotion (note_tasks → tasks)~~ ✅ (decisions 170-175)
- ~~Relationship rename (aws_relationships → relationships)~~ ✅ (decision 173)
- ~~Notes table drop~~ ✅ (migration 061, decision 179)
- ~~Orphaned component cleanup~~ ✅ (PillGrid, CalendarCard, TableList, SyncStatus)
- ~~Entity model rewrite~~ ✅ (ring architecture, cascade summary, field registries)
- ~~Doc consolidation~~ ✅ (PROJECT.md, ARCHITECTURE.md, DEVELOPMENT.md absorbed into CLAUDE.md)
- ~~participant_links rewire + drop~~ ✅ (migration 062, decision 180)

## Architecture Principles

- **Curated input** — PDMs forward what matters. Route, don't filter.
- **Engagement hub** — Everything connects through engagements. One resolution path.
- **Constrained intelligence** — Match to existing entities, never fabricate.
- **Data ownership** — Airtable owns catalogs, Roadrunner owns activity.
- **Measure twice, cut once** — Diagnose before building, plan before implementing.
- **Airtable is the removable plug** — Roadrunner must function standalone. Airtable is a sync connector today, a visual mirror tomorrow, and optional eventually. Every feature must work without live Airtable calls. Catalog data syncs into Supabase; the UI reads from Supabase only.
