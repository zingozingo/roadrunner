# Roadrunner AI Call Map
**Created:** 2026-03-19 (Phase 1 Diagnostic)
**Purpose:** Complete documentation of all AI calls — what triggers them, what they read, what they produce, where the output goes, and what needs to change in the Brain Overhaul.

---

## Overview

Three AI calls, one shared context loader, one shared prompt builder.

| Call | Module | Trigger | Model | Input Tokens (est.) | Output max_tokens |
|------|--------|---------|-------|--------------------|--------------------|
| 1. Engagement Synthesis | classifier.ts + phase2-prompt.ts | User routes inbox item | claude-sonnet-4 | ~18,550 (Nozomi 24-msg) | 4,096 |
| 2. Meeting Note Summary | notes-summarizer.ts + notes-context.ts | User clicks "Summarize" | claude-sonnet-4 | ~2,000 (typical) | 4,096 |
| 3. Partner Brain | brain-synthesizer.ts + notes-context.ts | User clicks "Synthesize" | claude-sonnet-4 | ~1,070 | 500 |

Calls 2 and 3 share `buildPartnerContext()` + `formatContextForPrompt()` from notes-context.ts.

---

## Call 1: Engagement Synthesis

### Trigger
User routes inbox item via `/api/reviews/resolve` → `synthesizeIntoEngagement()`

### Data Flow
```
classifier.ts::synthesizeIntoEngagement()
  ├── getEngagementHistory(engagementId)     → ALL messages + meetings + participants
  ├── getPartner(partnerId)                  → full partner row
  ├── getActiveEvents()                      → ALL events (time-filtered in prompt builder)
  ├── getActivePrograms()                    → ALL 64+ programs (UNFILTERED)
  ├── getRelationships()                     → ALL 7 relationships
  ├── buildNameResolutionMap()               → name resolution for sender display
  ├── getEngagementPrograms(engagementId)    → existing program links
  ├── getEngagementEvents(engagementId)      → existing event links
  ├── getRelationshipsByEngagement()         → existing relationship links
  ├── getContactsByPartner(partnerId)        → partner contacts from registry
  ├── getContactsByRelationship() × N        → contacts for EVERY relationship
  └── getContactsByMeeting() × N            → contacts for every history meeting
        ↓
  phase2-prompt.ts::buildPhase2Context()
        ↓
  claude.ts::classifyPhase2()
        ↓
  classifier.ts::persistClassificationResult()
```

### What the Prompt Contains
| Section | Est. Tokens | % of Total | Notes |
|---------|-------------|------------|-------|
| System prompt (PHASE2_SYSTEM_PROMPT) | ~2,740 | 15% | Static. Entity matching instructions are ~40% of this. |
| Engagement history (all message bodies) | ~7,500 | 40% | Scales linearly with thread length. 24 msgs = 28.6K chars. |
| Programs catalog | ~4,115 | 22% | 72 programs with tiered rendering. Fixed cost every call. |
| Events catalog | ~2,430 | 13% | 41 events in ±30d/+6m window. |
| Existing participants | ~625 | 3% | 41 participants × ~60 chars each. |
| Engagement context (current_state) | ~450 | 2% | The anchor being evolved. |
| New email | ~300 | 2% | The actual input to classify. |
| Everything else | ~390 | 3% | Routing decision, partner profile, entity links, relationships. |
| **TOTAL** | **~18,550** | | |

### What the AI Produces
```json
{
  "content_type": "engagement_email",
  "engagement_match": { "id", "name", "confidence", "is_new", "partner_name", "partner_id" },
  "topic": "3-8 word description",
  "goal": "One sentence success description",           // ← ELIMINATING (D1)
  "engagement_name": "{Partner} - {topic}",
  "current_state": "3-5 sentence point-in-time snapshot", // ← This IS the activity summary
  "participants": [{ "name", "email", "organization", "role" }],
  "matched_events": [{ "id", "name", "relationship", "_reasoning" }],    // ← ELIMINATING (D9)
  "matched_programs": [{ "id", "name", "relationship", "_reasoning" }],  // ← ELIMINATING (D9)
  "matched_relationships": [{ "id", "name", "relationship", "_reasoning" }], // ← ELIMINATING (D9)
  "pillar": "Co-Sell | Co-Build | Co-Market | null"
}
```

### Where Output Is Stored
- `messages` table: engagement_id, content_type, classification_confidence, classification_result (full JSON), pending_review
- `engagements` table: topic, goal, name, current_state, pillar
- `engagement_programs` / `engagement_events` junction tables (via linkEngagementToProgram/Event)
- `engagement_relationships` junction table
- `participants` + `engagement_participants` (via upsertParticipants)
- Message sender_names backfilled from participant registry

### Where Output Is Displayed
- Engagement detail page: name, topic, pillar displayed in identity bar; current_state in main content area (as "Activity Summary"); goal displayed but BEING ELIMINATED
- Partner detail page: engagement listed with name, pillar, status
- Airtable: engagement record synced via push (Notes field = "Roadrunner Activity Summary" + current_state)

