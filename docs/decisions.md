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
