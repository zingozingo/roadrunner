# Roadrunner Goal State

## What Roadrunner Is

AI-powered email classification and engagement tracking for AWS Partner Development Managers. Forward a partner email to Mailgun, Claude AI classifies it into a structured engagement with participants, entity links, and a living summary, then syncs everything bidirectionally with Airtable.

## Current State

- 56 migrations, 16 DB tables, 30 API routes, 18 UI pages, 427 tests across 14 suites
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
- UI standardization complete: all list pages use standard row template (PageHeader + FilterBar + grouped single-column rows). Sidebar restructured into 5 items + collapsible Catalog. Pulse killed, `/` redirects to `/partners`. Tasks page added at `/tasks`. Sync Catalogs button on Partners page. (decisions 145-155)
- Meetings + notes merge complete: meeting detail page has inline NoteWorkspace with MeetingNotesSection client bridge. Notes accessed through meetings — /notes routes redirect to /meetings. Calendar Notes vs Meeting Notes distinction. (decisions 156-160, 166-167)
- Partner detail convergence: four-layer model (Profile → Living Context → Engagements → Activity → Tasks → Relationships). MeetingTimeline shows note status indicators. PartnerTasksSection shows open tasks. (decisions 161-162)
- Partner scratchpad: partner_context table (migration 056), PartnerScratchpad component with Enter-to-submit UX, optimistic updates. Scratchpad entries wired into AI context pipeline as "PARTNER CONTEXT (PDM NOTES)" section. ContextSidebar shows recent entries. (decisions 163-165)
- Note components shared: NoteWorkspace, ContextSidebar, PreviousNotes, TaskEditor in src/components/notes/. Partner components: PartnerTasksSection, PartnerScratchpad in src/components/partners/. (decision 158)
- Architectural planning: data rings model (Catalog → Activity → Strategy), contacts-as-resolved-entity, resolve-don't-duplicate principle (decisions 131-155)

## MVP Target

A system where a PDM forwards an email and Roadrunner:
1. Correctly routes it to the right engagement (or creates a new one) with high accuracy
2. Extracts participants, topics, and entity links automatically
3. Syncs the structured data to Airtable in real-time
4. Requires human review only for genuinely ambiguous cases

## What's Next

- Seed notes migration to scratchpad (existing seed notes → partner_context entries with source='seed_dump')
- Manual quick-capture meeting creation for calls without ICS (decision 137)
- Contact registry migration: unify participants table as single registry after UI stabilization (decisions 138, 155)
- Brain synthesis: AI reads scratchpad + note summaries, generates structured partner intelligence (source='ai_synthesis')
- UI skill doc rewrite: update references to current component architecture
- Orphaned component cleanup: PillGrid, CalendarCard, TableList, SyncStatus — verify unused and remove
- Real email testing with rewritten Phase 1 prompt (validate multi-engagement disambiguation)
- Clean up 2 orphaned meetings (1 has message_id but pre-dates fix, 1 has no message_id)
- Phase 2 prompt review through same curated-input lens
- Inbox UX redesign (sender names, assign buttons, simpler with engagement-hub model)
- ~~Meeting notes feature (replace OneNote)~~ — **Implemented** (decisions 101-108)
- ~~Sidebar visual redesign~~ — **Implemented** (decision 146)
- ~~Pulse page redesign~~ — **Killed** (decision 145)
- ~~Task dashboard view~~ — **Implemented** as `/tasks` (decision 153)
- ~~Meetings + notes merge~~ — **Implemented** (decisions 156-160, 166-167)
- ~~Partner detail convergence~~ — **Implemented** (decisions 161-162)
- ~~Partner scratchpad~~ — **Implemented** (decisions 163-165)
- ~~AI scratchpad wiring~~ — **Implemented** (decision 165)
- ~~/notes route redirects~~ — **Implemented** (decision 166)
- Meeting notes follow-ups: apply migrations 051-056 to production, seed historical OneNote data

## Architecture Principles

- **Curated input** — PDMs forward what matters. Route, don't filter.
- **Engagement hub** — Everything connects through engagements. One resolution path.
- **Constrained intelligence** — Match to existing entities, never fabricate.
- **Data ownership** — Airtable owns catalogs, Roadrunner owns activity.
- **Measure twice, cut once** — Diagnose before building, plan before implementing.