### Problems
1. **Full message history (40% of tokens).** "Evolve the anchor" pattern only needs previous current_state + new message.
2. **Programs + Events catalogs (35% of tokens).** Eliminated by D9 — manual linking only.
3. **Relationship contacts bulk-fetched for ALL relationships.** Eliminated by D9.
4. **Goal field actively produced and persisted.** Must remove from prompt, JSON spec, and persistClassificationResult.
5. **System prompt is 40% entity matching instructions.** Can be dramatically shortened after D9.
6. **No condensed output.** Needs `condensed` alongside `current_state`.
7. **6 orphaned engagements** have topic + goal but no current_state. Partial synthesis failures.

### Post-Overhaul Estimate
| Section | Est. Tokens | Notes |
|---------|-------------|-------|
| System prompt (simplified) | ~1,500 | Remove entity matching, goal, self-audit instructions |
| Previous current_state (anchor) | ~450 | Same as today |
| New email | ~300 | Same as today |
| Partner profile (condensed) | ~200 | Name, segment, what_they_do only |
| Existing participants | ~625 | Same (could trim to key contacts) |
| **TOTAL** | **~3,075** | **~83% reduction** |

---

## Call 2: Meeting Note Summarization

### Trigger
User clicks "Summarize" on meeting note → `/api/notes/[id]/summarize` → `summarizeNotes()`

### Data Flow
```
/api/notes/[id]/summarize (route.ts)
  ├── getMeetingNote(id)
  ├── buildPartnerContext(note.partner_id)    ← SHARED with Call 3
  │     ├── partner profile (full row)
  │     ├── ALL active engagements for partner
  │     ├── Last 5 meetings (id, title, date, status)
  │     ├── Last 5 note summaries (FULL ai_summary text)   ← UNSCOPED
  │     ├── All open tasks for partner
  │     ├── All scratchpad entries
  │     ├── Partner contacts from registry
  │     └── [DUPLICATE] Second note summary query (unused first result)
  ├── formatContextForPrompt(context)
  └── summarizeNotes({ rawNotes, partnerContext, ... })
        ↓
  updateMeetingNote(id, { ai_summary, ai_tasks, context_snapshot, status })
  deleteAiTasksForNote(id)        ← idempotent re-summarization
  createTask() × N                ← materialize as first-class rows
```

### What the Prompt Contains
| Section | Est. Tokens | Notes |
|---------|-------------|-------|
| System prompt | ~1,125 | Task extraction rules are well-designed |
| Partner profile | ~200 | Full profile rendered, mostly noise for meeting summary |
| Key contacts | ~100 | Alliance lead, AM, PSA, others |
| Scratchpad entries | variable | Short, useful context |
| ALL active engagements | ~200 | **UNSCOPED — includes unrelated engagements** |
| Recent meetings (last 5) | ~100 | **UNSCOPED — includes unrelated meetings** |
| Previous note summaries (last 5, full text) | ~500 | **UNSCOPED — full prose, not condensed** |
| Open tasks | variable | All partner tasks |
| Meeting info (title + date) | ~25 | Metadata |
| Raw notes | variable | User input, capped at 8,000 words |
| **TOTAL** | **~2,000+** | Lightweight but unscoped |

### What the AI Produces
```json
{
  "summary": "prose paragraphs — no markdown headers",
  "tasks": [{ "description", "owner", "owner_name", "due_date" }],
  "flags": []    // ← DEAD — always empty, never used
}
```

### Where Output Is Stored
- `meeting_notes.ai_summary` — the summary text
- `meeting_notes.ai_tasks` — raw task JSON from AI
- `meeting_notes.context_snapshot` — full context at time of summarization
- `meeting_notes.status` → "complete"
- `tasks` table — materialized rows with `origin: 'ai_extracted'`, `meeting_note_id` FK

### Where Output Is Displayed
- Meeting detail page → NoteWorkspace: summary displayed as prose
- Tasks page: AI-extracted tasks appear alongside manual tasks
- Partner detail page: task counts shown

### Problems
1. **Context completely unscoped.** ALL active engagements fed in, not just the one this meeting is linked to. SCA review meeting gets co-marketing engagement context.
2. **Previous note summaries unscoped AND full text.** Last 5 for partner, regardless of engagement. Should be same-engagement only, and condensed.
3. **Duplicate note summary fetch.** `getRecentNoteSummaries()` called at line 30 but result unused — second query at lines 56-63 does the same thing.
4. **No condensed output.** Summary is prose only. Needs condensed digest (3-5 bullets) for upstream.
5. **`flags` array is dead code.** Always empty, not in prompt, never used.
6. **Full partner profile sent.** AWS stickiness, architecture, pricing model all sent. Mostly noise for meeting notes.
7. **`formatContextForDisplay` still builds `activeEngagements` array.** UI rendering removed but data still fetched.

### Post-Overhaul Changes
- Scope context to same-engagement meetings only (or last 3-5 partner meetings if standalone)
- Use condensed digests of previous meetings instead of full summaries
- Produce structured summary + condensed digest in same call
- Condense partner profile to name + segment + what_they_do
- Remove flags from output spec
- Fix duplicate note summary fetch

---

