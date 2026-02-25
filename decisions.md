# Architecture Decision Log

## 2025-02-06: Project scaffold

Next.js 14 App Router + TypeScript + Tailwind. Supabase Postgres for data. Single-user app with service key auth (no RLS). Three core entities: Initiatives, Events, Programs linked via generic entity_links table. Intelligence lives in prompt, not code.

## 2026-02-07: Inbound Webhook Form Data Extraction with Fallback

**Decision:** Rewrote /api/inbound to try request.formData() first, fall back to URL-encoded text parsing. Signature fields are optional — log and warn if missing, never 406.

**Context:** Every Mailgun webhook returned 406 because the code checked for missing timestamp/token/signature fields BEFORE the signature bypass logic. formData() was also silently failing on some Vercel runtimes.

**Rationale:** Defense in depth. Mailgun's payload format can vary. Making signature fields optional during development lets us debug the rest of the pipeline independently.

**Impact:** Inbound pipeline works. Signature verification must be re-enabled with correct approach before production use.

## 2026-02-07: Events Restricted to Shared Calendar Anchors

**Decision:** Events table is ONLY for conferences, program deadlines, and shared milestones that exist independently of any initiative. Meetings, calls, and initiative-specific activities belong in the initiative summary timeline only.

**Context:** Claude created "CloudAware Cadence Call" as an Event entity from casual email language about setting up a recurring call. This pollutes the Events table with initiative-level activities.

**Rationale:** Events should be things that would matter even if you deleted every initiative. A cadence call between two people is not that. The test: "Would this appear on a public/team calendar regardless of partner work?"

**Impact:** Classification prompt Rule 8 needs tightening. Events page should stay lean (10-20 entries max). Existing incorrect events should be cleaned up.

## 2026-02-07: Meeting Invitations Identified by ICS Attachment Only

**Decision:** Meetings are only recognized when a forwarded email contains an .ics calendar attachment. Casual language like "let's set up a call" does NOT create a meeting — it becomes an open item in the initiative summary.

**Context:** The system was treating email prose about potential calls as confirmed meetings, which is inaccurate.

**Rationale:** An .ics file has structured data (title, time, attendees, location). This is ground truth. Email prose is aspirational. The distinction keeps timelines honest.

**Impact:** Email parser needs .ics detection. Classifier needs content_type: meeting_invitation. Summary timeline distinguishes [Email] entries from [Meeting] entries.

## 2026-02-07: Initiative Names Are for Humans, Summaries Are for Claude

**Decision:** Users can freely rename initiatives. Claude matches incoming emails using the full initiative summary, participant list, and metadata — not just the name string.

**Context:** User asked whether renaming an initiative would break future email matching.

**Rationale:** The summary contains the rich context (partner names, topics, history) that Claude uses for matching. The name is a UI convenience.

**Impact:** Safe to add initiative name editing. No matching logic changes needed.

## 2026-02-07: Forwarding User as Implicit Participant

**Decision:** The user's own email (the PDM forwarding emails to the relay) should be treated as a known constant, not extracted as a new participant each time.

**Context:** Steven Romero appears in the participants table without an organization, and shows up redundantly since he's the forwarding user on every single email.

**Rationale:** The PDM is always a participant by definition — they forwarded the email. Extracting them adds noise. They should be a system-level config, not a per-message discovery.

**Impact:** Need a USER_EMAIL or PDM_EMAIL env var. Classifier should exclude this email from participant extraction. Existing participant record for the user can be linked to all initiatives automatically.

## 2026-02-07: Dashboard as Primary Review Interface

**Decision:** The inbox page in the dashboard is the primary way to resolve pending reviews, not a fallback for SMS. SMS is a notification channel that supplements the dashboard.

**Context:** Twilio A2P 10DLC registration takes days. Can't block the entire project on SMS approval.

**Rationale:** Even after SMS works, the dashboard provides a richer review experience — you can see the full email, the confidence bar, create custom initiative names. SMS is for quick approvals on the go.

**Impact:** Inbox page must be robust and reliable. SMS becomes a "hey, check your inbox" notification rather than the sole resolution mechanism.

## 2026-02-07: Message Deduplication by Content Hash

**Decision:** Before storing a new message, check for existing message with same sender_email + subject + first 100 chars of body_text. Skip if duplicate.

**Context:** Mailgun retries on timeout (our classification takes >30s), and during testing the same email created multiple pending reviews.

**Rationale:** Simple content-based dedup catches retries and accidental re-forwards without requiring message-id tracking.

**Impact:** Prevents duplicate reviews. Mailgun timeout "failures" are harmless — the message was already processed.

## 2026-02-07: Git Push Deploys to Vercel

**Decision:** Use git push to trigger Vercel auto-deploys instead of npx vercel --prod CLI deploys.

**Context:** CLI deploys created a separate deployment from the Git-linked one, causing confusion about which deployment was live.

**Rationale:** Standard workflow. One deployment source of truth.

**Impact:** All future deploys via git push. CLI deploy only as fallback.

## 2026-02-09: Events vs Meetings — Structural Distinction

**Decision:** Events are only real-world gatherings (conferences, summits, workshops, kickoffs, trade shows, training, deadlines, review cycles). Meetings (calls, demos, cadence calls, 1:1s) are NEVER events. Meetings only enter the system via .ics calendar attachments (future feature), not from prose mentions in email bodies.

**Context:** System was over-creating events from casual meeting mentions. "Let's set up a cadence call for March" was incorrectly becoming an Event entity.

**Rationale:** Events must pass the test "Would multiple initiatives care about this?" A cadence call is initiative-specific workflow. A conference is a shared calendar anchor.

**Impact:** Classification prompt event rules, event type enum (meeting_series removed), future .ics parsing feature design, event approval flow.

## 2026-02-09: New Events Always Require User Approval

**Decision:** Claude identifies new events (is_new: true in events_referenced) but the system never auto-creates them. They surface in the inbox as event approval cards. User explicitly approves or denies.

**Context:** Events were being silently created as side effects during initiative approval via persistClassificationEntities(). User approved one thing, got three things created.

**Rationale:** Event creation has broad impact — multiple initiatives reference the same event. Worth the friction of manual approval to prevent event pollution.

**Impact:** EventApprovalCard in inbox, approval_queue with type='event_creation', classifier skips new event creation.

## 2026-02-09: Initiative Auto-Assign Decoupled from Event Creation

**Decision:** New event suggestions in events_referenced do NOT block initiative auto-assignment. A 0.95 confidence initiative match auto-assigns even if Claude also suggests a new event.

**Context:** hasNewEntitySuggestions checked events_referenced, blocking auto-assign when Claude happened to notice a conference mentioned in the email.

**Rationale:** Initiative routing and event creation are independent decisions. Renamed to hasNewTrackSuggestions — only new initiatives and new tracks/programs block auto-assign.

**Impact:** classifier.ts orchestration logic, auto-assign throughput.

## 2026-02-09: Auto-Create New Initiatives at ≥0.85 Confidence

**Decision:** When Claude suggests a new initiative with confidence >= 0.85, create it automatically without inbox review. Below 0.85 routes to inbox.

**Context:** Every new initiative required manual approval even at 95% confidence. Unnecessary friction for obvious new partner discussions.

**Rationale:** At 0.85+ Claude is confident enough. User can edit/delete via CRUD. Falls back to review on creation failure.

**Impact:** classifier.ts hasHighConfidenceNew path, createInitiative called during classification.

## 2026-02-09: Unified Approval Queue

**Decision:** Single approval_queue table with type discriminator ('initiative_assignment' | 'event_creation') replaces separate pending_reviews and pending_event_approvals tables.

**Context:** Two tables doing the same lifecycle (create → review → resolve) caused FK cascade failures on initiative deletion, duplicated query logic, duplicated resolution handlers, inconsistent inbox UX.

**Rationale:** One table, one inbox query, one resolution endpoint, one count query. initiative_id FK uses ON DELETE SET NULL to prevent cascade failures.

**Impact:** Migration 006 (data migration + table drops), 17 files changed, all inbox/classification/SMS code updated.

## 2026-02-09: Application-Level Cascade Deletes

**Decision:** No DB-level ON DELETE CASCADE. Delete functions explicitly handle cleanup in order: orphan messages (set initiative_id = null), delete notes, delete entity_links (both directions), delete participant_links, delete approval_queue entries, then delete entity.

**Context:** DB cascades are invisible — one accidental delete silently wipes all related data with no logging.

**Rationale:** Application code is more verbose but explicit, loggable, and controllable. Messages are deliberately orphaned (preserved for potential reassignment) rather than destroyed.

**Impact:** deleteInitiative(), deleteEvent(), deleteTrack() in supabase.ts.

## 2026-02-09: Programs → Tracks Rename (UI Only)

**Decision:** "Programs" renamed to "Tracks" in all user-facing UI and prompt language. Database table stays "programs". JSON field stays "programs_referenced".

**Context:** "Programs" was too narrow. The system tracks formal AWS programs, GTM motions, technical milestones, certifications, and strategic relationships — "Tracks" is a broader container.

**Rationale:** UI rename is instant. DB rename would require migrating all existing data, updating all queries, for zero functional benefit.

**Impact:** Sidebar, page titles, URL (/tracks), prompt text, EntityLink labels. /programs redirects to /tracks.

## 2026-02-09: Participants Can Have Partial Data

**Decision:** Participants can be created with name only (email nullable). Missing fields displayed as placeholders in the UI.

**Context:** Claude extracts participants by name from email body text, but most don't have email addresses. The NOT NULL constraint on email was silently dropping 4 of 5 extracted participants.

**Rationale:** Partial data is better than no data. Users can fill in email/title later via CRUD (to be built) or as more emails arrive with additional context.

**Impact:** Migration 007 (email DROP NOT NULL), upsertParticipants name-only path, UI placeholders. NOTE: Participant insert had additional bug (.single() → .maybeSingle()) that may still not be fully working — needs verification next session.

## 2026-02-09: Structured Data Over Free-Text Parsing (IN PROGRESS)

**Decision:** Initiative detail page should render from structured JSON fields (current_state, timeline_entries, open_items) stored as JSONB columns on initiatives table, not from parsing Claude's free-text summary string.

**Context:** Claude inconsistently formats free-text summaries. ISO dates leak into prose, specific dates fabricated from vague timeframes, regex section parsing is brittle. Multiple attempts to fix via prompt refinement failed.

**Rationale:** Structured JSON arrays are deterministic to render. Each section becomes its own purpose-built UI component. The classification prompt outputs structured fields alongside the text summary.

**Impact:** Migration 008 (adds current_state text, timeline_entries jsonb, open_items jsonb to initiatives). SummaryCard deleted, replaced with CurrentStateCard, TimelineCard, OpenItemsCard. INCOMPLETE — Claude is outputting old-format text (with **Participants:**, **Timeline:** headers) into current_state field instead of clean narrative. The prompt, classifier extraction, and/or initiative update logic need debugging. This is the #1 priority for next session.

## 2026-02-09: No Hardcoded Entity Links

**Decision:** Claude's entity_links array is the sole source of semantic relationships between entities. Code no longer auto-generates "relevant_to" links in persistClassificationEntities().

**Context:** Code was creating a hardcoded "relevant_to" link for every event and program mentioned, then ALSO processing Claude's semantic entity_links. This caused duplicate links (relevant_to + preparation_for for the same pair).

**Rationale:** Claude provides more specific relationship types (preparation_for, qualifies_for, deadline, etc.). Generic relevant_to adds noise and duplicates.

**Impact:** persistClassificationEntities in reviews/resolve/route.ts, classifier.ts.

## 2026-02-09: EntityLinkChip Must Use Caller-Resolved Entity Type

**Decision:** EntityLinkChip accepts an explicit `entityType` prop for the "other" entity's type. Detail pages compute `otherType = isSource ? link.target_type : link.source_type` and pass it. The chip uses this for label, color, and href — never blindly reading `link.target_type`.

**Context:** Entity links are bidirectional — `getEntityLinksForEntity()` fetches links where the entity is either source or target. `EntityLinkChip` was hardcoded to `link.target_type` for the type label, color, and href. This only worked when the current page's entity was the source of the link. When viewing from the target side, the chip displayed the wrong type label (e.g., "Track" instead of "Initiative"), used the wrong color, and linked to a 404 URL (e.g., `/tracks/[initiative-id]` instead of `/initiatives/[initiative-id]`).

**Rationale:** Claude generates entity links in arbitrary direction — `initiative → program` or `program → initiative` are both valid. The rendering layer can't assume which side is source vs target. The detail page already knows (`isSource = link.source_id === id`), so it should resolve and pass the other entity's type explicitly.

**Impact:** EntityLinkChip component (new `entityType` prop), all 3 detail pages (initiatives, events, tracks). Fixes wrong labels, wrong colors, and 404 links for all 6 possible link direction × view-side combinations.

## 2026-02-09: Single "Linked Entities" Chip Section (No Duplicate Lists)

**Decision:** Entity relationships on detail pages are displayed ONLY as EntityLinkChip pills in a single "Linked Entities" section. Removed the separate "Linked Initiatives" list sections from track and event detail pages.

**Context:** Track and event detail pages had two sections showing the same data: a "Linked Entities" chip section (from `getEntityLinksForEntity`) and a "Linked Initiatives" list section (from `getLinkedInitiativesForEntity`). Both queried `entity_links`. An initiative linked to a track appeared twice — once as a chip with relationship label, once as a list item with status badge.

**Rationale:** One data source, one display. The chips already show type label, entity name, relationship, color, and link to the detail page — strictly more information than the list. The initiative detail page was already chips-only. Removes a redundant Supabase query per page load.

**Impact:** Removed `getLinkedInitiativesForEntity` from track and event page components. Function kept in supabase.ts (still used by API routes). All 3 detail pages now use the same pattern: chips only.

## 2026-02-09: Kill timeline_entries Entirely

