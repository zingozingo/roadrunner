# Architectural Decisions

> Append-only log of significant design and implementation decisions.

---

### Decision 90: Eliminate Single-Engagement Routing Shortcut

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Removed all logic that treated partners with one engagement differently from multi-engagement partners. The number of existing engagements has zero influence on routing.

**Context:** Spacelift Solution Spotlight emails (marketing campaign) were merged into DevOps/OpenTofu Collaboration (technical integration) because Phase 1 Step 3 said "partner has one engagement + content is consistent → route there." This short-circuited before new-engagement detection.

**Rationale:** The count of existing engagements is a database state fact, not a classification signal. A partner having one engagement means you've tracked one initiative — it says nothing about whether the current email belongs to it. Every email must be evaluated by comparing content against engagement context.

**Impact:** Prevents an entire class of wrong-merge bugs. Every email now goes through content evaluation regardless of engagement count.

---

### Decision 91: Enrich Phase 1 Engagement Index with Semantic Context

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Added current_state (truncated to 150 words), topic, and goal fields to each engagement entry in the Phase 1 engagement index.

**Context:** Phase 1 had participant emails, pillar, entity links, and last subject — but no semantic description of what the engagement is actually about. This was insufficient to distinguish engagements with the same partner but different topics.

**Rationale:** The current_state already exists in the DB from Phase 2 analysis. Adding it to Phase 1 context gives the classifier "smarter folder labels" without duplicating Phase 2's deep analysis role. Token cost is minimal (~150 words per engagement).

**Impact:** Phase 1 can now distinguish "Technical collaboration with AWS IaC team on OpenTofu" from "Marketing webinar campaign with Bridge Partners" for the same partner. Directly addresses multi-engagement disambiguation.

---

### Decision 92: Rewrite Decision Framework — Content Evaluation Required

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Replaced 7-step "stop when confident" framework with 6-step framework requiring content evaluation for every routing decision.

**Context:** The old Step 3 short-circuited on partner match alone, bypassing new-engagement detection entirely.

**Rationale:** Ordered "stop when confident" steps are dangerous when early steps use weak signals (partner match). The new framework flows: identify partner → evaluate against ALL engagements → route/new/review. No early exits.

**Impact:** Confidence now reflects actual content match quality. Partner identification alone can never produce high confidence.

---

### Decision 93: Fallback Meeting Detection from Plain Text

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Built two-tier fallback detector for meeting invites that arrive without VCALENDAR data. Tier 1: Outlook "Original Appointment" blocks. Tier 2: Generic When: + Where: patterns. Source type: "body_parsed".

**Context:** Outlook strips ICS when forwarding meeting invites, converting structured calendar data to plain-text blocks. All three existing ICS detection paths (body-calendar, inline body-plain, file attachment) require BEGIN:VCALENDAR. Forwarded meetings were treated as regular emails.

**Rationale:** Can't control how Outlook forwards. The fallback creates real meeting records so the existing pipeline (Phase 1 Meeting Data hint, engagement linking) works without modification. ICS path still takes priority when available.

**Impact:** Meeting invites forwarded from Outlook now get detected and processed. 39 new tests. Requires real-data validation next session.

---

### Decision 94: Apply Unapplied Migration 046

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Run migration 046 against production to add `sequence` (INTEGER) and `is_recurring` (BOOLEAN) columns, drop stale `meeting_type` column, and update status CHECK constraint on meetings table.

**Context:** All meeting creation (ICS and fallback) was silently failing with "Could not find the 'is_recurring' column" error. Migration existed in codebase since session ~March 1 but was never applied to production Supabase.

**Rationale:** The code, types, tests, and schema_live.sql all depended on these columns. Applying the migration was the correct fix vs stripping columns from code (which would touch ICS parser, meeting creation, types, and UI).

**Impact:** Immediately unblocked all meeting creation. Three meetings created and visible within minutes of applying.

---

### Decision 95: Decouple Meeting Linking from content_type

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Remove the `content_type === "meeting_invite"` gate from meeting-to-engagement linking in `classifier.ts` (auto-assign path) and `reviews/resolve/route.ts` (confirm + assign_existing paths). Link meetings unconditionally when a meeting record exists for a classified message.

**Context:** The gate caused meetings to stay orphaned (no `engagement_id`) whenever Claude classified the message as `"engagement_email"` or `"mixed"` instead of `"meeting_invite"`. Only 1 of 3 test meetings got linked because the other two had different content_type labels.

**Rationale:** Whether a meeting record exists is a hard fact (ICS was parsed), not something Claude should have veto power over. `content_type` remains as informational metadata for display/analytics, not as a gate for data linking.

**Impact:** Eliminates entire class of orphaned meeting bugs. Every meeting with a `message_id` will be linked to its classified engagement.

---

### Decision 96: Meetings Inherit Partner from Engagement

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** `linkMeetingToEngagement()` now queries the engagement's `partner_id` and `partner_name` and sets both on the meeting record, overriding any attendee-based partner matching from initial creation.

**Context:** Meetings were showing "Partner: —" on the detail page because `createMeetingFromICS()` couldn't match a partner from attendee domains (e.g., when only Amazon emails were on the invite). But the engagement already knew its partner.

**Rationale:** Engagement-hub architecture — the engagement is the single authority for partner, program, event, and relationship connections. Meetings are timeline events within engagements and inherit through that connection.

**Impact:** Meeting detail pages now show correct partner and engagement links without requiring partner email addresses in the ICS attendee list.

---

### Decision 97: Remove Fallback Meeting Detector

**Date:** 2026-03-02
**Status:** Implemented

