# Roadrunner Goal State

## What Roadrunner Is

AI-powered email classification and engagement tracking for AWS Partner Development Managers. Forward a partner email to Mailgun, Claude AI classifies it into a structured engagement with participants, entity links, and a living summary, then syncs everything bidirectionally with Airtable.

## Current State

- 87 migrations, 17 active tables, 36 API routes, 14 UI pages, 453 passing tests (0 failures), tsc --noEmit passes clean, 39 components, 173 db functions, decisions through #456
- Human-guided intake pipeline fully operational: webhook → mechanical partner detection → ICS partner backfill → inbox triage (with unknown partner picker) → single-phase AI synthesis (decisions #223-252)
- Meetings Motion complete (decisions #253-259): 10 interaction-based meeting types, recurring meeting engine with auto-spawn, series tracking via self-referential FK, RecurrenceEditor UI, synthesis-on-link, conference boilerplate pre-split fix, ICS multi-VEVENT guardrail confirmed
- AI Brain Overhaul Phases 1-3 complete (decisions #260-269): goal field eliminated (migration 069), condensed columns on engagements + meeting_notes (migration 068), meeting summarization restructured with scoped context builder, structured output (Discussion/Decisions/Key Context), condensed 3-5 bullet digest, non-redundancy with tasks
- Phase D cleanup complete: dead tests deleted, stale assertions fixed, dead types/routes removed
- Entity model fully rewritten with ring architecture (Catalog → Activity → People → Posture) in docs/entity-model.md
- Documentation consolidated: 6 docs total (CLAUDE.md master orientation, entity-model.md schema reference, ai-call-map.md AI call reference, north-star.md vision spec, goal-state.md status, decisions.md through #387)
- Dead weight cleaned: notes table dropped (migration 061), orphaned components removed (PillGrid, CalendarCard, TableList, SyncStatus), decisions.md merged from two files into one
- Zero polymorphic tables: entity_links replaced with typed junction tables (migration 065, decisions #221-222), later dissolved at engagement level (migration 081, decision #363) — programs/events now partner-level only via Ring 3
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
- Plan 2 created (16 tasks, 4 phases: Foundation, Recurrence Overhaul, People Page, Today Layout). 3 engagement junction tables dissolved (migration 081, decision #363). Email uniqueness enforced at DB level (migration 080, decision #361). Meeting data fully standardized (decision #365)
- Case-insensitive email uniqueness enforced at DB level (migration 080, UNIQUE(lower(email)), decision #361). All 3 insertion paths normalize to lowercase
- PDM excluded from engagement contributors via isUserEmail() filter (decision #362)
- Engagement-level program/event junctions dissolved (migration 081, decision #363). Tables: 20 → 17. Programs/events connect at partner level only via Ring 3
- program_name synced to enrollment records from AT text field (decision #364). Primary display label; eliminates "Unlinked" on 58/80 records
- Meeting types backfilled (11 nulls → 0) and names standardized — "Partner Sync" → "Partner Cadence" across 12 meetings (decision #365). 2 test records deleted (49 meetings)
- SKILL.md restructured into three-layer design system: Visual Foundations, Interaction Patterns, Data Visualization Patterns (decision #366)
- 5 active engagements processing real email data (Nozomi Networks, Spacelift x3, Qualys)
- All Airtable push/delete calls awaited (no fire-and-forget)
- Plan 2 complete (17 tasks, 4 phases): Recurrence Experience (SeriesDisplay, SeriesTimeline, SeriesActions, simplified RecurrenceEditor, anchor_day snap verified with 9 tests), People Page (cross-partner search/filter/create at /people), Today Page (two-column layout — meetings + tasks side by side)

## MVP Target

A system where a PDM forwards an email and Roadrunner:
1. Correctly routes it to the right engagement (or creates a new one) with high accuracy
2. Extracts participants, topics, and entity links automatically
3. Syncs the structured data to Airtable in real-time
4. Requires human review only for genuinely ambiguous cases

## What's Next

### Immediate
- Visual polish continuation — walk through every page, pick up 8 parked low-severity items (junction notes, funding notes, empty states, PTRF consolidation)

### Soon
- Apply useFilterParam to remaining list pages (Tasks, Partners, People)
- Junction table ownership flip — CRUD for partner program enrollments + partner event participations in Roadrunner UI, flip sync direction from pull to push for these tables
- UI/UX redesign — partner detail four-tab reorg (Overview, Operations, Profile, People), page improvements, Today page evolution
- Airtable exit path planning — progressive flip of remaining tables to Roadrunner-owned
- Programs page UI polish — consider grouping by Category with Subtype sections
- People page evolution — alphabetical grouping or pagination for 227+ participants

### Later
- Project genesis kit — extract Roadrunner's scaffolding (CLAUDE.md, skills, templates, three-layer architecture) into a reusable starter template
- Structural checker scripts — automated grep-based architecture enforcement (no rogue queries, no local VALID_* constants, route line count limits)
- Task backfill — 41 tasks without engagement_id need linking via meeting→engagement chain
- Meeting data cleanup — Vasion duplicate series merge, standalone-to-series conversions (KnowBe4, NinjaOne, Cloudaware)
- Email-less participant support (5 null-email participants in registry)

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
- ~~Case-insensitive email uniqueness~~ ✅ (migration 080, decision #361): UNIQUE(lower(email)), 4 duplicates merged, all insertion paths normalize
- ~~PDM excluded from engagement contributors~~ ✅ (decision #362): isUserEmail() filter in getEngagementContributors()
- ~~Engagement-level junctions dissolved~~ ✅ (migration 081, decision #363): engagement_programs, engagement_events, engagement_relationships dropped. Tables: 20 → 17
- ~~program_name synced to enrollments~~ ✅ (decision #364): AT text field → program_name column, primary display label, "Unlinked" eliminated
- ~~Meeting types backfilled and names standardized~~ ✅ (decision #365): 11 nulls → 0, 12 renames, 2 test records deleted
- ~~SKILL.md three-layer design system~~ ✅ (decision #366): Visual Foundations + Interaction Patterns + Data Visualization Patterns
- ~~Plan 2 executed~~ ✅ (decisions #367-370): 17 tasks, 4 phases — Foundation (anchor_day fix, doc cleanup, SKILL.md population), Recurrence Overhaul (SeriesDisplay, RecurrenceEditor simplification, SeriesActions, standalone-to-series, anchor snap verification, SeriesTimeline), People Page (search + filters + create), Today Layout (two-column)
- ~~Post-Plan 2 fixes~~ ✅ (decision #371): RecurrenceEditor startEditing prop, Today page container, timeline strip sizing
- ~~Program enrollment + event participation CRUD~~ ✅ (decisions #372-373): 6 API endpoints, 2 client components, inline status editing, event participations always visible
- ~~Plan 3 — Daily Driver MVP~~ ✅ (20 tasks, 6 phases): Universal PageContainer (max-w-[1600px]), sidebar vertical distribution, useUnsavedChanges framework (7 protected surfaces), Today page 55/45 split + 12-task cap, Tasks page density, Partner detail section pairings, scope-aware recurrence editing ("this and future"), Reschedule button, simplified timeline strip, people linkability (names → /people?q=), enrollment date year formatting, full Playwright audit clean
- ~~Post-Plan 3 interactive polish~~ ✅ (decisions #381-387): RecurrenceCard consolidation (4→1 components, timeline strip killed), meeting Edit as modal (not inline), Reschedule merged into Edit modal (header: Edit+Delete only), scope-aware propagation with notes protection, People page partner badge enrichment from engagements (143 previously invisible participants), duplicate participant merge (2 pairs), defensive meeting_notes query
- ~~UNIQUE constraint on meeting_notes.meeting_id~~ ✅ (migration 083, decision #388)
- ~~Partner detection: all-message iteration + pattern-based isAWSDomain + subject-line name fallback~~ ✅ (decisions #389-391, new /api/inbox/redetect route)
- ~~Inbox discard: group-aware deletion~~ ✅ (decision #392, uses getMessagesForInboxItem)
- ~~Mutation Lifecycle Framework + shared utilities~~ ✅ (decisions #393-395, useMutation hook, InlineError component, useNavigationGuard hook, SKILL.md Layer 2)
- ~~App-wide mutation conformance — 42 surfaces, zero gaps~~ ✅ (decision #396, zero silent failures, zero unconfirmed destructive actions)
- ~~Session template and workflow redesign~~ ✅ (decision #397, single diagnostic, plan template with pre-flight and checkpoints)
- ~~useNavigationGuard full rollout~~ ✅ (decisions #398-399, 18 components guarded, per-component approach)
- ~~Engagements list page + sidebar~~ ✅ (decisions #400-402, status grouping, partner filter, topic subtitle, Secondary tier)
- ~~Completed tasks visibility~~ ✅ (decision #403, separate DB function, bidirectional toggle, 30-day window)
- ~~Visual conformance audit~~ ✅ (decision #404, all 14 pages pass SKILL.md at 1280px)
- ~~Programs catalog restructure~~ ✅ (decisions #406-412): Two-level taxonomy (Category × Subtype), 6 new structured fields, 13 new Service Ready records, lifecycle corrections, boilerplate extraction, full sync pipeline overhaul, 72→85 records, migration 084
- ~~Partner Programs junction cleanup~~ ✅ (decisions #413-414): Type and AWS Stakeholder columns dropped (migration 085), enrollment type now derived from linked program's category/subtype, 9 files cleaned
- ~~Events catalog restructure~~ ✅ (decisions #415-422): Format taxonomy 8→7 (webinar/roundtable added, deadline/review_cycle/kickoff removed), 3 new fields (event_url, internal_links, archived), partner_day boolean dropped, 19 Partner Day Dates populated, 8 new records (3 PartnerEquip, 2 third-party, 3 webinar series), 5 archived. 44→50 event records. Migration 086
- ~~Partner Events junction restructure + first seeding~~ ✅ (decisions #418-420): Sponsoring extracted to orthogonal checkbox, status lifecycle redesigned (5 values), contacts_attending removed, 5 partner event participation records seeded (Progress → 5 summits). 0→5 records
- ~~MDF funding expiry indicator~~ ✅ (decision #423): Derived MDF window on Specialization enrollment rows — "MDF through Dec YYYY" or "MDF expired Dec YYYY", computed from date_achieved + 1 calendar year
- ~~Sync audit + fixes~~ ✅ (2026-04-06): Ring 3 orphan cleanup (deleteOrphanedRows helper for all 5 posture tables), null program_id guard on enrollments, meeting push fires on every PUT (not just engagement_id change), notes auto-complete (scheduled→completed on note creation), bulk meeting sync gate removed (all meetings push, not just engagement-linked), dead sync constants removed (RELATIONSHIPS_TABLE, RF, VALID_RELATIONSHIP_TYPES). Migration 087 backfills 48 meetings with notes to completed status
- ~~Today page Open Notes shortcut~~ ✅ (2026-04-07): Separate Link to /meetings/{id}?notes=true, auto-scrolls or auto-creates notes on arrival
- ~~InlineError consistency~~ ✅ (2026-04-07): MeetingEditModal, EngagementActions, EnrollmentSection modal form standardized to InlineError component
- ~~Dead code cleanup~~ ✅ (2026-04-07): SlideOverPanel, StatusBadge, useMutation hook deleted (orphaned). ROLE_PRIORITY export removed. Empty src/components/engagement/ directory removed
- ~~Idempotent note creation~~ ✅ (2026-04-08, decision #424): POST /api/notes checks for existing note before insert, returns with 200. Module-level Set guards against React strict mode double-mount race condition
- ~~Plan 5: Validation Centralization~~ ✅ (2026-04-08, decisions #425-429): 12 VALID_* constants centralized in validation.ts, validateEnum() helper, resolvePartnerByName() extracted to db layer, cleanSubject() extracted to format-utils, all 10 DELETE responses normalized to { deleted: true }
- ~~Plan 6: Data Layer Centralization~~ ✅ (2026-04-08, decisions #430-431): 79 rogue supabase.from() queries extracted from 23 files into 46 new db functions (114→160 total). Zero direct Supabase access remains outside db/ and sync/. CreateTaskInput.meeting_note_id made nullable. Project rule enforced: all queries in src/lib/db/
- ~~Plan 7: Services Layer Extraction~~ ✅ (2026-04-08): Business logic extracted from 4 oversized routes into dedicated service files. inbound/route.ts 464→120, reviews/resolve 192→114, engagements/merge 172→65, meetings/[id] 219→169. 5 service files created/extended (inbound-pipeline.ts, inbox-resolver.ts, engagement-merge.ts, meeting-lifecycle.ts, mailgun-helpers.ts) + meeting-recurrence.ts extended. Three-layer architecture complete: UI → thin routes → services → db → Supabase
- ~~Sync audit + orphan cleanup~~ ✅ (2026-04-08, decisions #424-429): Ring 3 orphan cleanup added, null program_id guard, meeting push broadened, notes auto-complete, migration 087 backfill, bulk sync gate removed. All 10 sync flows verified 1:1
- ~~Backend SKILL.md created~~ ✅ (2026-04-08, decision #438): .claude/roadrunner-backend/SKILL.md — three-layer architecture, data layer rules, route patterns, validation, sync
- ~~Frontend SKILL.md renamed + updated~~ ✅ (2026-04-08, decision #439): roadrunner-ui → roadrunner-frontend, phantoms removed, 5 patterns added
- ~~Plan completion template~~ ✅ (2026-04-08, decision #440): Zero-edit closeout command
- ~~Dead code cleanup~~ ✅ (2026-04-08, decision #442): 3 orphaned files, empty dir, dead sync constants, 8 any types
- ~~InlineError consistency~~ ✅ (2026-04-08, decision #441): Mandatory across all 42 mutation surfaces
- ~~Open Notes shortcut~~ ✅ (2026-04-08, decision #432): ?notes=true deep-linking from Today page
- ~~Idempotent note creation~~ ✅ (2026-04-08, decision #431): Race condition fix with module-level Set guard
- ~~AI naming bug fix~~ ✅ (2026-04-13, decision #443): Removed engagement_name persistence from persistClassificationResult()
- ~~Inbox body preview~~ ✅ (2026-04-13): 2-line body_text preview on inbox cards
- ~~Engagement picker enrichment~~ ✅ (2026-04-13): Status dot, topic, relative time added to picker
- ~~Plan 8: Engagement Message Management~~ ✅ (2026-04-13, decisions #443-447): 6 tasks, 2 phases — select messages/meetings, move between engagements or to inbox, discard, cascade + dual re-synthesis. 4 new files, 3 new components, 13 new db functions
- ~~Discard action in management modal~~ ✅ (2026-04-13, decision #446): Hard-delete with FK-safe cascade + source re-synthesis
- ~~Pick Partner repositioned~~ ✅ (2026-04-13): Moved from badge to right-aligned action button
- ~~Inbox count fix~~ ✅ (2026-04-13, decision #447): Header shows group count matching visible cards
- ~~Session templates updated~~ ✅ (2026-04-13): Backend SKILL.md references added to all 5 templates
- ~~Partner detail funding polish~~ ✅ (2026-04-16, decisions #448-451): Canonical vocabulary (Allocated/Spent/Remaining), null handling, labeled Sponsor badge, remaining color fix
- ~~Today page meeting filtering~~ ✅ (2026-04-16, decision #452): Hide cancelled/no_show + completed-with-complete-notes from Today
- ~~List filter persistence~~ ✅ (2026-04-16, decision #453): useFilterParam hook, applied to Engagements + Meetings
- ~~Origin-aware back links~~ ✅ (2026-04-16, decision #454): from param convention on engagement detail
- ~~Meetings page day grouping~~ ✅ (2026-04-16, decisions #455-456): Upcoming grouped by day with weekday headers, cancelled filtered, URL-persisted type filter

## Architecture Principles

- **Curated input** — PDMs forward what matters. Route, don't filter.
- **Engagement hub** — Everything connects through engagements. One resolution path.
- **Constrained intelligence** — Match to existing entities, never fabricate.
- **Data ownership** — Airtable owns catalogs, Roadrunner owns activity.
- **Measure twice, cut once** — Diagnose before building, plan before implementing.
- **Airtable is the removable plug** — Roadrunner must function standalone. Airtable is a sync connector today, a visual mirror tomorrow, and optional eventually. Every feature must work without live Airtable calls. Catalog data syncs into Supabase; the UI reads from Supabase only.