**Decision:** Removed timeline_entries from the data model, types, prompt, classifier, and database. Initiative timelines are now simply the chronological list of received emails. Real meeting dates will come from .ics parsing in a future phase.

**Context:** Claude-generated timelines fabricated specific dates from vague email language ("let's meet next week" → "[Feb 14] Meeting scheduled"). The timeline_entries JSONB column was added in migration 008 but never reliably populated.

**Rationale:** Fabricated dates are worse than no dates. Email receipt timestamps are ground truth. The .ics parsing feature (v0.2) will add real meeting dates when implemented.

**Impact:** Migration 009 drops timeline_entries column. TimelineCard.tsx deleted. Timeline type removed from types.ts. Prompt no longer requests timeline extraction. NOTE: master-spec.md still references timeline in the initiative summary format — needs future update.

## 2026-02-09: current_state Is Source of Truth for Initiative Narrative

**Decision:** The `current_state` text column is the primary field for the initiative's narrative. It contains a 3-5 sentence executive briefing. The legacy `summary` field is kept for backward compatibility — edit form saves to both, display uses `current_state ?? summary` fallback.

**Context:** The original `summary` field contained a structured multi-section text blob (Participants, Timeline, Current State, Open Items). With participants, timeline, and open items now in their own structured fields/tables, the remaining narrative needed a clean home.

**Rationale:** Renaming `summary` → `current_state` in the DB would require a migration and risk breaking existing data. Dual-write is cheap and maintains backward compat with any code still reading `summary`.

**Impact:** initiatives.current_state column (migration 008), CurrentStateCard component, InitiativeActions edit form writes both fields, classifier outputs current_state.

## 2026-02-09: Simplified ClassificationResult — Removed Dead Fields

**Decision:** Removed `temporal_references`, `action_items`, `summary_update`, and `timeline_entries` from the ClassificationResult type and Claude prompt. These fields were defined in the type but never extracted or used by the classifier.

**Context:** The prompt included instructions to extract these fields, consuming ~30 lines of prompt tokens, but the classifier code never read them from Claude's response.

**Rationale:** Dead code in the prompt wastes tokens and increases response latency. Removing unused fields makes the contract between prompt and code honest.

**Impact:** ClassificationResult type in types.ts, Claude prompt in claude.ts. Saves tokens per classification call.

## 2026-02-09: Consolidated upsertParticipants into supabase.ts

**Decision:** Single `upsertParticipants()` function in supabase.ts replaces duplicate implementations in classifier.ts (~116 lines) and reviews/resolve/route.ts (~120 lines). Both call paths now use the same function.

**Context:** The two copies had drifted — different error handling, different dedup logic, different edge case behavior. Bug fixes applied to one weren't applied to the other.

**Rationale:** Single source of truth. Fix once, works everywhere. Also consolidated `ensureParticipantLink()` and added `appendOpenItems()` in the same refactor.

**Impact:** classifier.ts and resolve/route.ts import from supabase.ts. ~230 lines of duplicate code removed.

## 2026-02-09: Resolve Route Must Update Structured Fields for Existing Initiatives

**Decision:** When an email is assigned to an existing initiative via the resolve route, the route now updates `current_state` and appends `open_items` (deduplicated) — matching the auto-assign behavior in the classifier.

**Context:** Bug — the resolve route only updated the `summary` column when assigning to an existing initiative. The new structured fields (`current_state`, `open_items`) were silently dropped, so manually resolved emails didn't update the initiative's state.

**Rationale:** Both paths (auto-assign and manual resolve) should produce the same result. A user resolving a review should see the same data updates as an auto-classified email.

**Impact:** reviews/resolve/route.ts — added `updateInitiative()` call with current_state and `appendOpenItems()` call in the "select existing" path.

## 2026-02-09: force-dynamic on All Supabase-Fetching Pages

**Decision:** All 7 database-backed pages export `const dynamic = "force-dynamic"` to prevent Next.js App Router from statically caching them at build time.

**Context:** Only the inbox page had `force-dynamic`. All other pages (initiatives list/detail, events list/detail, tracks list/detail, home) were statically rendered at deploy time by Vercel. Users saw stale data even after deleting records in Supabase.

**Rationale:** This is a live dashboard backed by a database. Every page load must hit Supabase for current data. Static caching is fundamentally incompatible.

**Impact:** Added to: page.tsx (home), initiatives/page.tsx, initiatives/[id]/page.tsx, events/page.tsx, events/[id]/page.tsx, tracks/page.tsx, tracks/[id]/page.tsx.

## 2026-02-09: Defensive Entity Link Rendering (Orphan Skip)

**Decision:** Detail pages skip rendering `EntityLinkChip` when `resolveEntityLinkNames()` returns no name for the linked entity. This prevents broken/empty chips when one side of an entity link has been deleted.

**Context:** `resolveEntityLinkNames()` queries initiatives/events/programs tables by ID. If an entity was deleted, the ID returns no row, so the nameMap has no entry. The chip would render with an undefined name and link to a valid-looking URL for a nonexistent entity.

**Rationale:** Defensive rendering is simpler and more robust than cascading entity_link cleanup on every delete. Orphaned links are harmless in the DB and get skipped in the UI.

**Impact:** All 3 detail pages: `if (!otherName) return null;` guard before EntityLinkChip render.

## 2026-02-09: Participant CRUD — Edit Is Global, Delete Is Unlink

**Decision:** Editing a participant (name, email, title, organization) updates the `participants` record globally — changes appear everywhere that participant is linked. Removing a participant from an initiative deletes only the `participant_links` row; the participant record is preserved for other initiatives.

**Context:** Participants are shared across initiatives (e.g., an SA appears on multiple partner engagements). Editing contact info should propagate. But removing someone from one initiative shouldn't delete them from others.

**Rationale:** Participants are people, not initiative-scoped data. The link is the scoped relationship. This matches how real organizations think about contacts.

**Impact:** ParticipantList.tsx (client component), API routes: PUT /api/participants/[id] (global edit), DELETE /api/participant-links/[id] (unlink), POST /api/initiatives/[id]/participants (create + link).

## 2026-02-09: participant_links Unique Constraint

**Decision:** Added UNIQUE INDEX on `(participant_id, entity_type, entity_id)` to the participant_links table. Prevents duplicate links at the database level.

**Context:** `upsertParticipants()` does a select-before-insert to avoid duplicates, but concurrent classification of the same email (e.g., Mailgun retry) could race past the check and create duplicate links.

**Rationale:** Application-level dedup handles the common case. The DB constraint catches race conditions. Belt and suspenders.

**Impact:** The unique index means insert failures on duplicate are expected — code uses `.maybeSingle()` and handles conflicts gracefully.

## 2026-02-10: Rename Initiatives → Engagements

**Decision:** Rename "initiatives" to "engagements" across the entire system — database, API, UI, prompt, types.

**Context:** "Initiative" is vague and overloaded. The system tracks partner engagements — a specific partner working toward a specific goal. "Engagement" is what PDMs actually call these workstreams.

**Rationale:** The name should reflect the domain language. Every forwarded email is about engaging with a partner on something concrete.

**Impact:** Database table rename (or alias), API route rename (/api/engagements/), UI labels, classification prompt, TypeScript types. Redirect from old /initiatives/ URLs.

## 2026-02-10: Events and Programs Are Seed-Only

**Decision:** Events and programs are pre-seeded reference data managed through an admin interface. Claude matches against them by ID but never creates them. No AI creation. No user creation UI on the main dashboard.

**Context:** v0.1 allowed Claude to create events (via approval queue) and programs (via findOrCreateProgram). This caused fabricated events from vague email language, duplicate programs from fuzzy matching failures, and a complex event approval flow.

**Rationale:** Programs (~15-20) and events (~10-15/year) are small, stable datasets. Admin seeding is more reliable than AI creation. Eliminates fabrication risk, duplication bugs, and approval queue complexity.

**Impact:** Remove event creation pathway from classifier and resolve route. Remove program creation from classifier. Remove event_creation approval type. Add admin page and bulk seed endpoints.

## 2026-02-10: Add Tags System

**Decision:** Tags are a JSONB string array on the engagements table. Freeform labels. Claude suggests tags during classification, users can add/edit/remove freely. Tags are filterable in the engagements list.

**Context:** Not everything fits into programs, events, or entity links. Campaigns ("FinServ Q2"), partner events ("Wiz Innovation Summit"), strategic labels ("exec-sponsored"), workflow states ("waiting-on-legal"), segments ("public-sector") need a home.

**Rationale:** Tags are the escape valve for arbitrary categorization without schema changes. Cheap to add, easy to filter, no foreign keys or relationship management needed.

**Impact:** Add `tags jsonb DEFAULT '[]'` to engagements table. Add `suggested_tags` to ClassificationResult. Add tag pills to engagement cards and detail page. Add tag filter to engagements list.

## 2026-02-10: Remove Event Creation Pathway

**Decision:** Claude can no longer create events. The `is_new` field for events_referenced is removed from the prompt and type. Events are matched by ID only. The event_creation approval type is removed.

**Context:** Claude fabricated events from vague email mentions ("New York Summit 2026" from a passing reference). The event approval flow added complexity (EventApprovalCard, handleEventApproval, entity_data JSONB) for low-value entity creation. Real events are a small, known set.

**Rationale:** Eliminating event creation removes fabrication risk, the approval queue branch, and the findOrCreateEvent codepath from classification. Events are seeded by an admin who knows the actual conference calendar.

**Impact:** Simplify ClassificationResult type. Remove event_creation from approval_queue. Remove handleEventApproval from resolve route. Remove EventApprovalCard component. Simplify inbox to single approval type.

## 2026-02-10: Remove Program Creation from Classifier

**Decision:** Claude can no longer create programs. Programs are matched by ID only. `findOrCreateProgram()` is no longer called during classification or review resolution.

**Context:** v0.1 auto-created programs via case-insensitive name matching. "ISV Accelerate" vs "AWS ISV Accelerate Program" caused duplicates. Programs are curated reference data (~15-20 total) that shouldn't be AI-generated.

**Rationale:** Admin seeding with exact names eliminates duplication. Claude receives program IDs in context and returns matched IDs — no fuzzy resolution needed.

**Impact:** Remove findOrCreateProgram calls from classifier.ts and resolve/route.ts persistClassificationEntities. Programs only created via admin interface.

## 2026-02-10: Consolidate to Single Persistence Function

**Decision:** A single shared function handles all DB writes after classification — used by both the auto-assign path (classifier.ts) and the manual resolve path (resolve/route.ts).

**Context:** v0.1 had two parallel persistence codepaths: `applyClassificationResult()` in classifier.ts and `persistClassificationEntities()` in resolve/route.ts. They diverged in entity link resolution strategy (context-based vs local entityIdMap), program handling, and open_items merging. Bugs fixed in one path weren't fixed in the other.

**Rationale:** One function, one behavior. Fixes the entity link gap where auto-created engagements couldn't link to programs because the engagement wasn't in the pre-fetched context map.

**Impact:** Extract shared persistence function to supabase.ts or a new persist.ts module. Both classifier and resolve route call it. ~200 lines of duplicate code removed.

## 2026-02-10: Claude Matches Programs and Events by ID Only

**Decision:** Claude receives program and event UUIDs in the classification context and returns matched IDs directly. No name-based fuzzy resolution in application code. No `normalizeEntityName()`, no entity name→ID map building.

**Context:** v0.1 had `createEntityLinks()` in classifier.ts that built a name→ID map and matched Claude's `source_name`/`target_name` strings against it. Normalization was fragile — "AWS re:Invent" vs "re:Invent 2025" could fail to match. The resolve route had a separate resolution strategy.

**Rationale:** IDs are unambiguous. Claude already receives IDs in the context. Returning IDs eliminates the entire name resolution layer and its edge cases.

**Impact:** Prompt changes (entity_links use IDs not names). Remove normalizeEntityName() and createEntityLinks() from classifier.ts. Simplify entity link creation to direct ID-based insert.

## 2026-02-12: current_state Evolves Rather Than Overwrites

**Decision:** Claude reads the existing current_state from context and evolves it — updating only material changes while preserving accumulated context. Routine emails (scheduling, acks) return the existing state with minimal changes.

**Context:** v0.1 prompt generated a fresh current_state on every email, causing important context to be lost when a routine follow-up arrived. The 3-5 sentence limit forced Claude to pick the most recent information, dropping earlier context about engagement scope, participants, and decisions.

**Rationale:** Engagement state should accumulate knowledge over time. The PDM needs a briefing that reflects the full picture, not just the last email. Evolving state preserves momentum while incorporating new developments.

**Impact:** Updated SYSTEM_PROMPT current_state instructions. No code changes needed — buildUserMessage() already sends existing current_state in context.

## 2026-02-12: open_items Strictly Limited to Explicit Action Items

**Decision:** open_items extraction requires concrete, actionable tasks explicitly stated or clearly implied in the email. Vague intentions, pleasantries, and status commentary are excluded. Assignee model supports person names, multiple people, team names, or null.

**Context:** v0.1 prompt was loose about what constituted an "action item." Claude would extract vague intentions ("let's circle back") and status commentary ("great progress") as open items. Assignees were often wrong or over-attributed.

**Rationale:** Noisy open_items erode trust. Users ignore the list when half the items are fabricated. Strict extraction with realistic assignee patterns (person, "Steven and CJ", "Contrast Security team", null) produces actionable output worth reading.

**Impact:** Updated SYSTEM_PROMPT open_items instructions with positive/negative examples, assignee rules, and due date rules. Empty array explicitly preferred over fabricated items.

## 2026-02-12: Events Schema Simplified — date_precision Removed, host Added