**Decision:** Delete `meeting-detector.ts`, its test suite, `createMeetingFromFallback()`, and all calling code. ICS parsing is the sole meeting detection path.

**Context:** The fallback detector (Tier 1 Outlook Original Appointment, Tier 2 generic When/Where) was built from diagnostic analysis of what Outlook "probably" delivers, never validated against real data. It also risked false positives on emails that mention dates/times/locations without being meeting invites.

**Rationale:** With migration 046 applied, ICS parsing works correctly for both direct participant and forwarded invites. If ICS data arrives, we detect it. If it doesn't (e.g., Outlook strips it during forwarding), the email is classified normally. We don't guess.

**Impact:** Removed ~200 lines of code + 39 tests. Simplified inbound route. Test count: 427 across 14 suites (down from 466/15, net cleaner).

---

### Decision 98: Create-Then-Link Pattern for Meetings Is Correct

**Date:** 2026-03-02
**Status:** Documented (no code change)

**Decision:** Maintain the current order: ICS meeting creation (step 9) before classification (step 11). The brief UI window where a meeting appears without an engagement link is accepted as a timing artifact.

**Context:** During testing, a meeting briefly appeared unlinked on the UI before classification completed and set the `engagement_id` (~20s later due to Claude API call). Initially appeared to be a bug.

**Rationale:** Creating the meeting first is safer — if classification fails, the structured calendar data is preserved. The alternative (hold creation until after classification) risks data loss. The 20-second classification window is invisible in normal usage since users don't watch the UI in real-time during email forwarding.

**Impact:** No code change needed. Documented as intentional design to prevent re-investigation in future sessions.

---

### Decision 99: Complete Meeting Entity Inheritance Through Engagement

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Remove `program_id`, `event_id` columns and `meeting_aws_relationships` junction table from meetings. All entity relationships inherit exclusively through the parent engagement.

**Context:** Meetings table carried redundant FK columns for program and event, plus a junction table for AWS relationships. None were ever populated by the automated pipeline (ICS parser, classifier, Phase 2). Airtable already used lookup fields through the Engagement link for all of these.