## Call 3: Partner Brain Synthesis

### Trigger
User clicks "Synthesize" on partner detail → `/api/partners/[id]/synthesize` → `saveAndSynthesize()`

### Data Flow
```
brain-synthesizer.ts::saveAndSynthesize()
  ├── synthesizePartnerBrain(partnerId)
  │     ├── buildPartnerContext(partnerId)    ← SAME loader as Call 2
  │     ├── formatContextForPrompt(context)
  │     └── Anthropic API call (max_tokens: 500)
  ├── DELETE partner_context WHERE source='ai_synthesis'
  └── INSERT partner_context (source='ai_synthesis')
```

### What the Prompt Contains
Same `formatContextForPrompt` output as Call 2 (~750 tokens partner context), plus system prompt (~306 tokens). Total ~1,070 tokens.

### What the AI Produces
- 2-4 sentence third-person briefing stored as single text string

### Where Output Is Stored
- `partner_context` table: `source='ai_synthesis'`, replaces previous synthesis

### Where Output Is Displayed
- Partner detail page: position #2 in left column, labeled "Living Context"

### Problems
1. **Doesn't see engagement current_state.** Sees names, pillars, topics — but NOT the activity summaries. Major gap.
2. **Only 5 note summaries, full text.** Should read ALL condensed meeting digests.
3. **2-4 sentences + max_tokens 500 is too tight.** For 8+ engagements, can't cover relationship dynamics, risks, patterns, and priorities in 2-4 sentences.
4. **No structured output.** Single prose blob. Should have sections (relationship overview, activity patterns, attention flags).
5. **3/22 partners have synthesis.** Low adoption — manual trigger only.
6. **Shares `buildPartnerContext()` with Call 2** but needs fundamentally different data (cross-engagement view with condensed digests, not unscoped raw summaries).

### Post-Overhaul Changes
- Read condensed engagement digests (all active)
- Read condensed meeting digests (standalone meetings only — linked ones come through engagement digests)
- Read scratchpad at full weight (tribal knowledge is primary value)
- Structured output with sections
- Higher max_tokens budget
- Separate context builder from Call 2

---

## Shared Infrastructure

### buildPartnerContext() (notes-context.ts)
Used by Call 2 AND Call 3. Post-overhaul, these calls need different context:
- **Call 2** needs engagement-scoped context (same-engagement meetings, condensed digests)
- **Call 3** needs cross-engagement condensed digests + standalone meeting digests

Decision: These should diverge into separate context builders, or `buildPartnerContext()` should accept scoping parameters.

### prompt-builder.ts
Post-D9 (manual entity linking), these functions become dead code for AI calls:
- `buildEventsSection()` — was used in Call 1 prompt
- `buildProgramsSection()` — was used in Call 1 prompt
- `buildRelationshipsSection()` — was used in Call 1 prompt

Still needed:
- `buildForwarderSection()` — used in Call 1 prompt
- `buildEmailSection()` — used in Call 1 prompt (though may not be called directly today)

### Anthropic Client
Two separate singleton instances exist:
- `notes-summarizer.ts` has its own client
- `brain-synthesizer.ts` has its own client
- `claude.ts` (used by Call 1) has its own client

Three identical singletons doing the same thing. Could consolidate but low priority.

---

## Decisions Confirmed This Session

| # | Decision | Impact |
|---|----------|--------|
| D1 | Eliminate goal field from AI output | Remove from Call 1 prompt, JSON spec, persistClassificationResult, engagement display |
| D2 | Partner synthesis = executive briefing, not data rehash | Rewrite Call 3 prompt and output format |
| D3 | Meeting summaries don't duplicate tasks | Add non-redundancy instruction to Call 2 prompt |
| D4 | Importance = frequency + recency + author emphasis | Weighting rules in all prompt rewrites |
| D5 | Standalone meetings are first-class, full weight | Feed directly into Call 3, not through engagement layer |
| D6 | Engagement linking stays optional for all meeting types | No enforcement logic needed |
| D7 | Scratchpad should be prominent in partner synthesis | Priority input in Call 3 rewrite |
| D8 | Recurring meeting engagement inheritance flows forward only | Confirmed behavior, documented |
| D9 | All entity matching removed from AI — manual linking only | Eliminates catalogs from Call 1, removes matched_events/programs/relationships from output |
| D10 | Full message history removed from engagement synthesis | Previous current_state + new message only. ~93% token reduction on biggest section. |
| D11 | Relationships table earmarked for future reinvention | Participants are the atomic unit. No deeper investment in relationships table. |

---

## Token Budget Summary

| Call | Current | Post-Overhaul | Reduction |
|------|---------|---------------|-----------|
| 1. Engagement Synthesis | ~18,550 | ~3,075 | ~83% |
| 2. Meeting Note Summary | ~2,000 | ~1,800 | ~10% (scoping helps quality, not size) |
| 3. Partner Brain | ~1,070 | ~2,000 | +87% (more input for better output) |

Call 1 gets dramatically cheaper. Call 3 gets bigger because it reads condensed digests from all engagements and standalone meetings — but this is intentional. Better input = better synthesis.