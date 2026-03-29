# Roadrunner Goal State

## What Roadrunner Is

AI-powered email classification and engagement tracking for AWS Partner Development Managers. Forward a partner email to Mailgun, Claude AI classifies it into a structured engagement with participants, entity links, and a living summary, then syncs everything bidirectionally with Airtable.

## Current State

- 79 migrations, 20 active tables, 29 API routes, 12 UI pages, 435 passing tests (0 failures), tsc --noEmit passes clean
- Human-guided intake pipeline fully operational: webhook → mechanical partner detection → ICS partner backfill → inbox triage (with unknown partner picker) → single-phase AI synthesis (decisions #223-252)
- Meetings Motion complete (decisions #253-259): 10 interaction-based meeting types, recurring meeting engine with auto-spawn, series tracking via self-referential FK, RecurrenceEditor UI, synthesis-on-link, conference boilerplate pre-split fix, ICS multi-VEVENT guardrail confirmed
- AI Brain Overhaul Phases 1-3 complete (decisions #260-269): goal field eliminated (migration 069), condensed columns on engagements + meeting_notes (migration 068), meeting summarization restructured with scoped context builder, structured output (Discussion/Decisions/Key Context), condensed 3-5 bullet digest, non-redundancy with tasks
- Phase D cleanup complete: dead tests deleted, stale assertions fixed, dead types/routes removed
- Entity model fully rewritten with ring architecture (Catalog → Activity → People → Posture) in docs/entity-model.md
- Documentation consolidated: 6 docs total (CLAUDE.md master orientation, entity-model.md schema reference, ai-call-map.md AI call reference, north-star.md vision spec, goal-state.md status, decisions.md through #350)
- Dead weight cleaned: notes table dropped (migration 061), orphaned components removed (PillGrid, CalendarCard, TableList, SyncStatus), decisions.md merged from two files into one
- Zero polymorphic tables: entity_links replaced with engagement_programs + engagement_events (migration 065, decisions #221-222)
- Contact registry complete: 76 participants, 85 partner links, 4 dedicated join tables, sync layer auto-maintains registry — all reads and writes flow through registry, JSONB columns dropped (Decisions #182, #218)
- Shared contact rendering: ContactRow + ContactGroup components used by every contact surface, with centralized display hierarchy and role-priority sorting (Decisions #213-215)
- Tasks promoted to partner-level entities with owner_participant_id FK + engagement_id FK (decisions 170-175, 280-281). Tasks page is full command center: checkbox complete/reopen, delete with confirmation, inline description edit, meeting link, engagement linker (decision 279). AI-extracted tasks inherit engagement_id from meeting→engagement chain. Re-summarize is additive — never deletes existing tasks (decision 278). Task extraction prompt rewritten with aggressive forward/backward test (6x improvement, decision 277).
- Relationships dissolved: tables dropped (migration 077), all code removed. Individual contacts preserved in participants table
- Meeting notes: 3-mode workspace (editing → review → saved), AI summarizer with structured output + condensed digest, task extraction, engagement-scoped context, Previous Context three-tier cascade (engagement → series → empty), Re-summarize removed from saved mode (decisions 101-119, 156-167, 265-266, 284-288)
- Brain synthesis (AI Call 3): single Strategic Posture paragraph (3-6 sentences), dedicated buildBrainContext reads condensed digests + Ring 3 data (financials, enrollments, funding, goals), max_tokens 1,000, manual trigger, stored as partner_context source='ai_synthesis' (decisions 191-193, 274-275). Prompt rewritten 2026-03-27 from 4-section briefing to single paragraph. All 24 partners batch re-synthesized.
- Seed notes eliminated: note_type CHECK narrowed to 'meeting', historical context lives in scratchpad (decision 195)
- Manual meeting quick-capture: modal form on /meetings page with partner dropdown, auto-title, meeting type (decision 189)
- Manual task creation: inline form on partner detail, POST /api/notes/tasks, no meeting note required (decision 196)
- UI Overhaul complete (decisions 289-307): SKILL.md constitutional rewrite, all detail pages (partner, meeting, engagement) aligned, tasks page redesigned, sidebar minimal treatment, all list pages shell-fixed, ContextSidebar stripped, programs flattened, engagements grouped by partner. Key components: BrainSynthesis, SlideOverPanel
- Recurring meeting system fully operational (decisions #308-312): creation modal with pattern picker + auto-title, spawn engine verified end-to-end (33 meetings: 8 roots + 8 spawned + 17 one-off), is_recurring decommissioned from app code (column remains for backward compat, future migration to drop), migration 071 backfilled 8 orphaned meetings
- EngagementLinker enhanced with "Create new engagement" (decision #314): meeting detail can create engagements seeded from note condensed digest, task cascade on link/unlink (decisions #313, #315), POST /api/engagements accepts partner_id directly, PUT accepts condensed
- Task provenance redesigned (decisions #316-317): adaptive display shows engagement name (preferred) or cleaned meeting title (partner prefix stripped), partner detail gains provenance subtitles, quiet "+ eng" affordance
- Ring 3 data architecture complete (decisions #318-338): 5 new tables (partner_goals, partner_program_enrollments, partner_event_participations, partner_funding_mpopp, partner_funding_mdf), 11 new partner columns (8 financial, JVP, crm_platform, crm_notes), 5 pull sync functions, full AT field mapping. First sync: 80 program enrollments, 18 MPOPP, 8 MDF. Co-Sell Goals dissolved into partner columns. CRM restructured (crm_status→crm_platform + CHECK constraint)
- Dead component cleanup (decision #328): unused components removed. Relationships dissolved (migration 077): tables dropped, pages/routes/components deleted. Current component count: 30
- People architecture complete: 3 new AT contact fields wired (CRM Contact, AWS Contacts, Third Party Contacts), partner page People section with 3 curated groups + engagement contributors
- Relationships dissolved (migration 077): 3 tables dropped, all code removed, contacts preserved in participants
- Meeting recurrence engine: anchor_day column (migrations 078-079), calculateNextDate with anchor snapping, series management UI (Edit/Skip/End), ↻ visual indicators, create flow with anchor preview
- Today page restructured: "Open Notes" action on today's meetings, tasks grouped by partner
- Breadcrumb 404s fixed (engagement → partner), meeting type formatting via MEETING_TYPE_DISPLAY map, meeting source labels mapped
- CLAUDE.md updated with enforced verification protocol, flexible guardrails, plan completion protocol
- 5 active engagements processing real email data (Nozomi Networks, Spacelift x3, Qualys)
- All Airtable push/delete calls awaited (no fire-and-forget)

## MVP Target

A system where a PDM forwards an email and Roadrunner:
1. Correctly routes it to the right engagement (or creates a new one) with high accuracy
2. Extracts participants, topics, and entity links automatically
3. Syncs the structured data to Airtable in real-time
4. Requires human review only for genuinely ambiguous cases

## What's Next

### Next Session
- Navigation safety (unsaved changes warnings on note workspace)
- Enterprise loading states on all async operations
- Mobile sidebar behavior
- Programs page pagination or progressive disclosure (80+ items)

### Soon
- CLASSIFICATION.md full rewrite to document current pipeline
- meeting_type backfill for 16 older meetings (pre-meeting-type era, all have type=null)
- SKILL.md rewrite for agent session
- Docs checkpoint (entity-model.md field updates)

### Later
- Ring 3 CRUD UI (flip from pull-only to push when ready)
- Partner Goals population from business plans — AT table created but empty
- Finish program enrollment linking — 58/80 enrollments have null program_id (need AT linked records populated)
- Pre-meeting briefing (AI-generated)
- 41-task engagement backfill — link meetings to engagements so cascade populates task.engagement_id

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
- ~~Contact registry read rewire (17/17 JSONB→registry)~~ ✅ (decision 182)
- ~~Manual meeting quick-capture~~ ✅ (decisions 189-190)
- ~~Brain synthesis (AI Call 3)~~ ✅ (decisions 191-193)
- ~~AWS Context → AWS Stickiness rename~~ ✅ (decision 194)
- ~~Seed notes elimination~~ ✅ (decision 195, migration 063)
- ~~Manual task creation~~ ✅ (decision 196)
- ~~AT push gate fix for manual meetings~~ ✅ (decision 197)
- ~~Partner Plans → Co-Sell Goals rename~~ ✅ (decision 198)
- ~~Partner Goals table created~~ ✅ (decision 199)
- ~~Full UI overhaul — dashboard aesthetic~~ ✅ (decisions 200-209): two-column detail pages, identity bars, no-boxes default, sidebar flattened, collapsible groups, JSONB fallbacks removed, UI skill docs rewritten
- ~~schema_live.sql deprecated~~ ✅ (decision 209)
- ~~Debug route cleanup~~ ✅ (/api/debug/classify-two-phase deleted)
- ~~Contact registry migration complete~~ ✅ (decisions 210-220): semicolon parser fix, email normalization, classifier role detection, display hierarchy, ContactRow/ContactGroup shared components, contact editing removed, org_type inference, JSONB columns dropped (migration 064), ContextSidebar rewired, push.ts titles fixed
- ~~entity_links → typed junction tables~~ ✅ (decisions 221-222): engagement_programs + engagement_events replace polymorphic entity_links. Zero polymorphic tables remain. Migration 065.
- ~~Intake pipeline redesign (Phases A-D)~~ ✅ (decisions 223-249): Phase 1 AI routing killed, mechanical partner detection, inbox triage UI (assign/create/discard), engagement merge with AT cleanup, ICS partner backfill, inbox badge grouped count, unknown partner picker flow. approval_queue table dropped. Migration 066. All intake scenarios covered.
- ~~Phase D cleanup~~ ✅: Deleted ghost test files (classifier.test.ts, resolve-route.test.ts — 15 dead tests), removed ApprovalQueueItem type, deleted /api/classify stub, fixed 3 stale phase2-prompt assertions. 427 passing, 0 failures.
- ~~Inbox badge fix~~ ✅ (decision 244): Badge shows grouped count matching UI grouping
- ~~Unknown partner flow~~ ✅ (decisions 246-248): POST /api/inbox/set-partner + partner picker UI, two-step flow (pick partner → then route)
- ~~ICS partner backfill~~ ✅ (decision 243): Calendar-only forwards now propagate partner from meeting to messages
- ~~EngagementLinker~~ ✅ (decision 250): Meeting-engagement linking from meeting detail page, partner-filtered picker, AT sync on change
- ~~is_recurring passthrough fix~~ ✅ (decision 251): createMeeting() now correctly passes is_recurring to DB insert
- ~~Meetings Motion~~ ✅ (decisions 253-259): 10 interaction-based meeting types (migration 067), recurring meeting engine (auto-spawn on page load, series_id self-ref FK, unique index prevents race conditions), RecurrenceEditor UI, series navigation on detail page, synthesis-on-link (PUT triggers engagement activity refresh), conference boilerplate pre-split fix (Teams/Zoom/Webex phantom messages eliminated), ICS multi-VEVENT guardrail confirmed + tested
- ~~AI Brain Overhaul Phases 1-3~~ ✅ (decisions 260-269): AI call map diagnostic, goal field eliminated (migration 069), condensed columns added (migration 068), meeting summarization restructured with engagement-scoped context, structured output (Discussion/Decisions/Key Context), condensed 3-5 bullet digest, non-redundancy with tasks, flags removed, context_snapshot nulled
- ~~AI Brain Overhaul Phase 4~~ ✅ (decisions 270-273): Engagement synthesis rewritten to evolve-the-anchor model — ~83% token reduction (~18,550→~3,075), full message history removed, entity matching removed, condensed output added, pillar persistence bug fixed, buildPhase2Context modernized to options object, 7 orphaned functions removed
- ~~AI Brain Overhaul Phase 5~~ ✅ (decisions 274-275): Partner brain rewritten — structured 4-section executive briefing, dedicated buildBrainContext, condensed digest inputs from pyramid below, standalone meeting digests, scratchpad filtered (no ai_synthesis feedback loop), max_tokens 500→2,000, activity pattern signals
- ~~TypeScript clean build~~ ✅: All 12 pre-existing tsc errors fixed across 3 test files (mock shapes, dead field assertions, generic syntax)
- ~~AI Brain Overhaul Phase 7 — backfill~~ ✅ (decision 276): 17 notes re-summarized, 26 engagements re-synthesized, 22 partner brains re-synthesized. All 3 pyramid layers populated with real data. AT push deferred (decision 282).
- ~~Task extraction prompt rewrite~~ ✅ (decision 277): Aggressive forward/backward test, obligation language patterns, compound sentence rule. 31 tasks extracted (6x improvement).
- ~~Re-summarize made additive~~ ✅ (decision 278): Never deletes existing tasks. AI deduplicates against existing. Summary text refreshes, tasks accumulate.
- ~~Tasks page command center~~ ✅ (decisions 279-281): Checkbox complete/reopen, delete with confirmation, inline description edit, meeting link display, engagement linker. engagement_id FK added (migration 070), auto-populated from meeting→engagement chain.
- ~~Session housekeeping~~ ✅ (decision 283): Dead code, stale comments, unused test fixtures cleaned
- ~~Meeting notes 3-mode refactor~~ ✅ (decision 284): editing → review → saved. Save transitions without page reload, Save Draft removed (auto-save), Cancel button for return-from-saved
- ~~Tasks unified to sidebar~~ ✅ (decision 285): Single task display on meeting detail. Sidebar owns tasks with owner badges and "this meeting" highlight. Left column owns summary only
- ~~Previous Context three-tier cascade~~ ✅ (decision 286): Engagement → series → empty. Joins through meetings table. Self-exclusion on all tiers
- ~~Re-summarize removed from saved mode~~ ✅ (decision 287): Mode 3 has only "Edit Notes". One clear path: Edit → Summarize → Save
- ~~Task extraction prompt rewrite~~ ✅ (decision 288): Forward/backward temporal test, obligation patterns, "when in doubt extract". 31 tasks (6x improvement)
- ~~UI Overhaul — full SKILL.md alignment~~ ✅ (decisions 289-307): SKILL.md constitutional rewrite, partner detail (full-width + slide-over + brain accordion), meeting detail (workspace focus + identity bar), engagement detail (condensed digest + connected meetings + AI treatment), tasks page (Me default + recency + flat/grouped toggle), sidebar minimal treatment, ContextSidebar stripped (no gray boxes), all list pages shell-fixed + structural fixes (engagements grouped by partner, programs flattened, meetings show engagement names). 3 new components, 4 skill files rewritten
- ~~Recurring meeting system end-to-end~~ ✅ (decisions 308-312): POST accepts recurrence_pattern/recurrence_end, creation modal pattern picker + auto-title, recurring icon truth source swap (recurrence_pattern || series_id), migration 071 backfill (8 meetings), is_recurring decommissioned from app code, spawn engine verified (8 auto-spawned meetings)
- ~~EngagementLinker create-new + task cascade~~ ✅ (decisions 313-315): cascadeEngagementToTasks utility (link fills nulls, unlink clears matched), EngagementLinker "Create new engagement" with note-seeded current_state, task cascade wired server-side into PUT /api/meetings/[id]
- ~~Task provenance redesign~~ ✅ (decisions 316-317): Adaptive display (engagement > meeting > partner-only), stripPartnerPrefix utility, quiet "+ eng" affordance, partner detail provenance subtitles
- ~~Dead component cleanup~~ ✅ (decision 328): CurrentStateCard, MeetingTimeline, ExpandableList, PartnerTasksSection removed (36→32 components)
- ~~Ring 3 data architecture~~ ✅ (decisions 318-338): 5 new tables, 11 new partner columns (financials/CRM/JVP), 5 pull sync functions, AT cleanup (Co-Sell Goals dissolved, Partner field linked records, CRM restructured). 80 program enrollments + 18 MPOPP + 8 MDF syncing. Migrations 072-075
- ~~Ring 3 data wired to partner detail page~~ ✅: 5 new sections (Co-Sell Performance, Program Enrollments, Funding, Strategic Goals, Event Participations), JVP + CRM Notes wired to PartnerReferencePanel slide-over, all 14 unrendered partner fields now displayed
- ~~Brain prompt rewrite~~ ✅: 4-section executive briefing → single Strategic Posture paragraph (3-6 sentences), max_tokens 2,000 → 1,000, no specific dollar amounts, no section headers/bullets/traffic-light labels
- ~~Brain context enriched with Ring 3~~ ✅: buildBrainContext now includes financial fields (11), program enrollments, funding wallets (MPOPP/MDF), strategic goals, activity signals
- ~~Batch re-synthesis~~ ✅: All 24 partners re-synthesized with new prompt format (2026-03-27)
- ~~Merge route fix~~ ✅: meeting_notes + tasks engagement_id now cascaded during merge, source current_state enriched into target before deletion

## Architecture Principles

- **Curated input** — PDMs forward what matters. Route, don't filter.
- **Engagement hub** — Everything connects through engagements. One resolution path.
- **Constrained intelligence** — Match to existing entities, never fabricate.
- **Data ownership** — Airtable owns catalogs, Roadrunner owns activity.
- **Measure twice, cut once** — Diagnose before building, plan before implementing.
- **Airtable is the removable plug** — Roadrunner must function standalone. Airtable is a sync connector today, a visual mirror tomorrow, and optional eventually. Every feature must work without live Airtable calls. Catalog data syncs into Supabase; the UI reads from Supabase only.