**Rationale:** Engagement-hub model proved itself with partner inheritance (Decision #96). Extending it to all entities eliminates data inconsistency (meeting pointing to Program X while engagement points to Program Y), simplifies the meeting pipeline (no independent entity resolution), and matches Airtable's existing architecture.

**Impact:** Migration 050 created and applied. 18 files modified. Dead code removed from DB layer (5 functions), API routes, UI pages, types, and tests. 13 tables (down from 14). 427 tests maintained.

---

### Decision 100: Phase 2 Structural Improvements + Phase 1 Tightening

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Five interconnected changes to the classification pipeline: (1) Expose existing participants and entity links to Phase 2, (2) Restructure current_state instructions as decision matrix, (3) Implement 3-tier program catalog rendering with event time filtering, (4) Add `_reasoning` self-audit to entity matching, (5) Split Phase 1 Topic/Context evaluation and add negative constraints on new engagement path.

**Context:** Phase 2 was blind to its own structured state (couldn't see existing participants or entity links). current_state instructions were prose rules requiring simultaneous constraint juggling. Full catalog (65 programs, 43 events) sent to every classification. Phase 1 had a "new engagement" escape hatch with no negative constraints.

**Rationale:** Make it structurally harder for the model to be wrong, rather than asking it more persuasively to be right. Phase 2 quality feeds Phase 1 accuracy through the current_state flywheel. Each change reduces a specific failure mode: blind evolution, constraint overload, false match surface, unjustified matches, and escape hatch routing.

**Impact:** 9 files modified across two implementation commands. classifier.ts now fetches and passes existing state. Phase 2 prompt uses decision matrix. prompt-builder.ts renders 3 program tiers (42 competencies + 6 service ready compressed, ~24 detailed). Events filtered to 7-month window. Phase 1 has 7 evaluation criteria (up from 6) and explicit "NOT a new engagement" examples. 427 tests maintained.

---

### Decision 100a: Participants Are Add-Only in Phase 2

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Phase 2 can add new participants but never remove existing ones.

**Context:** Needed to decide whether Phase 2 should have full CRUD over participants or just append.

**Rationale:** Once someone is linked, they were linked for a reason. AI removing participants risks pruning legitimate contacts. Manual removal remains available for corrections.

**Impact:** Phase 2 prompt instructs "only extract NEW people not in the existing list."

---

### Decision 100b: Entity Match _reasoning Preserved in JSONB, Not Stripped

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** The `_reasoning` self-audit field is not stripped from `parsePhase2Response`. It flows through as extra untyped JSON.

**Context:** Needed to decide where to strip the debugging field. Options: strip in parser, strip in persistence, or don't strip.

**Rationale:** TypeScript interfaces act as natural filters — downstream code only accesses typed fields. Keeping `_reasoning` in the JSONB provides free debugging data. No type changes or parser changes needed.

**Impact:** `classification_result` JSONB in `approval_queue` and `messages` contains entity match justifications for debugging.

---

### Decision 100c: Program Catalog Rendered in 3 Tiers

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Competencies (42) and Service Ready (6) rendered as compact lists with shared headers. Structurally unique programs (~24) retain full detail.

**Context:** All competencies follow identical lifecycle, MDF, requirements, and renewal patterns. Only the subject domain differs. Sending 42 near-identical entries with full boilerplate created false match noise.

**Rationale:** Reduce false match surface. Model can match any competency by name + ID without wading through 42 copies of identical boilerplate. Token savings are secondary to accuracy improvement.

**Impact:** `buildProgramsSection` in `prompt-builder.ts` now filters by program type and renders accordingly.

---

### Decision 100d: Events Filtered to 7-Month Window

**Date:** 2026-03-03
**Status:** Implemented

**Decision:** Phase 2 only receives events within past 30 days through future 6 months (plus events with no date set).

**Context:** 43 events in catalog, most are international AWS Summits unlikely to appear in partner emails. Stale events are noise.

**Rationale:** Every irrelevant event is a potential false match. Time filtering removes the vast majority of noise while preserving any event that could plausibly be referenced.

**Impact:** Event filtering applied in `buildPhase2Context` before calling `buildEventsSection`.

---

## 2026-03-07 — Meeting Notes Feature

### Decision 101: Meeting Notes Module Lives Inside Roadrunner

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** Notes feature built as new tables/routes/pages within the existing Roadrunner codebase, not a separate application.

**Context:** Steven needed meeting note-taking ASAP and considered a separate lightweight app. Evaluated shared infrastructure needs (Supabase, Airtable sync, Claude API, UI shell, partner catalog).

**Rationale:** Both systems need the same data (partners, engagements, contacts), same infra (Supabase, Vercel, Claude API), and same UI patterns. Separate app = re-wire all plumbing for zero benefit. "Slightly decoupled" means new tables + routes, not new deployment.

**Impact:** New tables (meeting_notes, note_tasks), 7 new API route files, 8 new page/component files — all within existing project structure.

---

### Decision 102: Partner Context Sourced from Local Supabase, Not Airtable MCP

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `buildPartnerContext()` reads exclusively from local Supabase tables. Airtable MCP is never called during note-taking or summarization.

**Context:** Steven raised concern about MCP reliability. Evaluated whether context should pull fresh from Airtable vs use synced local data.

**Rationale:** Roadrunner already syncs Airtable catalog data into Supabase (partners, programs, events, relationships). Local queries are ~50ms, always available, no MCP dependency. Catalog freshness depends on periodic sync, which is acceptable.

**Impact:** Note-taking is fast and reliable. Trade-off: context is only as fresh as last catalog sync. Running `POST /api/sync` before a notes session ensures currency.

---

### Decision 103: Two Note Types — Meeting and Seed

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `meeting_notes` table supports `note_type` 'meeting' (regular) and 'seed' (historical context dump). Same table, same AI pipeline, different prompt strategies.

**Context:** Steven has 12+ months of OneNote notes per partner that need to be ingested before taking new notes. Needed a way to bootstrap partner context.

**Rationale:** A seed is structurally identical to a meeting note — it has raw_notes, gets AI-summarized, produces tasks and flags. Only the prompt changes (chronological narrative vs single meeting summary). Separate tables would duplicate everything for no benefit.

**Impact:** Seed notes become foundational context. `getRecentNoteSummaries()` returns seeds first, then meeting notes by date — so Claude always has the historical base when summarizing new meetings.

---

### Decision 104: Three-Phase Note Workflow

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `/notes/new` is a single-page state machine with three phases: Setup (partner selection + context load), Note-taking (textarea + auto-save + context sidebar), Review (AI summary edit + task management + flags).

**Context:** Needed a flow that works during live calls — fast to start, unobtrusive during note-taking, structured review after.

**Rationale:** No page reloads between phases keeps the experience fluid. Draft is created at Phase 1→2 transition so auto-save has an ID immediately. Phase 3 is optional — user can save as draft and summarize later.

**Impact:** 4 sub-components (NoteWorkspace, ContextSidebar, PreviousNotes, TaskEditor) manage the phases. Auto-save interval set up in Phase 2, cleaned up on unmount.

---

### Decision 105: Context Snapshot at Summarization Time

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `context_snapshot` JSONB field stores the full PartnerContext object that was fed to Claude when summarization ran.

**Context:** Partner data changes over time. Need to know what Claude knew when it produced a specific summary.

**Rationale:** Without snapshots, you can't audit AI decisions retroactively. With snapshots, you can always compare "what did Claude see?" vs "what's true now?" — critical for the eventual slot registry feature.

**Impact:** Adds ~2-5KB per note. Stored as untyped JSONB (same pattern as `classification_result` on messages).

---

### Decision 106: Tasks as First-Class Entities with Owner Classification

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `note_tasks` table with owner enum ('me', 'partner', 'aws_internal'), separate from `meeting_notes`. CASCADE delete on parent note.

**Context:** Steven needs to track what he owes vs what partners owe vs what AWS internal teams owe. Currently tracks this mentally or in scattered OneNote lists.

**Rationale:** Separate table enables cross-partner task queries (`getOpenTasks`, `getTasksByPartner`) without parsing JSONB. Owner classification enables the "what do I owe?" and "what am I waiting on?" views. `source` field distinguishes fresh tasks from seed-extracted historical ones.

**Impact:** `/api/notes/tasks` endpoint provides cross-cutting task view. Foundation for future task dashboard and Airtable push.

---

### Decision 107: AI Gap Detection via Typed Flags

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** `ai_flags` JSONB with typed flags: 'gap' (missing/contradictory data), 'intel' (partner intelligence), 'question' (ambiguous items), 'followup' (next meeting items).

**Context:** Steven described wanting the AI to notice when notes mention something that's missing from Airtable (e.g., "they use Tackle" but CRM Status field is empty).

**Rationale:** Structured flag types enable future automation — gaps can trigger Airtable update prompts, intel can auto-populate partner fields, followups can seed next meeting agendas. For MVP, flags are displayed as colored cards in the review phase.

**Impact:** Foundation for the "slot registry" vision. AI compares notes against partner context and surfaces discrepancies proactively.

---

### Decision 108: Auto-Save with 30-Second Interval

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** Draft created on "Start Taking Notes" click. Raw notes auto-saved via PUT every 30 seconds and on browser tab switch (`visibilitychange` event). Subtle save indicator.

**Context:** Notes are taken during live calls. Browser crash or accidental tab close would lose everything without auto-save.

**Rationale:** 30 seconds balances data safety vs API load. Saving on visibility change catches the "laptop lid close" and "switch to screen share" scenarios. Creating the draft first (POST) gives us an ID for all subsequent PUTs.

**Impact:** Notes are never more than 30 seconds stale. No explicit "save" action needed during note-taking.

---

## 2026-03-07 — Partner Profile Enrichment

### Decision 109: Partner Profile Enrichment for AI Context

**Date:** 2026-03-07
**Status:** Implemented

**Decision:** Added 7 fields to Supabase partners table (architecture, listing_types, pricing_model, isva_status, deployed_on_aws, prm_status, crm_status) synced from Airtable, exposed in AI meeting notes prompts, context sidebar, and partner detail page UI.

**Context:** The AI summarizer had a significant context gap — it knew partner name/segment/what they do, but not deployment model, listing types, pricing, or program statuses. These fields are critical for intelligent gap detection (e.g., "notes mention a new SaaS listing but current Listing Types only shows AMI").

**Rationale:** All 7 fields already existed in Airtable with rich data for all 21 partners. Adding them to the sync layer (field-maps.ts + pull.ts), context builder (notes-context.ts), and partner detail page was a focused additive change. No new tables, no new routes — just enriching existing data flow. Multi-select fields (listing_types, pricing_model) use TEXT[] arrays matching the existing focus_area pattern.

**Impact:** Migration 052, sync field-maps updated (7 new Airtable field ID mappings), context builder enriched (formatContextForPrompt includes architecture/listings/pricing/statuses), partner detail page enhanced (new "Partner Profile" card with colored badges), notes context sidebar updated. Every AI summarization call now sees the full partner operating model.

---

## 2026-03-08 — Meeting Notes Summarizer Redesign

### Decision 110: Unified Summarizer Prompt

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced two separate prompts (MEETING_SYSTEM_PROMPT, SEED_SYSTEM_PROMPT) with one unified SYSTEM_PROMPT + NOTE_TYPE_MODIFIER object.

**Context:** Two prompts with different section structures created maintenance burden and artificial divergence. Seed vs meeting is only a temporal scope difference.

**Rationale:** One prompt is easier to tune, test, and evolve. Note type modifier is a 2-line inline string replacement (<<NOTE_TYPE>>), not a separate code path.

**Impact:** Single prompt in notes-summarizer.ts. All future prompt improvements apply to both note types automatically.

---

### Decision 111: Kill AI Flags, Flat Prose Summaries

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Removed 4-category AI flags (gap/intel/question/followup) from prompt output and detail page UI. Summary format changed from rigid markdown sections to concise flat prose with optional bullet points for 3+ item lists.

**Context:** AI flags were generating speculation ("Appgate making significant investment with re:Invent sponsorship — indicates strong commitment"). Summary sections (## Key Discussion Points, ## Decisions Made, ## Updates/Status Changes) forced arbitrary categorization.

**Rationale:** The AI's job is to extract and organize, not analyze. Future intelligence comes from controlled slot registry with defined partner requirements, not open-ended speculation. Summaries should read like a quick Slack recap, not a report.

**Impact:** flags field in NoteSummaryResult always returns []. ai_flags JSONB column preserved in DB for backward compatibility but no longer populated. AI Flags section removed from note detail page.

---

### Decision 112: Task Extraction with 4-Step Contact Matching

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** AI resolves mentioned names against known contacts list using 4-step priority: (1) Match to known partner contacts → owner: "partner", (2) PDM self-reference → owner: "me", (3) Unknown name → capture name, classify from context, (4) No owner identifiable → default to "me".

**Context:** Previous prompt said "owner_name: specific person name if mentioned, null otherwise" with no instruction to match against known contacts.

**Rationale:** Named, role-aware task ownership is the foundation for cross-partner task visibility and accountability tracking.

**Impact:** Tasks now have accurate owner_name matched to known contacts (e.g., "Jackie" → "Jackie Funk", Alliance Lead).

---

### Decision 113: Task Done-State Gate with Examples

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Added strict guardrail: "Before creating each task, apply this test: Could someone check this off as DONE in a single action or short effort? If not, it's a goal — do not create a task." Includes 4 negative examples (goals) and 4 positive examples (tasks). Bias: "When in doubt, do NOT create the task."

**Context:** AI was generating vague goals as tasks ("Ramp up marketplace presence", "Help partner target FSI accounts", "Identify which competencies to pursue").

**Rationale:** Polluted task lists erode trust faster than missing tasks. Users can manually add tasks; they can't easily filter AI noise. Eventually partner plans and slot registry will track strategic goals separately.

**Impact:** KnowBe4 seed went from 4 vague tasks to 1 real task. Dramatically cleaner task extraction.

---

### Decision 114: Task Materialization on Summarize

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** AI-extracted tasks become real note_tasks rows immediately when summarization completes, not deferred to finalization.

**Context:** Previous flow saved ai_tasks as JSONB blob on meeting_notes record but never created note_tasks rows. Detail page queried note_tasks, found none, showed "No tasks yet" even with AI-extracted tasks.

**Rationale:** Decision #106 established tasks as first-class entities. Deferring materialization contradicted this — tasks existed only as unstructured JSON.

**Impact:** Tasks visible on detail page immediately after Summarize. Re-summarization deletes only origin='ai' tasks, preserving manual tasks.

---

### Decision 115: Origin Column for Task Provenance

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Added origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('ai', 'manual')) to note_tasks table (Migration 053).

**Context:** Needed to distinguish AI-generated tasks from manually-added tasks to enable safe re-summarization (delete AI tasks without losing manual ones).

**Rationale:** Considered alternatives: (a) delete all tasks on re-summarize (loses manual), (b) only re-create if no manual tasks (fragile). Origin column is cleanest — explicit provenance, no ambiguity.

**Impact:** Migration 053 applied. createNoteTask() accepts optional origin parameter. deleteAiTasksForNote() function added for targeted cleanup.

---

### Decision 116: Status Model Simplified to Draft/Complete

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced 3-state model (draft/summarized/finalized) with 2-state (draft/complete). Migration 054 converts existing rows.

**Context:** "Summarized" vs "finalized" distinction had no practical value — what would you do with a note that's summarized but not finalized?

**Rationale:** The act of reviewing and saving IS the finalization. Simpler mental model, fewer UI elements (removed status dropdown from detail page), cleaner filters on list page.

**Impact:** Migration 054 applied. 8 files updated. DB constraint now CHECK (status IN ('draft', 'complete')).

---

### Decision 117: Review Flow — Stacked Layout, No Tabs

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced 3-tab review phase (Raw Notes / Summary / Tasks) with stacked layout showing all content at once. Raw notes collapsible at top, summary always visible, tasks always visible below.

**Context:** Tasks were hidden behind a tab click — users couldn't see summary and tasks simultaneously to approve both.

**Rationale:** The review phase exists so the user can verify AI output before saving. Hiding tasks behind a tab defeats this purpose. One view, one approval, one Save button.

**Impact:** NoteWorkspace.tsx rewritten. ReviewTab type eliminated. "Finalize & Save" simplified to "Save".

---

### Decision 118: Task Form with Contact Quick-Pick

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Manual task add form now includes owner_name field with quick-pick buttons from known partner contacts. Partner-side contacts shown when "Partner" selected, AWS-side contacts shown when "AWS Internal" selected.

**Context:** The add form only had owner category dropdown (me/partner/aws_internal) with no way to specify the person. API already accepted owner_name end-to-end.

**Rationale:** When AI misses a task, manual add is the safety net. It needs to be fast and accurate — selecting a known contact should be two clicks, not typing from memory.

**Impact:** TaskEditor.tsx updated with contacts prop, extractName() helper, quick-pick pills. NoteWorkspace passes context.contacts through.

---

### Decision 119: PDM-Grounded Task Extraction + Deadline Rule

**Date:** 2026-03-08
**Status:** Implemented

**Decision:** Replaced generic task examples with real PDM work patterns (co-sell deliverables, Salesforce updates, portal completions, signature requests, event prep). Added explicit deadline rule: any mention of a date triggers task extraction with due_date.

**Context:** AI missed "complete partner migration portal before July 31" because it treated a deadline-bearing commitment as context. Generic examples ("Send training deck") didn't cover the breadth of PDM work.

**Rationale:** LLMs pattern-match against examples. PDM-specific examples (swap contacts in Salesforce, review briefings, submit architecture diagrams) teach the model what real tasks look like in this domain.

**Impact:** notes-summarizer.ts prompt updated. 6 positive examples, 4 negative examples, all grounded in PDM workflow.

---

### Decision 120: Entity Model as Single Source of Truth

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Created unified `docs/entity-model.md` replacing DATA-MODEL.md and FIELD-MAPPING.md. Two layers: Mermaid ERD (all 15 Supabase tables + 5 Airtable-only tables) and field-level registry with sync directions, AT field IDs, ownership badges, and UI locations.

**Context:** DATA-MODEL.md (13 tables, last updated 2026-03-02) and FIELD-MAPPING.md (field IDs only, no schema context) were diverging. Neither covered Airtable-only tables, planned connections, or the full field-level picture.

**Rationale:** One document that answers "what exists, who owns it, where does it sync, and what's planned" eliminates cross-referencing. The ERD shows relationships at a glance; the registry provides field-level precision for implementation.

**Impact:** entity-model.md is 712 lines covering all tables, all AT field IDs, sync directions, and a planned connections roadmap. DATA-MODEL.md and FIELD-MAPPING.md deprecated with pointer to replacement.

---

### Decision 121: Sync Alignment Governing Principle

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Every field on a synced table either syncs now, syncs later (documented), or gets deleted. No permanent partial sync. Tables are binary: fully synced or not yet started.

**Context:** Audit revealed engagement_type, partner_name, and ai_flags columns that existed in Supabase but had no Airtable counterpart and no sync implementation. They were dead weight masquerading as schema.

**Rationale:** Partial sync creates false confidence — developers assume a field is tracked when it isn't. The entity model registry makes sync gaps visible. If a field doesn't sync and isn't planned to, it shouldn't exist on a synced table.

**Impact:** Migration 055 drops 4 dead columns. Entity model documents every field's sync status. Future additions must declare sync intent at creation time.

---

### Decision 122: Engagement Status Expanded to 5 States

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Engagement status now supports 5 values: planned, active, blocked, completed, archived. All map bidirectionally to Airtable single-select options. STATUS_TO_AIRTABLE updated to include blocked→"Blocked" and completed→"Completed".

**Context:** STATUS_TO_AIRTABLE only mapped active→"Active" and archived→"Archived". Engagements with status "blocked" or "completed" silently fell through to the default ("Active") during Airtable push, losing status fidelity.

**Rationale:** Status is a core field for PDM workflow. If Airtable supports 5 statuses and Supabase supports 5 statuses, the sync layer must map all 5, not just 2.

**Impact:** Migration 055 adds 'planned' to CHECK constraint. sync/utils.ts STATUS_TO_AIRTABLE maps all 5 states. Airtable now accurately reflects engagement lifecycle.

---

### Decision 123: Drop engagement_type

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Removed `engagement_type` column from engagements table and TypeScript types. Pillar (Co-Sell/Co-Market/Co-Build) is the categorical axis, topic+goal are the specifics.

**Context:** engagement_type was added speculatively in migration 039 ("taxonomy TBD from real data patterns"). After 5 active engagements and months of use, it was never populated, never synced to Airtable, and never displayed in UI.

**Rationale:** Meetings have types (event format: intro call, QBR, demo, etc.). Engagements don't — they're categorized by pillar and described by topic+goal. Adding a type taxonomy would duplicate pillar's function or create a confusing second dimension.

**Impact:** Migration 055 drops column. Removed from Engagement type in types.ts. No code references existed (field was always null).

---

### Decision 124: Drop partner_name Legacy Columns

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Removed `partner_name` column from both engagements and meetings tables. All partner resolution now flows through `partner_id` FK → partners table. DB query functions return computed `partner_name` via batch FK lookup.

**Context:** partner_name was a denormalized text column written at creation time. The Airtable push layer used a name-text-to-AT-record-ID map to resolve partner links — fragile and case-sensitive.

**Rationale:** FK-based lookup is reliable, case-insensitive, and doesn't go stale when partner names change. The computed field pattern (`& { partner_name: string | null }` on return types) preserves downstream convenience without schema denormalization.

**Impact:** Migration 055 drops columns. push.ts refactored from `partnerNameToId` map to `partnerDbToAtId` map. 31 files updated across DB, sync, API, UI, and tests.

---

### Decision 125: Meeting Type Added to Supabase

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Added `meeting_type` column to meetings table with 9-option CHECK constraint matching Airtable exactly: intro_call, follow_up, qbr, demo, workshop, executive_briefing, partner_day, event_meeting, other.

**Context:** Meeting type existed in Airtable (fldGWa1MFoqoc89qC) but had no Supabase counterpart. Meetings couldn't be categorized in Roadrunner.

**Rationale:** Meeting categorization enables filtering, reporting, and AI context. The 9 options cover the PDM meeting taxonomy observed in real data.

**Impact:** Migration 055 adds column. Meeting type syncs to AT when not null. Meeting type added to Meeting TypeScript interface.

---

### Decision 126: Topic + Goal Pushed to Airtable

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Engagement topic and goal fields now push to Airtable via new fields (topic: fldDRMrtkVHOdDYVy, goal: fld1yU46baF052MHd).

**Context:** Topic and goal were extracted by Phase 2 classification and stored in Supabase since decision 107, but never synced to Airtable. PDMs couldn't see AI-generated context in their Airtable views.

**Rationale:** Topic and goal are the most concise summary of what an engagement is about. Making them visible in Airtable closes the information gap between the two systems.

**Impact:** field-maps.ts ENF updated. buildEngagementFields in push.ts includes topic and goal. AT fields created and mapped.

---

### Decision 127: Meeting Notes Pushed to Airtable

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Meeting `notes` field now syncs to Airtable Notes field (fldzGUipu36EA9rax). Organizer, sequence, and is_recurring remain RR-internal (ICS parsing plumbing, not user-facing data).

**Context:** Meetings had a notes column in Supabase but no AT sync. Other ICS-derived fields (organizer_name, sequence, is_recurring) also lacked sync — intentionally, as they're parsing metadata.

**Rationale:** Notes are user-facing content that should be visible in both systems. ICS metadata (who organized, sequence number, recurrence flag) is internal plumbing that Airtable doesn't need.

**Impact:** field-maps.ts MF updated. buildMeetingFields in push.ts includes notes when present.

---

### Decision 128: Dead Column Cleanup — ai_flags

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Dropped `ai_flags` column from meeting_notes table and removed `flags` array from `NoteSummaryResult` TypeScript type.

**Context:** ai_flags was added early in notes development for AI-generated warning flags. Decision 115 (unified AI summarizer) switched to flat prose format. The flags array was hardcoded to `[]` in the summarizer — dead code.

**Rationale:** A column that's always null and a type field that's always `[]` are noise. They mislead developers into thinking flag functionality exists.

**Impact:** Migration 055 drops column. NoteSummaryResult simplified. notes-summarizer.ts cleaned up. Route handlers no longer pass ai_flags.

---

### Decision 129: Airtable Dead Text Fields Deleted

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Deleted 4 singleLineText pseudo-link fields from Airtable: "Partner Meetings" on Partners table, "Meetings" on Programs/Events/AWS Relationships tables.

**Context:** These were plain text fields manually maintained in Airtable, predating the Roadrunner engagement-hub architecture. Real meeting connections flow through the Engagement hub: Meeting → Engagement → Partner/Program/Event/Relationship.

**Rationale:** Text fields that pretend to be links create maintenance burden and confusion. The engagement-hub architecture makes them redundant — Airtable lookup fields through the Engagement link provide the real connections.

**Impact:** No Supabase changes needed (fields were AT-only). AT base cleaned up. entity-model.md documents the real lookup field paths.

---

### Decision 130: Third Parties Handled by Participant System

**Date:** 2026-03-09
**Status:** Implemented

**Decision:** Third-party stakeholders (consultants, integrators, ISVs) are tracked via the participant system (participants + participant_links with role="third_party") and rendered to Airtable display fields at sync time. No dedicated Supabase column needed.

**Context:** Airtable has "Third Parties" multilineText fields on both Engagements and Meetings. The question was whether to add a third_parties column to Supabase.

**Rationale:** The participant system already captures third-party contacts with role attribution. Adding a denormalized text column would duplicate data and diverge from the engagement-hub principle. The sync layer computes the AT display text from participant_links at push time.

**Impact:** No schema change. entity-model.md documents the AT computed fields and their participant system source.

---

### Decision 131: Three-Tier Navigation — Pulse → Portfolio → Reference

**Date:** 2026-03-11
**Status:** Implemented (sidebar), design ongoing (full vision)

**Decision:** UI organized by workflow tiers, not data types. Tier 1 (Pulse + Inbox) = what needs attention. Tier 2 (Partners + Engagements) = core portfolio. Tier 3 (Events + Programs + Relationships) = reference catalogs. Meetings and Notes accessed through Partners/Pulse, not as standalone top-level pages (temporarily kept in sidebar during transition).

**Context:** Flat 8-item sidebar gave equal weight to all pages. PDMs think in terms of "what do I need to do" not "which data type do I want to browse."

**Rationale:** Mirrors how the data actually works — Partners and Engagements are the primary working views, everything else is context.

**Impact:** Sidebar restructured into 4 tiers with visual weight hierarchy. Home page becomes Pulse. Meetings/Notes will eventually move out of top-level nav into partner context.

---

### Decision 132: Data Rings Model — Catalog → Activity → Strategy

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** System data organized into three concentric rings. Ring 1 (Catalog): Partners, Programs, Events, AWS Relationships — AT-owned, pulled into RR, slow-changing. Ring 2 (Activity): Engagements, Meetings, Messages, Notes, Tasks, Participants — RR-owned, pushed to AT, fast-changing. Ring 3 (Strategy): Partner Programs, Partner Events, Partner Plans, Funding — AT-only today, future sync. Engagement is the connective tissue between all rings.

**Context:** Needed a mental model for how all 26 tables relate, which system owns what, and how data flows.

**Rationale:** Clear ownership prevents sync conflicts. Ring model makes it obvious where new features slot in.

**Impact:** Governs all future schema decisions, sync direction choices, and UI information architecture.

---

### Decision 133: Roadrunner Is Standalone Authority; Airtable Is Secondary

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Roadrunner must function independently. All UI reads from Supabase, never live Airtable calls. Over time, sync direction flips table-by-table (AT-owned becomes RR-owned, AT becomes read-only mirror). UI designed as if Roadrunner is the only system.

**Context:** Building for potential internal AWS adoption where Airtable wouldn't exist. Airtable is Steven's workshop/seed tool, not a runtime dependency.

**Rationale:** If any feature requires Airtable at runtime, it can't scale beyond one user. Supabase-only runtime is the only portable path.

**Impact:** No UI components make live AT calls. Catalog data must be fully synced to Supabase before features can use it. AT-only tables (Ring 3) need pull sync before Roadrunner can display them.

---

### Decision 134: Notes Require Meetings

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Every meeting note must be attached to a meeting record. No standalone notes allowed. This means meeting creation must be frictionless, including support for recurring cadences.

**Context:** Debated whether notes could exist independently. Concluded that untethered notes become a dumping ground and lose temporal context.

**Rationale:** Tying notes to meetings creates a natural chronological record, ensures the activity timeline works, and enforces a structured capture workflow. The constraint is actually liberating — it forces us to solve meeting creation friction.

**Impact:** Note creation flow changes from "pick a partner" to "pick a meeting." Need manual meeting creation for calls without ICS. Seed notes need rethinking (they were standalone by design).

---

### Decision 135: Meeting Type and Recurrence Are Independent Dimensions

**Date:** 2026-03-11
**Status:** Implemented (schema)

**Decision:** Meeting type = purpose (Partner Cadence Call, QBR, SCA Review, Executive Meeting, etc. — 9 types in DB CHECK). Recurring = boolean flag indicating the meeting is part of a repeating pattern. These combine but don't depend on each other.

**Context:** Confusion about whether QBRs and Partner Cadences were different "recurring paths." Clarified they're different types that both happen to recur.

**Rationale:** Separating purpose from pattern means the type taxonomy can grow independently of recurrence infrastructure.

**Impact:** meeting_type is manual selection from 9 options. is_recurring is a boolean. No series linking yet.

---

### Decision 136: Recurring Meeting Series Deferred; Boolean + Type Is the Bones

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Full series engine (meeting_series table, RRULE parsing, auto-occurrence generation) deferred to future session. Current state: each meeting is standalone, is_recurring boolean flag exists, meeting_type set manually.

**Context:** Recurring ICS invites send ONE invite with RRULE — Roadrunner gets one email, creates one meeting. System has no concept of "next week's occurrence." Full series support is significant build.

**Rationale:** Pulse page, partner convergence, and activity timeline all work with single-meeting model. Series adds automation but isn't prerequisite.

**Impact:** Schema ready for series_id FK when built. Recurring cadences work manually for now (each occurrence forwarded or created separately).

---

### Decision 137: Three Meeting Origin Paths

**Date:** 2026-03-11
**Status:** Design decided

**Decision:** Meetings enter Roadrunner via three paths: (1) ICS forwarding — primary, existing. (2) Cadence registration — future, "register a recurring pattern" that auto-generates occurrences. (3) Manual quick-capture — for calls without ICS (hallway chats, spontaneous calls).

**Context:** Old "Create Meeting" button was removed as too clunky. But notes-require-meetings means we need a way to create meetings for unplanned conversations.

**Rationale:** Different meeting origins have different UX needs. ICS is automated. Cadence is a one-time setup. Manual is a lightweight "I just had a call" capture.

**Impact:** Manual meeting creation needs to return to UI (lightweight, not the old full form). Cadence registration is a future feature.

---

### Decision 138: Contacts as Resolved Catalog Entity

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Participants table becomes the single contact registry for all humans in the system. partner_contacts JSONB, aws_team JSONB, and meeting attendees JSONB should all resolve against participants by email. One person = one record. UI never renders from snapshot copies when a live reference exists. Manual edits in Roadrunner win over sync.

**Context:** Contact data currently scattered across 4 storage patterns (partner_contacts JSONB, aws_team JSONB, participants table, attendees JSONB). Changing a contact's title in one place doesn't cascade to others.

**Rationale:** Single source per entity is the only way to prevent data drift. Email is natural unique key for people.

**Impact:** Major future refactor — contacts become Ring 1 catalog data. Airtable partner contacts upsert into participants during sync. Meeting attendees resolve against participants at render time. Need "manual override wins" conflict resolution.

---

### Decision 139: Resolve, Don't Duplicate — Cascading Source Updates

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Every piece of data has exactly one authoritative home. Everything else points to it via reference (FK, email lookup). When the source changes, all surfaces reflect the update without manual propagation.

**Context:** Core principle that emerged from discussing contact resolution, meeting attendees, and partner data. Currently many snapshot copies exist that drift.

**Rationale:** Duplication is the root cause of data inconsistency. In a system tracking 22 partners with dozens of contacts each, manual consistency maintenance doesn't scale.

**Impact:** Governs all future data architecture decisions. Any new feature must identify the source of each field and reference it, not copy it.

---

### Decision 140: Partner Detail Page as Convergence Point

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Partner detail page becomes the hub showing all three data rings. Profile + contacts (Ring 1), activity timeline with meetings + notes interleaved chronologically (Ring 2), tasks, engagements. Eventually strategic context from Ring 3 (programs enrolled, events attending, plan progress, financials).

**Context:** Current partner detail shows meetings and engagements in separate sections, no notes, no tasks. User has to visit 3+ pages to understand a partner's full picture.

**Rationale:** PDMs think partner-first. "How's Qualys going?" should be answerable from one page.

**Impact:** Biggest UI payoff. Requires notes query by partner, tasks query by partner (exists), merged activity timeline component. Next session priority.

---

### Decision 141: Meetings + Notes Merge in UI as Activity Timeline, Separate in DB

**Date:** 2026-03-11
**Status:** Design decided, implementation deferred

**Decision:** Meetings and notes remain structurally different in the database (meetings have attendees/ICS/time; notes have raw text/AI summary/tasks). In the UI, they appear together as a chronological activity timeline per partner. Meeting without notes = scheduled event card. Meeting with notes = expandable card showing note content.

**Context:** Debated merging vs keeping separate. Separate DB entities are correct (different fields, different creation paths). But the user experience should be unified.

**Rationale:** The user doesn't think "I want to see meetings" and "I want to see notes" separately. They think "what's been happening with this partner?"

**Impact:** Need a new unified timeline component that interleaves meetings and notes by date. Replaces current MeetingTimeline on partner detail.

---

### Decision 142: Tasks Have Optional Due Dates

**Date:** 2026-03-11
**Status:** Implemented (schema + AI extraction)

**Decision:** due_date column already exists on note_tasks. Not forced, but populated when AI extracts deadlines from notes. Tasks with due dates sort to top on Pulse.

**Context:** Confirmed that the existing column should be actively used.

**Rationale:** Low cost (column exists), high value (enables prioritized task display and future deadline alerts).

**Impact:** AI summarizer already has deadline extraction rule. Pulse page displays due dates. No schema change needed.

---

### Decision 143: UI Must Guide Workflow, Not Dump Data

**Date:** 2026-03-11
**Status:** Design principle

**Decision:** Pulse page and partner detail should make the user feel like they know what to do next. Guard rails guide workflow through what users see. Not a vertical dump of lists — structured, focused, with clear CTAs. Information density must be intentional.

**Context:** First Pulse implementation was a vertical list dump that didn't guide action.

**Rationale:** The tool should be opinionated about workflow. A PDM opening the app at 8am should immediately know: these are my meetings, these need my attention, this is what's next.

**Impact:** Pulse page needs redesign with guided workflow approach. Partner detail needs similar intentionality. Primary design challenge for next session.

---

### Decision 144: Sidebar Visual Hierarchy Needs Real Grouping, Not Gradient Fade

**Date:** 2026-03-11
**Status:** Acknowledged, redesign deferred

**Decision:** Current sidebar tier implementation (gradient text dimming) is insufficient. Doesn't communicate structure — just makes things dimmer. Next iteration needs obvious visual separation that communicates meaning.

**Context:** The gradient approach was called out as gimmicky. The navigation tier model is correct but the visual execution failed.

**Rationale:** Visual hierarchy should be self-explanatory. If you have to squint to notice the grouping, the grouping doesn't exist.

**Impact:** Sidebar needs visual redesign next session. Possibly section labels, meaningful dividers, or a fundamentally different approach.