**Decision:** Drop date_precision column from events (either the date exists or it's null). Add host column (text, nullable) for the organization hosting the event.

**Context:** date_precision ("exact", "week", "month", "quarter") added complexity without value — in practice, events either have confirmed dates or they don't. The host field captures a genuinely useful dimension: who's running the event (AWS, RSA Conference, a partner).

**Rationale:** Simpler schema, more useful data. The UI date formatting code that handled quarter/month/week display was removed in favor of straightforward date rendering.

**Impact:** Migration 012 adds host, drops date_precision. Updated Event type, UI components, API routes, and test fixtures.

## 2026-02-12: Programs Lifecycle Model — lifecycle_type + lifecycle_duration

**Decision:** Replace renewal_cycle with lifecycle_type (indefinite/recurring/expiring) + lifecycle_duration (human-readable string, nullable). Default is 'indefinite'.

**Context:** renewal_cycle was a single text field that conflated two concepts: whether a program renews at all and how long its cycle is. "Annual" could mean the program expires yearly or that partners must re-certify yearly.

**Rationale:** lifecycle_type captures the core distinction (does this program end?), while lifecycle_duration captures the timeframe when relevant. Indefinite programs have null duration. This models reality: Security Competency is recurring (annual revalidation), ISV Accelerate is indefinite, a specific funding program might be expiring.

**Impact:** Migration 012 adds both columns with CHECK constraint, drops renewal_cycle. Updated Program type and test fixtures.

## 2026-02-14: Initiatives Renamed to Engagements

**Decision:** Rename "initiatives" to "engagements" across the entire codebase — 38 files including database migration, API routes, UI components, types, prompts, and tests.

**Context:** "Initiative" implied project management. The system tracks ongoing partner relationships through email threads — that's an engagement. "Engagement" is the term PDMs actually use.

**Rationale:** Domain language should drive naming. Every forwarded email is about engaging with a partner on something concrete, not managing a project.

**Impact:** Migration 010 renames database table and all FK references. URL paths changed to /engagements/. TypeScript types renamed. Classification prompt updated. Redirect from old /initiatives/ paths.

## 2026-02-14: Events and Programs Seed-Only, Matched by ID

**Decision:** Claude never creates events or programs. It matches to pre-seeded reference data by UUID only. No fuzzy name resolution in application code.

**Context:** Claude was fabricating events from vague email mentions, duplicating programs from fuzzy name matching, and generating IDs that didn't exist. The event approval flow added complexity for low-value entity creation.

**Rationale:** "Constrain intelligence" — give Claude structured reference data with stable IDs and let it match, not create. Programs (~15-20) and events (~10-50/year) are small enough to seed manually.

**Impact:** Eliminated findOrCreateEvent(), findOrCreateProgram(), EventApprovalCard, event_creation approval type, normalizeEntityName(), and the entire name→ID resolution layer.

## 2026-02-14: Single Shared Persistence Function

**Decision:** Consolidated two parallel persistence codepaths into a single `persistClassificationResult()` function used by both auto-assign (classifier.ts) and manual resolve (resolve/route.ts).

**Context:** Auto-assign path used a stale context map for entity links — engagements created during classification weren't in the map, so their links silently failed. Manual resolve path built a fresh map and worked. Two copies had diverged in error handling, dedup logic, and open_items merging.

**Rationale:** Same job should have same behavior. Fix once, works everywhere.

**Impact:** ~200 lines of duplicate code removed. Entity links no longer fail silently on auto-created engagements. Both paths call the same function with the same signature.

## 2026-02-14: Entity Links via Matched Arrays with Relationship

**Decision:** Removed `entity_links` array from ClassificationResult. The `matched_events` and `matched_programs` arrays with `{ id, name, relationship }` ARE the links.

**Context:** Old `entity_links` array used name-based resolution — `source_name`/`target_name` strings matched against a name→ID map. Normalization was fragile ("AWS re:Invent" vs "re:Invent 2025" failed to match).

**Rationale:** ID-based by construction. If it's in `matched_events`, it has a valid UUID from the context Claude received. No post-hoc resolution needed.

**Impact:** Eliminated name-based entity link resolution entirely. `createEntityLink()` now takes IDs directly from Claude's response.

## 2026-02-14: Content Types Simplified

**Decision:** Reduced content types from 6 to 4: `engagement_email`, `meeting_invite`, `mixed`, `noise`. Removed `event_info` and `program_info`.

**Context:** `event_info` and `program_info` existed to route emails into the event/program creation pathways. Without creation, an email mentioning an event is just an `engagement_email` that matches an event by ID.

**Rationale:** Fewer content types means simpler routing logic and cleaner prompt instructions.

**Impact:** Migration 011 updates existing data. ClassificationResult type simplified. Prompt content_type enum reduced.

## 2026-02-14: Tags System

**Decision:** JSONB string array on engagements table. Claude suggests tags via `suggested_tags` in classification response. Users can edit freely. Lowercase, freeform labels like "co-sell", "poc", "finserv", "marketplace".

**Context:** Needed a categorization mechanism that doesn't require rigid taxonomy. Not everything fits into programs, events, or entity links. Campaigns, strategic labels, workflow states, and segments need a home.

**Rationale:** Tags are cheap, flexible, and can evolve into formal programs if a pattern emerges. No schema changes needed to add new categories.

**Impact:** Migration 011 adds `tags jsonb DEFAULT '[]'` to engagements. Classifier merges new tags (deduplicated) on each classification. Tag pills on engagement cards and detail page.

## 2026-02-14: Program Lifecycle Model

**Decision:** Replace `renewal_cycle` with `lifecycle_type` (indefinite/recurring/expiring) + `lifecycle_duration` (human-readable string, nullable).

**Context:** AWS programs have three distinct patterns: Security Competency is recurring (annual revalidation), ISV Accelerate is indefinite (no expiry), a specific funding program might be expiring. A single text field couldn't express this.

**Rationale:** `lifecycle_type` captures the core distinction (does this end?), while `lifecycle_duration` captures the timeframe when relevant. Indefinite programs have null duration.

**Impact:** Migration 012 adds both columns with CHECK constraint, drops renewal_cycle. Updated Program type and seed data format.

## 2026-02-14: Events — Host Added, date_precision Removed

**Decision:** Added `host` text column (who runs the event). Removed `date_precision` enum (exact/week/month/quarter).

**Context:** `date_precision` was overthinking it — in practice, events either have confirmed dates or they don't, `null` suffices. `host` matters for distinguishing AWS events from partner events from industry events.

**Rationale:** Simpler schema, more useful data. The date formatting code that handled quarter/month/week display was removed in favor of straightforward date rendering.

**Impact:** Migration 012 adds host, drops date_precision. Updated Event type, UI, and seed data format.

## 2026-02-14: current_state Evolves Not Overwrites

**Decision:** Prompt instructs Claude to read the existing `current_state` from context and evolve it — updating only material changes while preserving accumulated context. Routine follow-ups (scheduling, acknowledgments) return existing state with minimal changes.

**Context:** Every email was generating a fresh current_state, causing recency bias and losing accumulated context. A routine "sounds good!" reply would replace a detailed briefing about engagement scope.

**Rationale:** Like a Wikipedia article — update the section that changed, don't rewrite the whole thing. Engagement state should accumulate knowledge over time.

**Impact:** Updated SYSTEM_PROMPT with explicit current_state instructions for existing vs new engagements and style rules. No code changes — `buildUserMessage()` already sends existing current_state in context.

## 2026-02-14: open_items Strictly Limited

**Decision:** Prompt includes positive and negative examples for open_items. Assignee model supports: one person ("Steven"), multiple people ("Steven and CJ"), team/company ("Contrast Security team"), or null. Due dates only from explicit statements.

**Context:** Claude was extracting vague intentions ("let's circle back"), pleasantries ("looking forward to working together"), and status commentary ("great progress") as action items. Deadlines were fabricated from vague language like "soon."

**Rationale:** Noisy open_items erode trust. Users ignore the list when half the items are fabricated. Empty array is better than fabricated items.

**Impact:** Updated SYSTEM_PROMPT with detailed positive/negative examples, assignee rules, and due date rules. Cleaner open_items output.

## 2026-02-14: Forwarder as First-Class System Concept

**Decision:** `ForwarderContext { name, email }` passed explicitly to Claude via a dedicated "Forwarding Context" prompt section. Stored as `forwarder_email`/`forwarder_name` columns on messages table for batch recovery.

**Context:** Claude was guessing the forwarder from body text greetings ("Hi Steven") or From headers. The Mailgun envelope sender IS the forwarder — it was available all along but never parsed or passed through. Batch reclassification (`processUnclassifiedMessages`) had no way to recover the forwarder identity.

**Rationale:** System-level truth over AI inference. The forwarder is a known constant for each email — pass it explicitly rather than asking Claude to guess.

**Impact:** Migration 013 adds 4 columns to messages. Updated classifier, inbound route, test routes. Prompt rules 5 & 6 rewritten for explicit forwarder handling.

## 2026-02-14: To/CC Extracted from Inner Outlook Headers

**Decision:** Email parser now captures To (was being discarded from regex `match[3]`) and handles optional CC line between To and Subject. Stored as `to_header`/`cc_header` on ParsedMessage. Mailgun's outer envelope is fallback only.

**Context:** Mailgun's `To` field contains `relay@mg.roadrunner.dev` for forwarded emails — useless. The real recipients are in the Outlook-style headers embedded in the body text. Also fixed: emails with a CC line between To and Subject completely failed to parse as multi-message threads because the regex didn't allow for CC.

**Rationale:** Fix at the parser level where the data lives. The regex already captured To but `findHeaderBlocks()` threw it away. Making CC optional in the regex is a one-line fix that unblocks an entire class of emails.

**Impact:** Updated regex patterns (both Sent and Date variants), HeaderMatch interface, `findHeaderBlocks()`, `parseForwardedEmail()`. Inbound route prefers parser values over Mailgun envelope. 6 new parser tests (49 total).

## 2026-02-14: Reusable Seed Data Loader

**Decision:** `scripts/seed-data.ts` reads JSON files with `{ events: [...], programs: [...] }` format. Idempotent — checks by name before insert, logs every action. Usage: `npm run seed -- data/file.json`.

**Context:** Needed a repeatable way to load reference data without SQL migrations. Events and programs are content, not schema — they change with the calendar year and program portfolio.

**Rationale:** A script is rerunnable, version-controllable, and doesn't pollute the migration chain. JSON files can be committed to `data/` or passed ad-hoc.

**Impact:** 42 events seeded (re:Invent, re:Inforce, summits, deadlines, review cycles). Programs pending seed.

## 2026-02-14: Browser-Based Classification Test Page

**Decision:** `/test` page with separate "PDM / Forwarder" section and "Original Email" section (From, To, CC, Subject, Date, Body). Two modes: "Classify Only" (dry run, no side effects) and "Classify & Save" (full pipeline with DB writes).

**Context:** Testing classification quality required curl commands with long JSON payloads that didn't mirror real email structure. No way to quickly iterate on prompt changes.

**Rationale:** Fast iteration on prompt quality requires fast testing. The test page mirrors the exact data flow of the production pipeline — forwarder context, email headers, body — with visual results.

**Impact:** New pages: `/test`, `/api/classify/test` (dry run), `/api/classify/live-test` (full pipeline). Added to sidebar. Replaces curl-based testing entirely.

## 2026-02-14: Two-Tier Catalog/Enrollment Pattern

**Decision:** Programs catalog (Tier 1) contains 33 canonical program records. Partner Programs (Tier 2) contains 70 per-partner enrollment records linked to the catalog via "Program" field. Catalog is the single source that seeds Roadrunner.

**Context:** Needed a way for Roadrunner to match against canonical program names while Airtable tracks per-partner enrollment status.

**Rationale:** Separating "what exists" from "who's enrolled in what" prevents Claude from needing to understand the full portfolio structure. It just matches against the vocabulary.

**Impact:** All entity types should follow this pattern (Events catalog already exists, Partner Event Status is Tier 2).

## 2026-02-14: Partner Engagements Replaces Partner Initiatives

**Decision:** New Partner Engagements table with fields: Pillar (Co-Sell/Co-Market/Co-Build), Priority (Mandated/High/Normal/Opportunistic), Status (Planned/Active/Blocked/Completed/Archived), Related Program link, Roadrunner ID, plus all original fields. 37 records migrated from Partner Initiatives which is now archived.

**Context:** Partner Initiatives had a flat schema that didn't capture strategic context or link to programs/Roadrunner.

**Rationale:** Richer schema enables triage of Roadrunner suggestions (Priority), connects work to credentials (Related Program), and establishes sync key (Roadrunner ID).

**Impact:** Roadrunner engagements table should eventually mirror these fields. Classification output already returns pillar-compatible data.

## 2026-02-14: Program Type Taxonomy

**Decision:** Five program types — Competency, Service Ready, SCA, Program, Credit Program — stored in both Airtable (single select on Programs catalog) and Roadrunner (text column with CHECK constraint on programs table).

**Context:** Claude needs to distinguish program categories during email classification. An email about a competency pursuit looks different from MPOPP enrollment.

**Rationale:** Type is a fundamental classification axis. Having it in both systems means Claude sees it in the prompt context and the UI can group/filter by it.

**Impact:** Classification prompt now includes type. Tracks UI groups by type. Seed files include type field.

## 2026-02-14: MPOPP Split — Activate vs Grow as Separate Catalog Entries

**Decision:** MPOPP Activate and MPOPP Grow are two separate records in Programs catalog, not one record with a track sub-field.

**Context:** Debated whether MPOPP is one program with tracks or two distinct programs.

**Rationale:** They have different eligibility requirements, different purposes (new-to-marketplace vs scaling), and Claude needs distinct matching targets. Wallet/funding tracking stays in MPOPP Funding table.

**Impact:** Partner Programs enrollment records link to the specific track. 11 partners on Grow, 1 on Activate.

## 2026-02-14: Lifecycle Vocabulary — Roadrunner Terms as Standard

**Decision:** Use indefinite/recurring/expiring everywhere (both Airtable and Roadrunner) instead of Ongoing/One-Time/Periodic from the original architecture plan.

**Context:** Architecture plan and Roadrunner DB had different lifecycle vocabularies that mapped conceptually but used different words.

**Rationale:** Roadrunner already had these in a CHECK constraint. Using the same terms eliminates translation during seeding.

**Impact:** Airtable Programs catalog single select uses indefinite/recurring/expiring. Seed files pass through directly.

## 2026-02-14: Engagement Status — Intentionally Different Between Systems

**Decision:** Roadrunner uses active/paused/closed. Airtable uses Planned/Active/Blocked/Completed/Archived. These are not aligned and that's intentional.

**Context:** Considered aligning status vocabularies between systems.

**Rationale:** They serve different purposes. Roadrunner status reflects email activity flow (observable from emails). Airtable status reflects strategic assessment (human judgment). Mapping happens at sync time: Roadrunner active → Airtable Active, Roadrunner closed → Airtable Completed or Archived (human decides).

**Impact:** Future sync logic needs a status mapping layer, not vocabulary unification.

## 2026-02-14: Seed Flow — Airtable → JSON → Roadrunner

**Decision:** Airtable Programs catalog is the authoritative source. Seed files are generated from it in the documented JSON schema, then loaded via npm run seed. Seed loader updated to accept type and eligibility fields.

**Context:** Needed to establish which system is authoritative and how data flows between them.

**Rationale:** Airtable is where human curation happens (visual, easy to edit). Roadrunner is where classification happens. Seeds flow from curation layer to execution layer.

**Impact:** Any program changes start in Airtable, get exported to seed JSON, then loaded. Same pattern should apply to events.

## 2026-02-14: Partner Initiatives Archived

**Decision:** Partner Initiatives table archived (renamed with prefix, hidden from tab bar). Zero dependencies confirmed — no Partner Plans or AWS Relationships records linked to it.

**Context:** All 37 records migrated to Partner Engagements with richer schema.

**Rationale:** Dead table with no links. Keeping it visible would cause confusion about which table is active.

**Impact:** Partner Engagements is now the sole active work-tracking table.

## 2026-02-14: AWS Relationships as Synced Catalog

**Decision:** AWS Relationships syncs Airtable → Roadrunner like Programs and Events. Claude receives relationship data in context and matches @amazon.com addresses in email threads to internal AWS teams.

**Context:** Claude needs to link engagements to relevant AWS teams (Product Team, GTM contact, exec sponsor). Without structured relationship data, it has no way to know who "jsmith@amazon.com" is or which team they represent.

**Rationale:** Same "constrained intelligence" pattern — Claude picks from a closed list of relationships, never fabricates. Enables automatic linking of engagements to relevant AWS teams based on email participants.

**Impact:** New aws_relationships table in Roadrunner (migration 017). Requires email fields populated in Airtable. Claude classifier prompt needs update to include relationships context (future phase).

## 2026-02-14: Contact Emails Stored Inline

**Decision:** Store Primary Contact Email and AWS Contact Emails directly in the aws_relationships table, not in a separate AWS Contacts table.

**Context:** Need email addresses for Claude to match participants in email threads to known AWS relationships. Debated (A) inline on relationships vs (B) separate contacts table with junction.

**Rationale:** Simpler architecture, no junction table overhead. The relationship is the unit of work — knowing "the Security SA team contact is jsmith@amazon.com" is sufficient. Can split into separate Contacts table later if relationship-to-contact mapping gets complex.

**Impact:** Airtable AWS Relationships has 2 email fields (Primary Contact Email, AWS Contact Emails). Roadrunner has primary_contact_email (text) and aws_contact_emails (text[]) columns.

## 2026-02-14: Meetings Table Generalization

**Decision:** Single unified "Meetings" table handles all meeting types — event-related meetings, engagement calls, and standalone meetings. Renamed from "Event Meetings" to remove the event-only implication.

**Context:** Originally only tracked meetings associated with big events (re:Invent 1:1s, Summit follow-ups). Need to also track engagement-related calls parsed from ICS attachments and ad-hoc meetings.

**Rationale:** One table with a Source field (manual/ics_parsed) is cleaner than separate tables. Event link becomes optional via entity_links — meetings can exist without event context. engagement_id FK provides direct link to the engagement a meeting belongs to.

**Impact:** Airtable table renamed "Event Meetings" → "Meetings" with 8 new fields added. Roadrunner meetings table created (migration 018) with engagement FK, ICS UID for dedup, attendees as JSONB, and airtable_record_id for sync.

## 2026-02-14: Many-to-Many Junction Tables for AWS Relationships

**Decision:** Create engagement_aws_relationships and meeting_aws_relationships junction tables instead of using the polymorphic entity_links pattern.

**Context:** An engagement can involve multiple AWS teams (Product Team + GTM contact). A meeting can have multiple internal relationships present. Need to model this cleanly.

**Rationale:** Dedicated junction tables are simpler and more explicit than polymorphic entity_links for this relationship. They mirror Airtable's multipleRecordLinks field behavior with no artificial limits. CASCADE deletes keep them clean automatically.

**Impact:** Migrations 019 and 020 create junction tables with composite PKs. entity_links pattern NOT used for AWS relationships — that pattern stays for engagement↔event↔program links.

## 2026-02-14: Sync Direction Formalized

**Decision:** Airtable → Roadrunner for catalogs (Programs, Events, AWS Relationships). Roadrunner → Airtable for activity (Engagements, Meetings). Each entity type has ONE authoritative source.

**Context:** Both systems can technically edit any entity. Without a clear source of truth per entity type, edits conflict and data drifts.

**Rationale:** Airtable is the strategic hub where Steven manages portfolio, curates catalogs, and does strategic planning. Roadrunner is the action hub where Claude creates activity from emails. Sync pipelines must respect direction — never overwrite the authoritative source.

**Impact:** Edit Programs/Events/AWS Relationships in Airtable only. Engagements/Meetings created in Roadrunner, synced back to Airtable. Future sync pipelines enforce this with read-only queries on the non-authoritative side.

## 2026-02-14: Table Naming Alignment

**Decision:** Renamed Airtable tables: "Event Meetings" → "Meetings" and "Partner Event Status" → "Partner Events". Roadrunner table names follow: meetings, aws_relationships.

**Context:** Original names were too narrow. "Event Meetings" implied only event context. "Partner Event Status" didn't parallel "Partner Programs" naming convention.

**Rationale:** "Meetings" is general enough for all meeting types. "Partner Events" follows the Tier 2 enrollment naming convention (Partner Programs, Partner Events). Consistency reduces cognitive load.

**Impact:** Tables renamed in Airtable. Note: some link field labels in the Partners table may still show old names (cosmetic only, links work correctly).

---

## 2026-02-16: Bidirectional Sync Architecture — Catalog Pull + Activity Push

**Decision:** Airtable → Roadrunner for Tier 1 catalogs (Programs, Events, AWS Relationships) via button-triggered pull. Roadrunner → Airtable for Tier 3 activity (Engagements, and soon Meetings) via auto-push on create/update.

**Context:** Two systems need to stay in sync — Airtable as strategic portfolio hub, Roadrunner as real-time email activity layer.

**Rationale:** Each system is authoritative for its domain. Pull for catalogs gives user control over when reference data refreshes. Auto-push for activity ensures Airtable always reflects the latest email-driven work without manual steps.

**Impact:** Defines permanent data flow contract. Catalog sync via POST /api/sync (button-triggered). Activity sync via fire-and-forget after classification and manual edits.

---

## 2026-02-16: Name-Based Initial Match → ID-Based Ongoing Match

**Decision:** First sync matches records by name (programs/events) or name + partner_name combo (engagements). After matching, both sides store each other's record IDs (airtable_record_id in Supabase, Roadrunner ID field in Airtable). All subsequent syncs match by ID first.

**Context:** Initial state had 33 programs, 32 events, and 37 engagements in Airtable with no Roadrunner IDs, and Roadrunner records with no Airtable IDs.

**Rationale:** Name matching bootstraps the relationship. ID matching makes it permanent and rename-safe. If someone renames "Security Competency" to "AWS Security Competency" in Airtable, the sync finds it by ID and updates the name — no duplicate created.

**Impact:** airtable_record_id columns on programs, events, engagements, aws_relationships tables. Roadrunner ID field on Airtable Partner Engagements. Reconciliation is automatic on first sync.

---

## 2026-02-16: Fire-and-Forget Auto-Push Pattern

**Decision:** Engagement pushes to Airtable use non-blocking Promise.catch(err => console.error()) pattern. Never awaited in the critical path of email classification or API responses.

**Context:** Airtable API could be slow or down. Email classification must never fail because Airtable is unavailable.

**Rationale:** Roadrunner must function independently. Airtable sync is a nice-to-have enrichment, not a hard dependency. Errors are logged but don't propagate.

**Impact:** classifier.ts and PUT /api/engagements/[id] both call pushEngagementToAirtable() without await. Same pattern will apply to meetings sync.

---

## 2026-02-16: Notes Field Merge Strategy with Marker Sections

**Decision:** Roadrunner writes activity summaries to Airtable Notes field using === Roadrunner Activity Summary === markers. Manual content above the marker is preserved. Future syncs replace only the marker section. If no marker exists and Notes has content, Roadrunner appends below.

**Context:** Both systems write to Notes — Steven manually in Airtable, Roadrunner automatically from current_state and open_items.

**Rationale:** Prevents data loss. Clear visual separation. The marker pattern is a well-established convention for multi-source content in a shared field.

**Impact:** Notes field in Airtable Partner Engagements safely contains both manual strategic notes and auto-synced activity summaries.

---

## 2026-02-16: Meetings Don't Link Directly to Programs

**Decision:** No program_id or program link on meetings table. Program context is always inherited via Meeting → Engagement → Program (through entity_links).

**Context:** Question raised about whether meetings should link to programs like engagements do.

**Rationale:** A meeting is a moment in time within an engagement's lifecycle. The engagement carries the program context. Adding a direct program link would create redundancy and risk inconsistency. Events ARE directly linked because meetings physically occur at events — that's a property of the meeting itself, not inherited.

**Impact:** Keeps data model clean. Airtable Meetings table also has no Programs link — both systems are consistent.

---

## 2026-02-16: Meetings Schema Completeness — event_id, status, partner_name

**Decision:** Added event_id FK (to events), status TEXT with CHECK constraint (Scheduling/Invites Sent/Confirmed/Completed/Did Not Occur), and partner_name TEXT to the meetings table via migration 022.

**Context:** Gap analysis between Supabase meetings table and Airtable Meetings table revealed three missing fields that would block clean sync.

**Rationale:** Closing gaps before building sync ensures 1:1 field mapping with zero translation issues. Status values match Airtable exactly. event_id enables "this meeting happens at this event" linking. partner_name handles standalone meetings without engagements.

**Impact:** Migration 022. Updated types, API routes, list/detail pages, create/edit forms. Meeting status badges in UI.

---

## 2026-02-16: Events Consolidated to 32 (2026 Only)

**Decision:** Removed 6 legacy 2025 events from Airtable (deprecated Event Type field, missing new schema fields). Added 4 AWS PartnerEquip training events. Final count: 32 events in both systems.

**Context:** Event count discrepancy between systems — needed to reconcile before building sync.

**Rationale:** Clean baseline is essential. Legacy events with old schemas would cause sync mapping issues. PartnerEquip events were in Supabase but missing from Airtable.

**Impact:** Both systems at 32 events. All counts verified: 33 programs, 32 events, 7 AWS relationships.

---

## 2026-02-16: Catalog Sync is Idempotent with Change Detection

**Decision:** Sync compares all mapped fields before writing. Only changed records trigger updates. Unchanged records are skipped. Results report inserted/updated/unchanged/errors counts with duration.

**Context:** Sync button can be pressed repeatedly. Need to avoid unnecessary writes and provide clear feedback.

**Rationale:** Idempotency is a fundamental property of reliable sync. Change detection reduces API calls and database writes. Clear reporting helps diagnose issues.

**Impact:** First sync: ~12s (65 updates to add airtable_record_ids). Subsequent syncs: ~0.5s (all unchanged). Safe to run anytime.

---

## 2026-02-16: Airtable-Only Fields Never Overwritten by Sync

**Decision:** Strategic fields on Airtable Partner Engagements (Start Date, Target Completion, AWS Stakeholders, Partner Stakeholders, Third Parties, Related Program, AWS Relationships, 2026 Partner Plans, Event Meetings) are never touched by Roadrunner → Airtable push.

**Context:** Airtable is the strategic layer. Steven manually manages dates, stakeholders, program links, and plan associations there. Roadrunner only pushes activity data.

**Rationale:** Clear ownership boundaries. Automated sync should enrich, not overwrite. Each system owns specific fields.

**Impact:** pushEngagementToAirtable() only sends: name, pillar, priority, status, tags, partner link, notes, and Roadrunner ID. All other fields are untouched.

---

## 2026-02-16: approval_queue Schema Cleanup

**Decision:** Added CHECK constraint on approval_queue.type limiting to 'engagement_assignment'. Dropped dead entity_data JSONB column (from removed event_creation flow). Migration 021.

**Context:** Diagnostic revealed no CHECK constraint (any string accepted) and a dead column always containing null.

**Rationale:** Schema hygiene. The event_creation approval type was fully removed in a prior session. The column and loose type constraint were remnants.

**Impact:** Tighter schema validation. No functional change (all code already used correct values).

---

## 2026-02-16: Manual Engagement Creation via UI

**Decision:** Added a "New Engagement" form to the Roadrunner dashboard. Engagements can now be created manually without requiring a forwarded email. The form mirrors the existing edit form (name, partner, status, pillar, priority, current state) and feeds into the same createEngagement() → auto-push pipeline as classifier-created engagements.

**Context:** Engagements previously could only originate from two paths: classifier auto-create (≥0.85 confidence) or approval queue resolution. There was no way to track work that originated from Slack, verbal conversations, or proactive planning without forwarding a dummy email.

**Rationale:** Reuses existing infrastructure — createEngagement() in supabase.ts and pushEngagementToAirtable() in sync.ts were unchanged. The POST /api/engagements route follows the same validation and fire-and-forget push pattern as the PUT route. Default status is "active" since manual creates represent work the user is actively choosing to track.

**Impact:** Three creation paths now exist (classifier, approval resolution, manual form), all converging on the same persistence and sync pipeline. CreateEngagementForm.tsx is a self-contained client component. No changes to existing functions or patterns.

---

## 2026-02-16: Sync Delete Propagation

**Decision:** Catalog sync (AT→RR) now detects and hard-deletes orphaned Supabase records when the corresponding Airtable record no longer exists. Engagement delete in Roadrunner now fire-and-forgets a delete to Airtable. SyncResult interface includes a "deleted" counter displayed in the UI.

**Context:** Deleting an AWS Relationship in Airtable and running sync left the record orphaned in Supabase — visible in UI, present in database, and potentially sent to Claude as valid context. The sync only iterated Airtable records for insert/update but never checked for Supabase records missing from Airtable.

**Rationale:** Hard delete over soft delete because these are catalog records — if removed from the authoritative source (Airtable), they should not persist as ghost data. CASCADE foreign keys on junction tables (engagement_aws_relationships, meeting_aws_relationships, entity_links) automatically clean up references. Safety guard: only targets records with a non-null airtable_record_id, so any hypothetical Supabase-only records are never touched.

**Impact:** All three catalog sync functions (programs, events, relationships) now have orphan detection. deleteEngagement() in supabase.ts calls deleteEngagementFromAirtable() via fire-and-forget. New deleteRecord() utility in airtable.ts. SyncButton displays deleted count. Closes a gap where stale data could pollute classifier context.

---

## 2026-02-16: Smart Body Selection for Forwarded Emails

**Decision:** Replaced the naive `strippedText || bodyPlain` body selection with a `selectEmailBody()` function that detects forwarded email content and prefers `body-plain` when Mailgun's `stripped-text` has lost the forwarded thread.

**Context:** Mailgun's `stripped-text` removes "quoted" content — which includes forwarded email threads (the From:/Sent:/To:/Subject: header blocks the parser depends on). For a forwarding-centric app, stripped-text would consistently return only the forwarder's signature line (~30 chars), discarding the actual partner communication (~600-1300 chars).

**Rationale:** Two detection heuristics: (1) body-plain has Outlook forward markers (`From:` + `Sent:` on line starts) that stripped-text lost, or (2) body-plain is 3x+ longer than stripped-text. Falls back to stripped-text for direct (non-forwarded) emails where it's cleaner. Permanent `[BODY]` logging tracks which path is chosen.

**Impact:** Email parser now receives the full forwarded thread instead of just the forwarder's signature. No changes to the parser itself — the fix is upstream in the inbound route's body selection.

---

## 2026-02-16: body-calendar as Primary ICS Source

**Decision:** Added `body-calendar` Mailgun field as the primary ICS source, ahead of inline body-plain extraction and file attachments. Three-path priority: body-calendar → inline VCALENDAR in body-plain → File attachment from FormData.

**Context:** Production diagnostic logging revealed Mailgun sends calendar invites as a dedicated `body-calendar` string field (3775 chars of raw VCALENDAR content), not as File attachments in the FormData payload. The original implementation only checked for File attachments, which only works with multipart/form-data encoding — not URL-encoded fallback.

**Rationale:** body-calendar is the most reliable path because it's always a string field (works with both multipart and URL-encoded payloads). Inline body-plain is a fallback for edge cases where body-calendar isn't set. File attachment is last resort for actual .ics file attachments. All three paths feed into the same `parseICSContent()` function.

**Impact:** ICS meeting creation now works in production. `[ICS]` logging tracks which source path was used for each meeting. Non-blocking: ICS failures never prevent email processing.

---

## 2026-02-16: Eliminate Preface Messages from Email Parser

**Decision:** The email parser no longer creates standalone messages for text that appears before the first forwarded header block (the "preface"). Instead, meaningful preface text is attached to the first real message as `forwarder_note`. Signature-only prefaces are silently discarded.

**Context:** When Steven forwards an email, Outlook places his signature ("Steven Romero | Growth PDM") above the forwarded thread separator. The parser was treating this as a separate message, creating a noise record that wasted a Claude API call and diluted classification context. Every forwarded email produced an extra garbage message.

**Rationale:** The preface is forwarding metadata, not partner communication. Signature patterns (Name | Title, bare names, "Sent from..." lines, separator lines) are stripped. If the remaining text exceeds 20 characters, it's treated as a meaningful forwarder note (e.g., "Please review — high priority partner") and attached to the first real message via `forwarder_note`. Added `forwarder_note?: string | null` to the ParsedMessage type.

**Impact:** Forwarded emails now produce exactly the right number of messages (one per From:/Sent: header block). Test count increased from 67 to 73 with three new test suites covering signature-only, meaningful, and blank preface scenarios.

---

## 2026-02-16: message_id FK on Meetings Table

**Decision:** Added `message_id uuid REFERENCES messages(id) ON DELETE SET NULL` to the meetings table (migration 026) to track which inbound email contained the ICS attachment that created a meeting.

**Context:** Meetings created from ICS parsing had no link back to the source email. Without provenance tracking, there's no way to audit which email produced which meeting or to handle re-processing.

**Rationale:** Nullable FK because manually created meetings have no source message. ON DELETE SET NULL preserves the meeting record if the source message is deleted. Index added for efficient lookups. `createMeetingFromICS()` in supabase.ts accepts an optional `messageId` parameter.

**Impact:** Full audit trail from email → message → meeting. Meeting-to-engagement linking (Phase 2, via `linkMeetingToEngagement()`) can use the message's engagement_id to automatically associate meetings with the right engagement after classification.

---

## 2026-02-16: ICS Parser — Pure TypeScript, No Dependencies

**Decision:** Built the ICS (RFC 5545) parser as pure TypeScript with no npm dependencies. Handles line folding, UTC/TZID timestamps, ORGANIZER/ATTENDEE extraction, and text unescaping.

**Context:** Meeting invite processing requires parsing VCALENDAR/VEVENT content from email attachments or body fields. npm ICS libraries (node-ical, ical.js) are heavyweight and bring transitive dependencies.

**Rationale:** The parser only needs to handle a single VEVENT per calendar (meeting invites, not full calendar feeds). RFC 5545 line folding and property extraction are straightforward to implement. Defensive: returns null for any parse failure rather than throwing. Validation: requires UID, SUMMARY, and DTSTART — returns null if any are missing.

**Impact:** `parseICSContent()` in ics-parser.ts, `extractICSFromAttachments()` for FormData File scanning. Zero new dependencies. Used by inbound route for all three ICS extraction paths.

---

## 2026-02-16: Tracks → Programs Rename

**Decision:** Renamed the "Tracks" entity to "Programs" throughout the codebase — database tables, TypeScript types, API routes, UI components, sidebar navigation, and seed data.

**Context:** "Tracks" was the original internal name, but the entity represents AWS partner programs (ISV Accelerate, Security Competency, Marketplace Co-Sell, etc.). "Programs" is the term AWS uses externally and what partners recognize.

**Rationale:** Align terminology with the domain. Steven uses "programs" in conversation and emails. The Airtable schema already uses "Programs." Having a different internal name creates unnecessary cognitive overhead.

**Impact:** Breaking rename across ~15 files. Database migration renamed the table and updated all CHECK constraints, indexes, and foreign keys. No functional changes — pure terminology alignment.

---

## 2026-02-17: Partners as First-Class Entity

**Decision:** Added partners table to Supabase (migration 027) with catalog sync from Airtable, API routes, list + detail UI pages, and sidebar navigation. Partners are the 4th catalog pull entity.

**Context:** partner_name was a text string guessed by Claude during classification. No structured partner data existed in Roadrunner — engagements and meetings referenced partners by name only.

**Rationale:** Deterministic email-to-partner matching requires structured contact data (emails, names). A real partners table enables FK relationships, contact-based routing, and a partner hub view showing all activity for one partner. Follows the established catalog sync pattern (like programs, events, relationships).

**Impact:** 20 partners synced from Airtable. Partner list + detail pages in UI. Foundation for deterministic classifier matching once contact emails are populated. Partners sync first in catalog pull order since other entities reference them.

---

## 2026-02-17: partner_id FK with Dual-Column Transition Strategy

**Decision:** Added nullable partner_id FK on engagements and meetings (migration 027) alongside existing partner_name text columns. Migration 028 backfills partner_id by matching partner_name to partners.name. Runtime auto-resolves partner_id on create/update. Queries use FK first with text fallback.

**Context:** Removing partner_name immediately would break existing records and the classification pipeline (which outputs partner names, not IDs). Needed a non-breaking migration path.

**Rationale:** Dual-column approach allows gradual transition. partner_id is the real relationship for queries and joins. partner_name stays as denormalized display text and backward compatibility. Belt-and-suspenders queries (FK first, text fallback for unbackfilled rows) ensure zero data loss during transition.

**Impact:** All existing engagements/meetings backfilled where names match. All new records auto-resolve. Partner detail pages show linked activity via FK. Can eventually drop text fallback once all records have partner_id.

---

## 2026-02-17: Partner Contact Emails for Deterministic Matching

**Decision:** Created two new fields in Airtable Partners table: Alliance Lead Email (email type) and Partner Contact Emails (multiline text, semicolon-separated). Synced to Supabase as alliance_lead_email (text) and partner_contact_emails (text[]).

**Context:** The classifier currently guesses partner names from email content. With structured contact emails, it can match sender/recipient addresses to specific partners deterministically.

**Rationale:** Same pattern as AWS Contact Emails on the relationships table. Semicolon-separated text parsed to text[] array provides flexibility without requiring a separate contacts table. Alliance lead gets a dedicated email field since every partner has exactly one.

**Impact:** Once Steven populates these fields in Airtable and syncs, the classifier can match emails like jane@saltsecurity.com → Salt Security without AI guessing. Unblocks the next phase of classifier prompt refinement.

---

## 2026-02-17: Meetings Push to Airtable with Linked Record Resolution

**Decision:** Built complete meetings push following the engagement push pattern: single fire-and-forget (pushMeetingToAirtable) + bulk sync (syncMeetingsToAirtable) + delete propagation. Resolves 4 linked records (partner, event, engagement, AWS relationships). Splits attendees JSONB into AWS Contact(s) and Partner Contact(s) text fields, filtering relay and Salesforce addresses.

**Context:** Meetings existed in Roadrunner (from ICS parsing and manual creation) but didn't sync to Airtable. Engagements already had a working push pattern to replicate.

**Rationale:** Exact pattern replication — same 3-tier match strategy, same change detection, same rate limiting, same error handling. The only new complexity is more linked records (4 vs 1) and the attendees split transform.

**Impact:** Bidirectional sync now complete for all 6 entities. Meetings auto-push on create/ICS-parse/engagement-link/delete. Manual "Push to Airtable" button on meetings page for bulk reconciliation.

---

## 2026-02-17: Two-Tier Sync Model: Auto-Push + Manual Safety Net

**Decision:** Documented and standardized the sync architecture. Activity entities (engagements, meetings) use auto-push fire-and-forget hooks on create/update/delete, with manual bulk push buttons as reconciliation fallback. Catalog entities (partners, programs, events, relationships) use manual pull buttons only. Created docs/sync-architecture.md.

**Context:** The sync model had grown organically across sessions without a clear architectural document. Auto-push hooks existed for engagements but weren't explicitly documented as a pattern. Adding meetings push required deciding whether to replicate the same dual approach.

**Rationale:** Frequently-changing activity data (emails create engagements constantly) benefits from auto-push — users shouldn't need to manually sync after every classification. Rarely-changing catalog data (programs change quarterly) only needs manual pull. The manual button on activity entities serves as a safety net for edge cases where auto-push silently failed.

**Impact:** Clear mental model for sync behavior. Known gaps documented (4 code paths without auto-push hooks). Future entities follow the same pattern based on change frequency.

---

## 2026-02-17: Meeting Notes: Direct Overwrite (No Merge Pattern)

**Decision:** Meeting notes push to Airtable as plain text overwrite, unlike engagements which use a === Roadrunner Activity Summary === marker pattern to protect manually-written Airtable notes.

**Context:** Engagements needed merge logic because users actively write strategic notes in Airtable that shouldn't be overwritten by Roadrunner sync. Meetings are less likely to have manually-written Airtable notes.

**Rationale:** Simpler implementation, lower risk of data loss for meetings. Notes merge is a post-MVP refinement if meeting notes in Airtable become a real workflow.

**Impact:** Simpler meeting sync code. If users start manually annotating meetings in Airtable, will need to add merge logic later.

---

## 2025-02-17: Modular Prompt-Builder Architecture

**Decision:** Context sections for the Claude classifier prompt are built by independent functions in `src/lib/prompt-builder.ts`. Seven builder functions: `buildForwarderSection`, `buildEngagementsSection`, `buildPartnerCatalog`, `buildRelationshipCatalog`, `buildProgramCatalog`, `buildEventCatalog`, `buildEmailContent`. Each returns a markdown section string that is composed into the final user message.

**Context:** Previous prompt construction was monolithic in `claude.ts` — the `buildUserMessage()` function inlined all context assembly. Not reusable, hard to test, couldn't be composed for different consumers.

**Rationale:** Each function is independently importable and testable. Future agents or different prompts (batch re-classification, summary generation, agent workflows) can reuse the same context builders without duplicating logic.

**Impact:** Any new AI consumer calls the same builders. Classification prompt is one consumer, not the owner. `claude.ts` now delegates context assembly to prompt-builder functions.

---

## 2025-02-17: Canonical User Identity via USER_CONFIG

**Decision:** User profile defined in `src/lib/user-config.ts` as a constant (`USER_CONFIG` with name, email, aliases, role, segment). Replaces per-email Mailgun sender inference for forwarder identity. Includes `stripPRVS()` for Proofpoint-wrapped emails, `isCorpmailAddress()` for Amazon SES tracking IDs, and `isUserEmail()` master check combining all variants.

**Context:** Forwarder identity was inferred from Mailgun envelope sender, producing "Steven Terme" (from sterme alias). Amazon SES rewrites From: headers with per-message corpmail tracking IDs (e.g., `{message-id}@corpmail.amazon.com`). Proofpoint wraps addresses in PRVS format (e.g., `prvs=XXXXXX=sterme@amazon.com`).

**Rationale:** Canonical identity eliminates all three failure modes. Single source of truth rather than per-email guessing. `isUserEmail()` centralizes detection for all code paths.

**Impact:** One participant record for the user regardless of email variant. Prevents phantom participants. Future: can move to env vars or settings table.

---

## 2025-02-17: Email-Domain Matching for Partners

**Decision:** Partners matched primarily by sender/recipient email domain (e.g., `@cloudaware.com` → Cloudaware). Contact emails enable specific-person matching. Partner name inference from email content as fallback. Engagement context as final fallback.

**Context:** Claude was guessing partner names from email content with no reference data. 20 structured partner records existed but weren't sent to the classifier.

**Rationale:** Domain matching is deterministic — no LLM inference needed. Contact emails handle edge cases (personal email, consultant). Name inference as fallback when no email matches.

**Impact:** Partner resolution accuracy dramatically improved. As contact emails are populated in Airtable, matching gets progressively more precise.

---

## 2025-02-17: Two-Tier Entity Matching Pattern

**Decision:** Email-matchable entities (Partners, AWS Relationships) use email-first deterministic matching with LLM fallback. Context-matchable entities (Programs, Events) use pure content matching. Different data sent for each: partners get domains + contact emails, relationships get contact emails + org/service, programs get name + type only, events get name + dates + host only.

**Context:** All entities were being sent with full descriptions, wasting tokens on data that doesn't help matching.

**Rationale:** Match the data format to the matching mechanism. Email entities need emails. Content entities need names and types. Descriptions don't help either category match better.

**Impact:** Token budget stays sustainable (~4,200 at current scale, ~6,800 at 3x). Each entity type gets exactly the data Claude needs for matching, nothing more.

---

## 2025-02-17: Token Optimization via Compact Reference Catalogs

**Decision:** Program descriptions and event descriptions/locations dropped from classifier prompt. Programs sent as `ID|Name|Type`. Events sent as `ID|Name|Dates|Host`.

**Context:** Full descriptions added ~2,000 tokens at current scale (34 programs, 32 events) without improving match accuracy.

**Rationale:** Claude can match "Security Competency" and "RSA Conference 2026" by name alone. Descriptions are for human comprehension, not entity matching.

**Impact:** ~2,000 tokens saved at current scale. At 3x portfolio growth, still well within context window. Can re-add descriptions selectively if matching accuracy suffers.

---

## 2025-02-17: Active/Planned Engagement Filtering for Classifier Context

**Decision:** Only engagements with status `active` or `planned` sent to Claude. Completed and archived engagements excluded from classification context.

**Context:** Every engagement in the database was being sent to Claude, regardless of status. As portfolio grows, this would blow out the token budget.

**Rationale:** Completed engagements shouldn't receive new emails. If an old thread resurfaces, Claude creates a new engagement rather than appending to a closed one — which is the correct behavior.

**Impact:** Primary scaling lever for the classifier. 50 active engagements ≈ 2,000 tokens. 200 total engagements with 50 active = same 2,000 tokens.

---

## 2025-02-17: forwarder_note Pipeline Completion

**Decision:** Forwarder's added text (parsed from email body, >20 chars after stripping signatures) is now stored in `messages.forwarder_note` column and included in Claude's prompt as a labeled section before the email chain. Migration 029 adds the column.

**Context:** Email parser correctly extracted forwarder notes but the data was never stored in Supabase and never sent to Claude — a dead-end pipeline.

**Rationale:** Forwarder notes contain intent signals ("FYI — urgent partner request") that Claude needs for accurate classification and priority inference.

**Impact:** Forwarder context reaches Claude for the first time. Enables future features like automatic priority escalation based on forwarder notes.

---

## 2025-02-17: matched_relationships in Classification Output

**Decision:** Claude's JSON response includes `matched_relationships` array with `{ id, name, relationship_type }` (involved_in, consulted, introduced, escalated_to). Persisted via `engagement_aws_relationships` junction table. Progressive linking: relationships added to Airtable and synced down are automatically linked when future emails match.

**Context:** AWS relationships existed in the database but Claude couldn't link emails to them. No mechanism to associate engagements with AWS team relationships.

**Rationale:** Organic, additive linking — the system gets smarter as you add data. No manual linking required. Junction table supports many-to-many (engagement ↔ relationship).

**Impact:** AWS team involvement tracked automatically. Enables future reporting on which AWS teams are most active across partner engagements.

---

## 2025-02-17: Participant Identity Canonicalization

**Decision:** `upsertParticipants` uses `isUserEmail()` to detect all user email variants (exact match, aliases, PRVS-wrapped, SES corpmail). When matched, always normalizes to `USER_CONFIG.email` and `USER_CONFIG.name`. Non-user participants retain fill-only behavior (don't overwrite existing names). Migration 030 consolidated 9 stale Steven records into 1 canonical record.

**Context:** 9 duplicate participant records for Steven existed — "Steven Terme", "PDM Forwarder", PRVS addresses, SES corpmail IDs. The upsert only filled empty names, never corrected wrong ones.

**Rationale:** User email appears in many forms due to Amazon infrastructure. Centralizing detection in `isUserEmail()` handles all variants. Non-user participants keep conservative fill-only to avoid overwriting correct names with typos.

**Impact:** One canonical participant record per user. Prevents future fragmentation. Pattern extensible to multi-user support later.

---

## 2025-02-17: AWS Relationship Architecture Needs Partner Decoupling (PLANNED)

**Decision:** Current Airtable schema ties AWS Relationships to a single partner. This should change — relationships should be partner-agnostic at the catalog level, with the per-partner connection happening through engagement linking (junction table).

**Context:** The Multicloud Team works with multiple partners, not just Cloudaware. Tying the relationship to one partner limits scale and accuracy.

**Rationale:** The `engagement_aws_relationships` junction table already supports many-to-many. The catalog record shouldn't constrain what the junction table enables.

**Impact:** Deferred to next session. Requires Airtable schema discussion and migration planning. No code change yet.

---

## 2026-02-17: AWS Relationships Partner Decoupling

**Decision:** Removed `partner_name` column from `aws_relationships`. Relationships are partner-agnostic catalog records. Partner context flows through `engagement_aws_relationships` and `meeting_aws_relationships` junction tables per-activity.

**Context:** AWS Relationships had a Partners linked-record field in Airtable creating false 1:1 ownership. "Multicloud Team" linked to Cloudaware but could be relevant to any partner.

**Rationale:** Relationships describe AWS team structures, not partner ownership. The real partner↔relationship connection is per-engagement via junction tables, not a static property of the relationship itself.

**Impact:** Migration 031 drops column + index. Removed from types.ts, sync.ts (no longer resolves Partners link), UI list/detail pages. Airtable Partners field manually deleted. 9 files changed.

---

## 2026-02-17: Open Items Prompt Visibility + Auto-Resolution

**Decision:** Claude now sees existing `open_items` (resolved + unresolved) in the engagement context. New `resolved_open_items` output field enables auto-completion. Matching uses bidirectional >50% keyword overlap.

**Context:** Claude previously had no visibility into existing open items, causing semantic duplicates ("send the doc" vs "deliver the document") and inability to auto-resolve completed tasks.

**Rationale:** Showing Claude existing items prevents duplicates at the source. Auto-resolution via keyword matching is conservative (fails open) with manual checkboxes as fallback.

**Impact:** prompt-builder.ts shows open items per engagement. claude.ts system prompt updated with visibility + resolution instructions. types.ts adds `resolved_open_items`. classifier.ts calls `resolveOpenItems()`. supabase.ts adds `matchResolvedItems()` with keyword extraction. 20 new tests.

---

## 2026-02-17: No previous_current_state Safety Net

**Decision:** No backup column for `current_state` before overwrite. Recovery exists via `classification_result` JSONB on each message record.

**Context:** Considered adding `previous_current_state` to protect against Claude writing bad state that drops context.

**Rationale:** The correct approach is making classification reliable, not building safety nets for unreliable classification. Message-level `classification_result` JSONB provides implicit history.

**Impact:** Simpler schema. Focus shifts to prompt quality and testing.

---

## 2026-02-17: Two-Pass Recursive Email Parser

**Decision:** Parser runs Outlook header split (Pass 1), then recursively splits Gmail/generic quotes within each extracted message (Pass 2). New `splitQuotedReplies()` function handles recursion with depth limit of 5. Messages sorted chronologically after splitting.

**Context:** Real-world emails mix formats — Outlook wraps the forward, Gmail "On... wrote:" quotes exist within message bodies. Original parser treated these as mutually exclusive paths.

**Rationale:** Every message body is potentially a container for more quoted messages regardless of outer format. Recursive splitting naturally handles threads-within-threads. Chronological sorting makes timeline display straightforward.

**Impact:** Handles Outlook, Gmail, Apple Mail, generic separators (`---- Original Message ----`), and mixed-format threads. 72 email-parser tests (up from 26). Foundation for clean UI timeline display.

---

## 2026-02-17: CRLF Normalization at Parser Entry

**Decision:** Normalize `\r\n` → `\n` and bare `\r` → `\n` at the very top of `parseForwardedEmail()` before any regex matching.

**Context:** Mailgun delivers body-plain with `\r\n` (CRLF) line endings. Node.js `.` does not match `\r`, causing ALL Outlook header regexes to fail silently. Every real email was falling through to single-message fallback.

**Rationale:** Normalizing input is simpler and more robust than modifying every regex pattern. Single line fix catches all edge cases including mixed and bare CR line endings.

**Impact:** Fixed the root cause preventing all real email thread splitting in production. 8 new CRLF-specific tests.

---

## 2026-02-17: Per-Message Dedup via Fingerprinting

**Decision:** Messages deduplicated by fingerprint (`lowercase(sender_email) + "|" + body_text.trim().slice(0,100)`) before insertion. Checks against last 30 days of messages.

**Context:** Re-forwarding a thread with one new reply would create duplicate records for all old messages in the thread.

**Rationale:** Fingerprinting is fast (single query), deterministic, and handles the common case of thread re-forwarding. 30-day window prevents unbounded lookups while covering all realistic re-forward scenarios.

**Impact:** `storeMessages()` filters duplicates before insert. Logs `[DEDUP]` when skipping. 6 new dedup tests.

---

## 2026-02-17: Forwarder Identity from USER_CONFIG for Corpmail/PRVS

**Decision:** When Mailgun sender matches any known user email variant (corpmail, PRVS, aliases via `isUserEmail()`), `forwarder_name` and email fall back to `USER_CONFIG` canonical values.

**Context:** Amazon SES rewrites the From header to corpmail tracking IDs (`0101019c...@corpmail.amazon.com`). `parseSenderField()` couldn't extract a name from these.

**Rationale:** The PDM is always the forwarder in the current architecture. Canonical identity should be consistent regardless of email routing artifacts.

**Impact:** Forwarder always displays as "Steven Romero" / "sterme@amazon.com" in the UI.

---

## 2026-02-17: Direct-to-Relay Not MVP

**Decision:** Non-forwarded emails (partner sends directly to relay address) are not supported for MVP. All emails will be forwarded by the PDM.

**Context:** Direct emails would set the partner as the "forwarder" since Mailgun's sender field would be the partner contact, not the PDM.

**Rationale:** Supporting direct emails requires distinguishing "PDM forwarded this" from "someone emailed relay directly" — added complexity with no immediate use case.

**Impact:** Forwarder identity logic stays simple. Revisit if direct-to-relay becomes needed.

---

## 2026-02-17: Meetings from Text Stay Prose-Only

**Decision:** Meeting mentions in email text (no ICS attachment) stay in `current_state` narrative only. Only ICS attachments create structured meeting records.

**Context:** Emails often mention "let's meet Thursday at 2pm" without a calendar invite. Could extract lightweight meeting signals.

**Rationale:** Clean separation between structured calendar data (ICS) and conversational references. Parsing "let's meet" from email text is unreliable and creates low-confidence records.

**Impact:** Meetings table stays high-confidence (ICS-sourced only). Meeting mentions are captured in `current_state` prose.

---

## 2026-02-18: Partner Classification Taxonomy: Segment + Focus Area

**Decision:** Replace Category (Infrastructure/HBA/Industry Vert) and Sub-Category (freeform text) with Segment (singleSelect: Security, SecOps, DevOps, CloudOps, Observability, OT/IoT) and Focus Area (multipleSelects: 18 domain-specific options).

**Context:** The old taxonomy was stale — nearly every partner was "Infrastructure" which told you nothing. Sub-Category was freeform text with inconsistent concatenated paths like "Infrastructure - Security - Network Security."

**Rationale:** Two-field model separates "who buys this" (Segment = customer team) from "what they do" (Focus Area = specific niche). Segment is stable and grows slowly. Focus Area is granular and extensible. Multiple select on Focus Area allows partners like Cloudaware to span Asset Management + Compliance.

**Impact:** sync.ts field mappings updated (PTRF.segment, PTRF.focusArea), partner detail page shows Segment badge + Focus Area chips in header, sidebar shows contact fields only. Partners list page filters by Segment. Prompt builder sends Segment/Focus Area context to Claude. All 20 partners backfilled.

---

## 2026-02-18: AWS Context Fields Synced to Roadrunner

**Decision:** Sync AWS Stickiness (text) and Key AWS Services (multipleSelects) from Airtable to Roadrunner. Display as a separate "AWS Context" sidebar section on partner detail pages.

**Context:** These fields existed in Airtable but were never pulled into Roadrunner. AWS Stickiness is a narrative about customer AWS adoption likelihood. Key AWS Services lists which AWS services the partner integrates with.

**Rationale:** Both fields are valuable for understanding partner-AWS fit at a glance. Displaying them separately from contact info creates a clean "who are they" vs "how do they relate to AWS" grouping.

**Impact:** Two new DB columns (aws_stickiness text, key_aws_services text[]), new PTRF sync constants, partner detail page has new AWS Context section. Migration 033.

---

## 2026-02-18: Component Directory Organization

**Decision:** Reorganize src/components/ from 25 flat files into 5 subdirectories: actions/ (5), engagement/ (4), inbox/ (4), layout/ (4), shared/ (8).

**Context:** Flat directory was navigable but didn't communicate component purpose. As the component count grows, grouping by function prevents the "wall of files" problem.

**Rationale:** Groups map to functional areas: actions/ = entity CRUD buttons, engagement/ = engagement-specific cards, inbox/ = review queue UI, layout/ = app structure, shared/ = reusable primitives. No barrel exports — direct imports are more explicit.

**Impact:** 18 files updated with new import paths. Pattern established for future component additions.

---

## 2026-02-18: Twilio/SMS Removal

**Decision:** Remove all Twilio/SMS integration. Approval queue notifications happen exclusively via the Inbox web UI.

**Context:** SMS was a convenience layer — when classifier confidence was below 0.85, it would text the user. The Inbox UI already handles review, making SMS redundant.

**Rationale:** Removes a third-party dependency (31 npm packages), simplifies the classifier (no SMS branching), eliminates 4 env vars. The Inbox UI is a better review experience than SMS anyway — you can see context, modify classifications, batch resolve.

**Impact:** 4 files deleted, 6 files modified, twilio package removed. Classifier creates approval_queue items but no longer sends SMS. 176 tests (down from 185 — 9 SMS tests removed). Legacy sms_sent/options_sent DB columns remain as nullable.

---

## 2026-02-18: Documentation Restructure: Purpose-Driven Docs

**Decision:** Replace 4 outdated docs (master-spec, goal-state, sync-architecture, field-mapping-guide) with 6 purpose-driven docs: PROJECT.md, ARCHITECTURE.md, DATA-MODEL.md, CLASSIFICATION.md, DEVELOPMENT.md, FIELD-MAPPING.md.

**Context:** Existing docs described what was planned, not what was built. master-spec had 70+ references to "initiatives" (now engagements) and 30+ Twilio references. No single doc could orient a fresh Claude Code session.

**Rationale:** Each doc answers one question: "what is this?" (PROJECT), "how is it built?" (ARCHITECTURE), "what data exists?" (DATA-MODEL), "how does the AI work?" (CLASSIFICATION), "how do I work on it?" (DEVELOPMENT), "what are the field IDs?" (FIELD-MAPPING). Maps to the Sherpa diagnostic workflow — read the relevant doc before working.

**Impact:** README updated with documentation table. Best content from old docs preserved (principles, classification rules, events ARE/ARE NOT distinction, removal rationale). All docs reflect actual implemented state as of 2026-02-18.

---

## 2026-02-18: AWS Relationships Decoupled from Partner-Specific Data

**Decision:** Remove Strength, Partner Programs link, Partner Event Status link, and Last Touch from AWS Relationships table.

**Context:** Strength (Strong/Building/New/Deferred) was originally per-partner — "how strong is this relationship for Partner X." When relationships were decoupled from single-partner ownership (can link to multiple engagements across partners), per-partner strength became meaningless. Partner Programs and Partner Event Status links were Tier 2 enrollment data that doesn't belong on AWS team records. Last Touch is redundant with meeting dates.

**Rationale:** AWS Relationships should be pure team/person records. Their connection to partners flows through engagements and meetings, not through enrollment data. "Last touch" is derivable from the most recent linked meeting.

**Impact:** Migration 034 drops strength column. sync.ts, types.ts, prompt-builder, detail/list pages, action components all cleaned. 13 files modified, zero TypeScript errors.

---

## 2026-02-18: Dead API Route Cleanup Pattern

**Decision:** Delete /api/inbox/route.ts (unused GET list endpoint). Establish pattern: list pages use server components querying Supabase directly; API routes exist only for client-side mutations and external webhooks.

**Context:** The inbox page queries Supabase via server component, making the API GET route redundant. Same pattern exists for partners, programs, and relationships list pages.

**Rationale:** Server components are simpler and faster for reads — no API hop needed. API routes exist for: mutations (POST/PUT/DELETE from client components), webhooks (Mailgun, health check), and dev tools (classify/test).

**Impact:** 1 file deleted. Pattern documented for future reference. /api/inbox/count/route.ts preserved (used by Sidebar badge).

---

## 2026-02-18: Meetings Primary Field: Formula → Writable Text

**Decision:** Convert Meeting Name from a formula field to a writable singleLineText field. Roadrunner writes meeting.title directly.

**Context:** The formula field was fragile — it concatenated partner name + event name + date, breaking when any input was missing. Roadrunner generates better titles from classification context.

**Rationale:** Writable field gives Roadrunner full control over meeting display names. Backfilled all 14 existing records with clean, descriptive names (stripped leading dashes, added context in parentheses). Same field ID preserved — just type changed.

**Impact:** sync.ts writes meeting.title → Meeting Name. 3-tier match strategy uses title + date as fallback. All 14 records cleaned up.

---

## 2026-02-20: meetings.program_id — Decision Revised

**Decision:** Earlier decision "Meetings Don't Link Directly to Programs" was revised during implementation. Migration 032 added program_id FK to meetings, and Airtable Meetings table has a Program field (fldqhPAGvYppRZgCS). The link is valid — meetings like "KnowBe4 GTM Meeting (SMB Competency)" naturally reference a program.

**Context:** The original decision reflected an earlier design phase where meetings were conceptualized as purely engagement-scoped. In practice, meetings about program enrollment or compliance reviews have a direct program relationship that is a property of the meeting itself, not inherited from the engagement.

**Rationale:** The implementation is correct. Updating decisions.md to match reality rather than reverting the implementation to match an outdated decision.

**Impact:** No code changes. This entry corrects the decision log to reflect the implemented and correct behavior. meetings.program_id FK remains, Airtable sync writes program link.

---

## 2026-02-20: Legacy SMS Columns Dropped from approval_queue

**Decision:** Removed `options_sent`, `sms_sent`, `sms_sent_at` from the `approval_queue` table and all code references.

**Context:** These were remnants of the Twilio/SMS notification system removed in a prior session (Decision: "Twilio/SMS Removal", 2026-02-18). The columns were never written to after SMS removal. The `options_sent` field also powered a dead "select" action in the resolve route and rendered ghost buttons in ReviewCard — both paths unreachable since options_sent was never populated.

**Rationale:** Dead columns and dead code paths are maintenance traps. Removing them eliminates confusion about which resolve actions are actually supported (skip, new) vs. which are legacy (select).

**Impact:** Migration 036 drops 3 columns. Removed deprecated fields from ApprovalQueueItem type, dead "select" action handler from resolve route, ghost options rendering from ReviewCard. 5 files changed. No functional impact — purely schema and code hygiene.

---

## 2026-02-21: Sidebar Nav Reorder

**Decision:** Reorder sidebar navigation to follow workflow adjacency: Inbox → Engagements → Partners → Meetings → Events → Programs → Relationships.

**Context:** The previous order (Inbox, Engagements, Partners, Events, Relationships, Meetings, Programs) grouped entities alphabetically rather than by usage frequency. Meetings and Events are consulted together when scheduling; Programs and Relationships are reference data accessed less often.

**Rationale:** Workflow-adjacent grouping reduces scroll distance for the most common navigation sequences. Meetings moves up next to Partners (the entities most often cross-referenced), while reference-only views (Programs, Relationships) move to the bottom.

**Impact:** Sidebar.tsx navItems array reordered. No route or page changes.

---

## 2026-02-21: FilterBar v2 — Single-Select Behavior

**Decision:** Replace the current multi-select toggle-pill FilterBar with a single-select dropdown/chip pattern. Only one filter value active at a time per dimension.

**Context:** The existing FilterBar uses `Set<string>` to allow multiple simultaneous selections (e.g., "active" + "paused" statuses). In practice, users almost always filter to a single value. Multi-select adds visual clutter and interaction complexity with no demonstrated benefit for a single-user app.

**Rationale:** Single-select is simpler to implement, easier to read at a glance, and matches the actual usage pattern. The "All" state (no filter) remains the default.

**Impact:** FilterBar.tsx rewrite. All consumer pages (Engagements, Partners, Events, Programs, Meetings, Relationships) update their filter state from `Set<string>` to `string | null`. Net reduction in code complexity.

---

## 2026-02-21: Phase 2 Build Sequence

**Decision:** Phase 2 UI foundation components will be built in this order: (1) Sidebar reorder, (2) FilterBar v2, (3) CompactRow, (4) DetailHeader.

**Context:** Each component builds on the previous. Sidebar reorder is a trivial array change that validates the dev workflow. FilterBar v2 touches every list page but is self-contained. CompactRow standardizes list items across all entity pages. DetailHeader standardizes detail page headers.

**Rationale:** Ordering by dependency and blast radius — smallest change first, widest-reaching last. Each step is independently shippable and testable.

**Impact:** Defines the implementation sequence for the next 4 PRs.

---

## 2026-02-21: PostgREST Schema Cache — Restart Required

**Decision:** After running Supabase migrations that add new columns, the Supabase project must be restarted (Settings → General → Restart project) before PostgREST will accept writes to those columns.

**Context:** Migration 037 added `geo` to events and `what_they_do` to partners. The migration succeeded (columns exist in the database), but PostgREST continued to silently drop these fields on INSERT/UPDATE because its schema cache was stale. This produced no errors — upserts succeeded but the new columns stayed NULL.

**Rationale:** PostgREST caches the database schema at startup. New columns are invisible to the API until the cache refreshes. On Supabase free tier, there is no `NOTIFY pgrst` channel to trigger a live reload — a full project restart is the only reliable method.

**Impact:** Two-step deployment required for schema changes: (1) run migration + restart Supabase project, (2) deploy code to Vercel. Order matters — code deployed before restart will also silently drop the new fields.

---

## 2026-02-21: Canonical Event Count — 43

**Decision:** The canonical event count in the system is 43 (as of 2026-02-21), not 54 as previously referenced in some planning documents.

**Context:** During Airtable sync verification, the actual event count was confirmed as 43. The "54 events" figure appeared in early planning estimates before deduplication and data cleanup.

**Rationale:** Accurate counts prevent confusion when debugging sync issues or validating data integrity.

**Impact:** Reference data only. No code changes. Future sync validations should expect ~43 events (will grow as new events are added).

---

## 2026-02-21: Composition-Based Slot Architecture for UI Components

**Decision:** CompactRow (primary/badges/secondary/meta) and DetailHeader (title/badges/subtitle/fields/actions) replace all per-entity inline markup.

**Context:** Six list pages and six detail pages each had their own card/header markup with inconsistent padding, badge placement, and field layouts.

**Rationale:** Composition over inheritance. Components define visual slots, pages fill them. Avoids god-components with 30 props. React-idiomatic, easy to test, adding a new entity means writing one mapping function.

**Impact:** All list pages use CompactRow, all detail pages use DetailHeader. Changing row/header styling is now a single-file edit. Skill doc captures slot mappings per entity for future sessions.

---

## 2026-02-21: FilterBar Single-Select Pattern

**Decision:** One active filter at a time (string | null), click to select exclusively, click again to deselect back to All.

**Context:** Multi-select filters (Set<string>) caused confusion — users could combine filters and get empty results without understanding why.

**Rationale:** Chip/pill UI gives full landscape at a glance. One tap to filter, tap again to reset. Dropdown hides options behind click. Segmented control doesn't scale past 4 options.

**Impact:** All 5 FilterBar consumers converted. Second filter dimensions (like Events year) use separate chip rows, not modifications to FilterBar.

---

## 2026-02-21: Sidebar Navigation Priority Gradient

**Decision:** Nav order is Inbox → Engagements → Partners → Meetings → Events → Programs → Relationships.

**Context:** Previous order didn't reflect usage patterns. Relationships were 5th despite being a reference catalog.

**Rationale:** Priority gradient: action items → active work → portfolio → time-bound → reference catalogs. Meetings moved up (time-sensitive), Events/Programs/Relationships moved down (reference).

**Impact:** New nav items should be inserted based on this principle.

---

## 2026-02-21: Detail Belongs on Detail Pages

**Decision:** List rows show entity identity + one key context line only. Eligibility (programs), contact info (relationships), description (events) dropped from list rows.

**Context:** List rows were trying to show too much, reducing scan density and duplicating information that has full space on detail pages.

**Rationale:** Higher information density on lists. Each entity must earn its detail page visit. Detail pages now use DetailHeader subtitle for the primary descriptive text (what_they_do for partners, current_state for engagements, description for programs).

**Impact:** All 6 list pages follow this pattern. Slot mappings documented in .claude/skills/roadrunner-ui/references/entity-catalog.md.

---

## 2026-02-21: Skill Doc as Design System Source of Truth

**Decision:** roadrunner-ui skill installed in .claude/roadrunner-ui/ with SKILL.md (234 lines) + 3 reference files (component-api.md, entity-catalog.md, design-tokens.md).

**Context:** Design decisions were scattered across conversation context and lost between sessions.

**Rationale:** Progressive disclosure — SKILL.md body loaded on trigger, reference files loaded on demand. Under 500 lines per spec. Future sessions read the same patterns automatically.

**Impact:** All future UI work in Claude Code starts from this skill. Update the skill to change conventions globally.

---

## 2026-02-21: Migration Verification Required After Supabase Applies

**Decision:** Always verify column existence after running migrations, especially multi-statement ones.

**Context:** Migration 022 partially failed — ALTER TABLE ADD COLUMN event_id silently failed while other statements succeeded. Events detail page crashed server-side on the missing column.

**Rationale:** Supabase migrations can partially fail without clear error reporting. PostgREST schema cache adds another layer of silent failure.

**Impact:** Add post-migration verification step to future migration workflows. Two checks: (1) column exists via SELECT, (2) PostgREST accepts the column via REST API query.

---

## 2026-02-22: Two-Phase Classification Architecture

**Decision:** Split email classification into Phase 1 (Match — lightweight routing) and Phase 2 (Analyze — deep analysis with full thread history). Phase 1 identifies which engagement an email belongs to using a compact index. Phase 2 produces current_state, open_items, participants, and entity matches with access to the engagement's complete email history.

**Context:** Single-phase classification sent full engagement context (current_state, open_items for ALL engagements) on every call, wasting tokens. Claude only saw a compressed summary, never the actual source emails, leading to state drift and inability to verify previous classifications.

**Rationale:** Two cognitive tasks (routing vs. analysis) deserve different context windows. Phase 1 needs breadth (see all engagements). Phase 2 needs depth (see full history of one engagement). Splitting them optimizes both. Phase 1 context: ~2K tokens. Phase 2 context: ~6-17K tokens depending on history depth.

**Impact:** Every email now goes through two Claude API calls instead of one. Phase 1 is fast/cheap (~500 tokens response). Phase 2 is thorough. Total cost per email is slightly higher but accuracy is significantly better. Files: classifier.ts (orchestration), phase1-prompt.ts (new), phase2-prompt.ts (new), claude.ts (two new API functions).

---

## 2026-02-22: Phase 2 Receives Full Email History

**Decision:** Phase 2 sees all source emails for the matched engagement (chronologically ordered, full body text) plus the existing current_state as an "anchor" to evolve.

**Context:** Previously Claude only saw the current_state paragraph (which it wrote last time) plus the new email. This created a game-of-telephone effect where each update slightly drifted from reality. Claude couldn't verify what it previously summarized.

**Rationale:** Even a 50-message engagement is only ~12K tokens of body text. Well within the 200K context window. Giving Claude the raw source material produces more accurate summaries and prevents information loss. The existing current_state serves as an anchor so Claude doesn't randomly restructure the summary.

**Impact:** More accurate current_state evolution. Claude can detect contradictions, understand the full narrative arc, and correctly identify what's genuinely new. Token cost per Phase 2 call scales with engagement size but remains manageable.

---

## 2026-02-22: Open Items Threshold — Blockers and Commitments Only

**Decision:** Open items must be "worth mentioning in a status update to leadership." Only concrete commitments, explicit blockers, and deadline-bearing requests qualify.

**Context:** The previous prompt extracted granular tasks ("I'll update the spreadsheet", "send follow-up email") that cluttered the UI and weren't useful for strategic tracking.

**Rationale:** Roadrunner is a relationship intelligence tool, not a task manager. PDMs need to see "Complete Security Competency technical review" not "send email to John." The threshold ensures open_items are actionable at the right altitude.

**Impact:** Fewer, higher-quality open items per engagement. Reduces noise in the UI. May need calibration through testing.

---

## 2026-02-22: Tags Removed from Classification

**Decision:** Removed suggested_tags from both Phase 1 and Phase 2 prompts, removed tag pills from engagement detail UI, removed tag merging from persistence layer. Tags column preserved in DB.

**Context:** Tags were freeform lowercase labels with no controlled vocabulary. They overlapped with pillar (categorical classification) and current_state (descriptive context) without serving a distinct purpose.

**Rationale:** Pillar (Co-Sell/Co-Build/Co-Market) handles the categorical work. Current_state handles the descriptive work. Tags were a middle ground nobody would filter by. Removing them gives Claude fewer things to generate, improving focus on what matters.

**Impact:** Cleaner UI, simpler prompt, tags column still in DB for potential future use.

---

## 2026-02-22: Pillar Inference (Co-Sell / Co-Build / Co-Market)

**Decision:** Added pillar classification to Phase 2 output. Co-Sell = revenue/deals/marketplace. Co-Build = integrations/certifications/technical. Co-Market = events/content/campaigns. Null if unclear.

**Context:** Needed categorical classification to replace tags. Pillar is a well-understood AWS partner framework concept that maps directly to how PDMs think about their work.

**Rationale:** Three categories are manageable, meaningful, and map to real business constructs. Claude infers from full context (history + new email). Null is acceptable for early-stage engagements.

**Impact:** Engagements now have a pillar field. Enables future filtering/grouping by work type. Written to DB by persistence layer.

---

## 2026-02-22: Defined Participant Role Vocabulary

**Decision:** Replaced freeform participant roles with a defined set: forwarder, partner_contact, aws_stakeholder, executive, technical_contact, third_party.

**Context:** Previous freeform roles produced inconsistent values like "sender", "cc'd", "recipient" — routing metadata rather than meaningful relationship descriptors.

**Rationale:** Constrained vocabulary produces consistent data that enables filtering and aggregation. Six roles cover all real-world cases for AWS PDM workflow.

**Impact:** More useful participant data. Enables future features like "show me all executives involved in my engagements."

---

## 2026-02-22: Inbox Resolve Runs Phase 2

**Decision:** When a user manually assigns an email to an engagement from Inbox, Phase 2 runs with the correct engagement's full history before persisting results.

**Context:** Previously, the single-phase classification result (written without knowing the correct engagement) was used directly. This produced inaccurate current_state updates.

**Rationale:** Phase 2 needs the correct engagement context to produce accurate analysis. Running it after user assignment ensures the current_state, open_items, and participant extraction are all informed by the right history.

**Impact:** Better accuracy for manually-resolved emails. Slightly slower resolve flow (adds one API call).

---

## 2026-02-22: Sonnet for Both Phases Initially

**Decision:** Use claude-sonnet-4-20250514 for both Phase 1 and Phase 2. May downgrade Phase 1 to Haiku after routing accuracy is proven.

**Context:** Phase 1 is pure pattern matching that could work with Haiku. But getting routing wrong cascades into Phase 2 analyzing the wrong engagement.

**Rationale:** Start safe, optimize later. Cost difference is negligible for single-user app. Speed difference (Haiku ~500ms vs Sonnet ~2s) is noticeable but not blocking.

**Impact:** Can be changed with a single model parameter swap in claude.ts after confidence in routing accuracy.

---

## 2026-02-24: Remove Priority Field

**Decision:** Priority field removed entirely from engagement model.

**Context:** Field was never set by classification, never used by PDMs, showed "—" on every engagement.

**Rationale:** Dead weight in schema, UI, prompts, and sync. Removing simplifies the entire engagement model.

**Impact:** Removed from DB (migration 038), types, supabase.ts, sync.ts, 2 API routes, 3 UI components, 5 test files.

---

## 2026-02-24: Remove Open Items Entirely

**Decision:** Open items (extraction, resolution, display) removed from the system.

**Context:** AI extraction of actionable items from email threads is too subjective. More likely to produce "that's wrong" reactions than value. Each PDM manages their own tasks.

**Rationale:** Roadrunner's job is summarizing engagement state, not task management. The "leadership altitude" test helped but the fundamental problem is subjectivity in interpreting email threads as tasks.

**Impact:** Removed from DB, types, classifier (mergeOpenItems, matchResolvedItems, resolveOpenItems), Phase 2 prompt, sync, API routes, OpenItemsCard component, 6 test files (13 dedicated tests removed).

---

## 2026-02-24: Simplify Status to Active/Planned/Archived

**Decision:** Engagement status reduced from 5 values (planned, active, paused, completed, archived) to 3 (active, planned, archived).

**Context:** "Paused" and "completed" didn't map to how PDMs think about engagements. They're either active or they're not, with "planned" as a holding state.

**Rationale:** Completed vs archived distinction doesn't matter operationally. Paused is just archived-you-might-reopen. Simpler model = less cognitive overhead.

**Impact:** Migration converts existing paused/completed to archived. Updated CHECK constraint, types, API validation, sync mapping, StatusBadge, all forms.

---

## 2026-02-24: Unified Timeline Architecture

**Decision:** Engagement detail page renders messages and meetings in a single chronologically-sorted timeline. Meetings are first-class timeline items positioned by meeting_date.

**Context:** Previously meetings piggybacked on their linked message's position via meetingsByMessageId lookup. A Feb 26 meeting appeared between Feb 20 and Feb 19 emails because the ICS was received with a Feb 20 message.

**Rationale:** Meetings are independent events with their own dates. A PDM looking at an engagement timeline expects chronological order. Both the meeting and its source email appear at their own dates.

**Impact:** New TimelineItem union type, unified timeline builder in page.tsx, Timeline.tsx renders by type, removed meetingsByMessageId piggybacking, section renamed from "Source Emails" to "Timeline".

---

## 2026-02-24: Sender Name Sanitize-First Pattern

**Decision:** parseSenderField() normalizes input (strip mailto artifacts, collapse brackets) before applying regex. displayName() includes defensive extraction for raw headers in the email field.

**Context:** Outlook's double-bracket mailto format ("Name <email<mailto:email>>") caused regex failure, dumping entire raw header into sender_email with sender_name: null.

**Rationale:** Sanitize-before-regex is more robust than adding regex alternatives. Handles unknown future noise patterns. Display-layer defense handles any bad data that leaks through. Comma-inverted names ("Last, First") flipped as part of normalization.

**Impact:** parseSenderField() pre-normalizes all inputs, displayName() defends against raw headers, handles comma inversion and 2-letter initials. 15 new tests.

---

## 2026-02-24: Graceful Degradation for Email Parsing

**Decision:** Three-tier parsing philosophy — high confidence (Outlook/Gmail headers), medium confidence (non-standard markers), low confidence (generic separators with metadata inheritance/fallback).

**Context:** Perfect email parsing is impossible across hundreds of clients. Rather than chasing every edge case, the system should degrade gracefully.

**Rationale:** Never lose content, always try metadata extraction, fall back through sent_at → forwarded_at → created_at. The display layer should handle nulls gracefully rather than requiring perfect extraction.

**Impact:** Establishes principle for all future parser work. Timeline already implements the date fallback chain.

---

## 2026-02-24: Remove Route-Level Dedup Gate

**Decision:** Removed the route-level dedup check in inbound/route.ts that compared only the first (oldest) parsed message. Now rely entirely on storeMessages() per-message fingerprint dedup.

**Context:** When re-forwarding a thread with new messages, the oldest message matched the dedup check and silently dropped the entire batch — including new messages. Users got no error, Mailgun got 200, messages vanished.

**Rationale:** The per-message dedup in storeMessages() already handles this correctly — it checks each message individually and only inserts new ones. The route-level gate was a premature optimization that broke the critical re-forward use case.

**Impact:** Re-forwarded threads with new replies now work correctly. Slightly more DB work on true duplicates (fingerprint check vs early abort), but correctness over performance.

---

## 2026-02-24: Engagement Slot Registry — Structured Fields

**Decision:** Added topic (3-8 words), goal (1 sentence), and engagement_type (nullable, taxonomy TBD) as structured fields on the engagements table alongside the existing current_state narrative.

**Context:** Engagements were a freeform name + one big prose paragraph. This made matching unreliable (semantic comparison of blobs), naming inconsistent (Claude invented titles), and display hard to scan. Needed structured fields for deterministic matching and quick-scan display.

**Rationale:** Follows "constrained intelligence" principle — Claude populates defined fields instead of generating freeform content. topic + partner_id gives deterministic matching. "{Partner} - {topic}" gives consistent naming. goal gives stable elevator pitch. current_state stays for the full narrative. engagement_type deferred until real data reveals natural categories.

**Impact:** Engagement names now computed as "{Partner} - {Topic}". Phase 2 prompt produces structured fields. Matching, display, and naming all benefit. DB migration 039 adds the columns.

---

## 2026-02-24: Dropped next_action, blocker, latest_development Fields

**Decision:** Removed next_action, next_action_owner, blocker, and latest_development from the slot registry design before implementation.

**Context:** Initially proposed as "quick scan" fields. Steven correctly identified these have the same failure mode as open_items — subjective extraction that degrades on complex multi-workstream threads, stale when follow-up emails aren't forwarded, and ambiguous when multiple actions are in flight.

**Rationale:** If a field can't be extracted accurately across diverse thread types at scale, it doesn't belong. The current_state narrative handles these naturally within context. Fewer fields that are accurate beats more fields that are sometimes wrong.

**Impact:** Keeps the engagement model lean — only fields that earn their place.

---

## 2026-02-24: Date Discipline Rules in Phase 2 Prompt

**Decision:** Added 6 explicit temporal rules to Phase 2: (1) point-in-time snapshot anchored to today's date, (2) no relative time words (recently, soon, this week), (3) stated dates from emails are facts, (4) no prediction — describe states not futures, (5) present progressive for ongoing activity, (6) deadlines must be sourced from emails.

**Context:** current_state was using relative time ("recently", "next week") that rotted between classifications. The narrative should read like a briefing written on a specific date, not a living document.

**Rationale:** current_state is a point-in-time snapshot. Grounding it to today's date and forbidding relative time makes it accurate regardless of when it's read. The timeline has rigid dates from data; the narrative should have the same discipline.

**Impact:** current_state quality improves. Today's date injected into Phase 2 context as temporal anchor.

---

## 2026-02-24: Topic/Goal Stability via Prompt Intelligence

**Decision:** Rather than code-level locking (only write if null), show Claude the existing topic and goal values in the engagement context and instruct preservation unless fundamental pivot.

**Context:** topic and goal are meant to be stable across emails, but persistence layer writes whatever Claude returns. Options were: (A) code lock — only write if null, require manual edits; (B) prompt intelligence — Claude sees existing values and preserves them.

**Rationale:** Code locking fights the AI. Prompt intelligence uses it. Same successful pattern as current_state anchoring. Claude can handle "keep this unless it genuinely changed" — that's a judgment call an AI should make.

**Impact:** Persistence layer stays simple (writes freely). Stability comes from the prompt. If topic/goal need updating after a genuine pivot, it happens automatically.
