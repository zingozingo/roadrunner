# Roadrunner AI Call Map
**Updated:** 2026-03-27 (Post Ring 3 data wiring + brain prompt rewrite)
**Purpose:** Complete documentation of all three AI calls — what triggers them, what they read, what they produce, where the output goes. This is the living reference for the two-version pyramid architecture.

---

## The Two-Version Pyramid

Every entity that feeds into AI calls produces two outputs:
- **Full version** — rich, structured, for human consumption on detail pages
- **Condensed version** — compact, scannable, for upstream AI consumption

Context flows strictly upward: Meetings → Engagements → Partner. Never sideways (engagement A doesn't see engagement B's meetings). Never backward (the brain's output never feeds back into itself).

Each level compresses before feeding the level above. At 50 meetings and 15 engagements, the brain still gets a manageable context window.

---

## Overview

| Call | Module | Context Builder | Trigger | Est. Input Tokens | Output max_tokens |
|------|--------|----------------|---------|-------------------|-------------------|
| 1. Engagement Synthesis | classifier.ts + phase2-prompt.ts | buildPhase2Context (phase2-prompt.ts) | User routes inbox item | ~3,075 | 4,096 |
| 2. Meeting Note Summary | notes-summarizer.ts + notes-context.ts | buildMeetingNoteContext (notes-context.ts) | User clicks "Summarize" | ~1,800 | 4,096 |
| 3. Partner Brain | brain-synthesizer.ts + notes-context.ts | buildBrainContext (notes-context.ts) | User clicks "Synthesize" | ~3,000+ (scales with engagement count + Ring 3 data) | 1,000 |

Each call has its own dedicated context builder. No shared context paths.

---

## Call 1: Engagement Synthesis

### Trigger
User routes inbox item via `/api/reviews/resolve` → `synthesizeIntoEngagement()`

### Data Flow
```
classifier.ts::synthesizeIntoEngagement()
  ├── getEngagementHistory(engagementId)     → engagement record + participants (messages/meetings ignored)
  ├── getPartner(partnerId)                  → partner row (condensed to name/segment/what_they_do in prompt)
  ├── buildNameResolutionMap()               → name resolution for sender display
  ├── getContactsByPartner(partnerId)        → partner contacts from registry
  ├── getPartnerScratchpad(partnerId)        → scratchpad entries (source='scratchpad' only)
  └── getCondensedDigestsByEngagement(id)    → condensed meeting digests linked to this engagement
        ↓
  phase2-prompt.ts::buildPhase2Context(opts)
        ↓
  claude.ts::classifyPhase2()
        ↓
  classifier.ts::persistClassificationResult()
```

### What the Prompt Contains
| Section | Est. Tokens | Notes |
|---------|-------------|-------|
| System prompt (PHASE2_SYSTEM_PROMPT) | ~1,500 | Evolve-the-anchor instructions, condensed output spec, importance weighting |
| Previous current_state (anchor) | ~450 | The state being evolved |
| New email | ~300 | The actual trigger input |
| Partner profile (condensed) | ~200 | Name, segment, what_they_do, key contacts |
| Existing participants | ~400 | Participants already linked to engagement |
| Scratchpad entries | ~100 | Tribal knowledge context |
| Condensed meeting digests | ~125 | From meetings linked to this engagement (when available) |
| **TOTAL** | **~3,075** | Scales flat — no linear growth with email count |

### What the AI Produces
```json
{
  "content_type": "engagement_email",
  "engagement_match": { "id", "name", "confidence", "is_new", "partner_name", "partner_id" },
  "topic": "3-8 word description",
  "engagement_name": "{Partner} - {topic}",
  "current_state": "3-7 sentence point-in-time snapshot",
  "condensed": "Structured key facts digest (Topic/Status/Last activity/Key developments/What's next)",
  "participants": [{ "name", "email", "organization", "role" }],
  "pillar": "Co-Sell | Co-Build | Co-Market | null"
}
```

### Where Output Is Stored
- `messages` table: engagement_id, content_type, classification_confidence, classification_result (JSONB), pending_review
- `engagements` table: topic, name, current_state, condensed, pillar
- `participants` + `engagement_participants` (via upsertParticipants)
- Message sender_names backfilled from participant registry

### Where Output Is Displayed
- Engagement detail page: name, topic, pillar in identity bar; current_state as "Activity Summary"
- Engagement list page: name, partner, pillar badge
- Partner detail page: engagement listed with name, pillar, status
- Airtable: engagement synced via push (Notes field = "Roadrunner Activity Summary" + current_state)

### What Was Removed (Phase 4)
- Full message history (was 40% of tokens) — replaced by current_state anchor
- Programs/events/relationships catalogs (was 35%) — manual linking only (Decision #260)
- Entity matching from AI prompt and output (Decision #260)
- Goal field from output and persistence (Decision #263)
- Relationship contacts and meeting contacts bulk-fetches
- 13 positional params → options object (Decision #272)

---

## Call 2: Meeting Note Summarization

### Trigger
User clicks "Summarize" on meeting note → `/api/notes/[id]/summarize` → `summarizeNotes()`

### Data Flow
```
/api/notes/[id]/summarize (route.ts)
  ├── getMeetingNote(id)                          → note + meeting_id
  ├── getMeeting(meeting_id)                      → resolves engagement_id
  ├── buildMeetingNoteContext(partnerId, engagementId)  ← DEDICATED context builder
  │     ├── partner profile (condensed: name, segment, what_they_do)
  │     ├── key contacts from registry
  │     ├── scratchpad entries (filtered to scratchpad + seed_dump)
  │     └── previous meeting condensed digests (SCOPED to same engagement, or last 3 if standalone)
  ├── getTasksByPartner(partnerId)                → existing tasks for non-redundancy
  └── summarizeNotes({ rawNotes, partnerContext, existingTasks })
        ↓
  updateMeetingNote(id, { ai_summary, condensed, ai_tasks, status })
  deleteAiTasksForNote(id)        ← idempotent re-summarization
  createTask() × N                ← materialize as first-class rows
```

### What the Prompt Contains
| Section | Est. Tokens | Notes |
|---------|-------------|-------|
| System prompt | ~1,200 | Structured output spec, condensed digest spec, importance weighting, task non-redundancy |
| Partner profile (condensed) | ~100 | Name, segment, what_they_do only |
| Key contacts | ~100 | Alliance lead, AM, PSA |
| Scratchpad entries | variable | Short tribal knowledge |
| Previous meeting digests (scoped) | ~200 | Same-engagement condensed (up to 5), or last 3 partner meetings if standalone |
| Existing tasks | variable | For non-redundancy |
| Raw notes | variable | User input |
| **TOTAL** | **~1,800+** | Depends on note length |

### What the AI Produces
```json
{
  "summary": "Structured prose: Discussion Points, Decisions Made, Key Context sections",
  "condensed": "3-5 categorized bullets: Discussed, Decided, Context, Next, Blocker",
  "tasks": [{ "description", "owner", "owner_name", "due_date" }]
}
```

### Where Output Is Stored
- `meeting_notes.ai_summary` — structured summary text
- `meeting_notes.condensed` — condensed bullet digest for upstream consumption
- `meeting_notes.ai_tasks` — raw task JSON
- `meeting_notes.status` → "complete"
- `tasks` table — materialized rows with `origin: 'ai_extracted'`, `meeting_note_id` FK

### Where Output Is Displayed
- Meeting detail page → NoteWorkspace: structured summary
- Tasks page: AI-extracted tasks alongside manual tasks
- Partner detail page: task counts

### Where Condensed Goes Upstream
- If meeting is **linked to an engagement** → `getCondensedDigestsByEngagement()` picks it up for Call 1
- If meeting is **standalone** → `getStandaloneCondensedDigests()` picks it up for Call 3

### What Was Changed (Phase 3)
- Context scoped by engagement (Decision #265)
- Structured output with sections + condensed digest (Decision #266)
- Flags array removed (Decision #268)
- context_snapshot set to null (Decision #269)
- Dedicated buildMeetingNoteContext replaces shared buildPartnerContext

---

## Call 3: Partner Brain Synthesis

### Trigger
User clicks "Synthesize" on partner detail → `/api/partners/[id]/synthesize` → `saveAndSynthesize()`

### Data Flow
```
brain-synthesizer.ts::saveAndSynthesize()
  ├── synthesizePartnerBrain(partnerId)
  │     ├── buildBrainContext(partnerId)       ← DEDICATED context builder (11 sections)
  │     │     ├── partner profile (FULL — architecture, stickiness, services, 11 financial fields)
  │     │     ├── key contacts from registry
  │     │     ├── getPartnerScratchpad()       → source='scratchpad' only (no ai_synthesis feedback)
  │     │     ├── active engagements with condensed digests
  │     │     ├── getStandaloneCondensedDigests() → meetings NOT linked to any engagement
  │     │     ├── getTasksByPartner(status: open) → titles + owners
  │     │     ├── activity pattern signals (pillar distribution, meeting frequency, recency)
  │     │     ├── getPartnerProgramEnrollments() → type distribution, status breakdown
  │     │     ├── getPartnerMpoppFunding() → allocated/spent per half
  │     │     ├── getPartnerMdfFunding() → allocated/utilized per record
  │     │     └── getPartnerGoals() → goals with category/status
  │     └── Anthropic API call (max_tokens: 1,000)
  ├── DELETE partner_context WHERE source='ai_synthesis'
  └── INSERT partner_context (source='ai_synthesis')
```

### What the Prompt Contains
| Section | Est. Tokens | Notes |
|---------|-------------|-------|
| System prompt | ~800 | Single-paragraph Strategic Posture, qualitative-only financials, pattern synthesis rules |
| Partner profile (full + financials) | ~600 | Architecture, stickiness, services, 11 financial fields with computed attainment % |
| Key contacts | ~100 | Alliance lead, AM, PSA, top others |
| Scratchpad entries | variable | PRIMARY value — tribal knowledge |
| Condensed engagement digests | ~300+ | All active engagements × ~50 words each. Scales with engagement count. |
| Standalone meeting digests | variable | Partner cadences, unlinked meetings |
| Open tasks | ~100 | Titles + owners only |
| Activity patterns + Ring 3 signals | ~150 | Pillar distribution, meeting frequency, recency, enrollment count, funding totals, goal count |
| Program enrollments | ~200 | Type distribution (Competency/Credit/Strategic/Operational), status breakdown |
| Funding (MPOPP + MDF) | ~200 | Allocated/spent/remaining per wallet |
| Strategic goals | ~100 | Goals with category and status |
| **TOTAL** | **~3,000+** | Scales with engagement/meeting count + Ring 3 data volume |

### What the AI Produces
A single plain paragraph (3-6 sentences) answering: "Is this partner progressing toward co-sell, co-build, and co-market maturity — and what does the evidence say?"

**Prompt rules:**
- No section headers, markdown formatting, or bullet points
- No specific dollar amounts, percentages, or attainment figures — describe financial trajectory qualitatively only
- No "at risk" / "on track" / traffic-light labels
- No "needs attention" urgency judgments
- Third person factual assessment ("The partnership is..." not "You should...")
- Reference people by first name when relevant (from scratchpad)
- Note pillar balance, engagement depth, program enrollment patterns
- Honest about limited data

### Where Output Is Stored
- `partner_context` table: `source='ai_synthesis'`, replaces previous synthesis

### Where Output Is Displayed
- Partner detail page: BrainSynthesis component, labeled "Living Context"

### What Was Changed (Phase 5 → Ring 3 Enrichment)
- Dedicated buildBrainContext replaces shared buildPartnerContext (Decision #275)
- Reads condensed digests from pyramid below, not raw prose
- Scratchpad filtered to source='scratchpad' — no ai_synthesis feedback loop (Decision #275)
- Standalone meeting digests feed directly (Decision D5)
- max_tokens 500 → 2,000 → 1,000 (Decisions #274, rewrite 2026-03-27)
- Activity pattern signals computed and provided
- **2026-03-27:** 4-section executive briefing → single Strategic Posture paragraph
- **2026-03-27:** buildBrainContext enriched with Ring 3 data (financials, enrollments, funding, goals)
- **2026-03-27:** Prompt rule added: no specific dollar amounts (qualitative financial references only)
- **2026-03-27:** All 24 partners batch re-synthesized with new format

---

## No Double-Counting Rule

A meeting linked to an engagement feeds into that **engagement's** synthesis (Call 1). The engagement's condensed digest then feeds up to the **partner brain** (Call 3). The meeting's digest does NOT also feed Call 3 directly — that would count it twice.

Only **standalone meetings** (no engagement_id) feed directly into Call 3. These represent cross-engagement relationship activity — partner cadences, unlinked executive meetings.

---

## Context Builder Summary

| Builder | Location | Used By | What It Fetches |
|---------|----------|---------|-----------------|
| buildPhase2Context | phase2-prompt.ts | Call 1 | Engagement-scoped: current_state anchor, new email, participants, condensed partner profile, scratchpad, linked meeting digests |
| buildMeetingNoteContext | notes-context.ts | Call 2 | Meeting-scoped: condensed partner profile, contacts, scratchpad, same-engagement meeting digests (or last 3 partner meetings if standalone) |
| buildBrainContext | notes-context.ts | Call 3 | Partner-wide: full profile, scratchpad (filtered), condensed engagement digests, standalone meeting digests, tasks, activity patterns |

No shared context paths between calls. Each builder fetches exactly what its call needs.

---

## DB Functions Supporting the Pyramid

| Function | Module | Used By | Purpose |
|----------|--------|---------|---------|
| getCondensedDigestsByEngagement | db/meeting-notes.ts | Call 1 | Meeting note condensed digests for meetings linked to a specific engagement |
| getStandaloneCondensedDigests | db/meeting-notes.ts | Call 3 | Meeting note condensed digests for meetings with NO engagement link |
| getPartnerScratchpad | db/partner-context.ts | Calls 1 + 3 | Scratchpad entries filtered to source='scratchpad' only |
| getContactsByPartner | db/participants.ts | All 3 calls | Partner contacts from canonical registry |
| getTasksByPartner | db/meeting-notes.ts | Calls 2 + 3 | Open tasks for context/non-redundancy |

---

## Token Budget Summary

| Call | Pre-Overhaul | Post-Overhaul | Post-Ring 3 | Change |
|------|-------------|---------------|-------------|--------|
| 1. Engagement Synthesis | ~18,550 | ~3,075 | ~3,075 | -83% (removed history + catalogs) |
| 2. Meeting Note Summary | ~2,000 | ~1,800 | ~1,800 | -10% (scoping helps quality, not size) |
| 3. Partner Brain | ~1,070 | ~2,000+ | ~3,000+ | +180% (Ring 3 data added, output compressed to 1,000 max_tokens) |

---

## Decisions Log (Brain Overhaul)

| # | Decision | Phase |
|---|----------|-------|
| 260 | Entity matching removed from AI — manual linking only | 4 |
| 261 | Full message history removed from engagement synthesis | 4 |
| 262 | Relationships table earmarked for future reinvention | 4 |
| 263 | Goal field eliminated from system | 2 |
| 264 | Two-version pyramid — full + condensed per entity | 2+3 |
| 265 | Meeting note context scoped by engagement | 3 |
| 266 | Meeting summary restructured with sections + condensed | 3 |
| 267 | Pillar persistence bug — fixed in Phase 4 | 4 |
| 268 | flags array removed from NoteSummaryResult | 3 |
| 269 | context_snapshot nulled on summarize route | 3 |
| 270 | Engagement synthesis rewritten — evolve-the-anchor model | 4 |
| 271 | Synthesis-on-link deferred (Option C) | 4 |
| 272 | buildPhase2Context signature modernized — options object | 4 |
| 273 | Dead code removed — 7 orphaned functions | 4 |
| 274 | Partner brain rewritten — structured 4-section briefing | 5 |
| 275 | Brain context decoupled — dedicated buildBrainContext | 5 |
| — | Brain prompt rewritten: 4-section → single Strategic Posture paragraph | Ring 3 |
| — | buildBrainContext enriched with Ring 3 data (financials, enrollments, funding, goals) | Ring 3 |
| — | max_tokens reduced 2,000 → 1,000, qualitative-only financial rule added | Ring 3 |
