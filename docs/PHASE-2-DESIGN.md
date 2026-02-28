# Two-Phase Classification Architecture — Design Document

> **STATUS: Implemented as of 2026-02-22.** Phase A (build alongside) and Phase C (swap classifier) complete. Phase B (debug testing) validated on Spacelift and NinjaOne engagements. Phase D (cleanup of deprecated code) pending.

## Overview

The current system uses a single Claude call that does everything: match the email to an engagement, produce current_state, extract open_items, identify participants, match events/programs/relationships, and suggest tags. This works, but it has two structural problems:

1. **Wasted tokens on routing.** Every classification sends the full engagement catalog (with current_state, open_items, etc.) even though 90% of that context is irrelevant — the email matches one engagement, not forty.

2. **No thread history.** Claude sees the current_state summary and the new email, but never sees the actual source emails that built that summary. It can't verify what it wrote before, can't detect contradictions, and can't evolve state intelligently across a 20-email thread.

The fix: split classification into two phases.

**Phase 1 (Match)** — Lightweight routing. "Which engagement does this email belong to?" Uses a compact index of engagement names, partners, and tags. Fast, cheap, high-accuracy.

**Phase 2 (Analyze)** — Deep analysis with full context. Receives the complete email history for the matched engagement plus the new email. Produces current_state, open_items, participants, entity matches, and tags with full thread awareness.

---

## Phase 1: Match

### Purpose

Determine which engagement an email belongs to (or if it's new/noise). Nothing else. No state updates, no participant extraction, no entity matching. Pure routing.

### System Prompt

> **Note (2026-02-27):** The prompt below is the original design version. The live prompt in `src/lib/phase1-prompt.ts` has been rewritten to support multi-engagement partners: "Prefer existing engagements" replaced with "Match by partner AND topic," topic added to engagement index, confidence recalibrated for same-partner-different-topic scenarios. See SESSION_LOG.md entry "Phase 1 Prompt Rewrite" for details.

```
You are Relay Match, a routing classifier for an AWS Partner Development Manager's email inbox.

Your ONLY job: determine which existing engagement this forwarded email belongs to, or whether it's noise or a new initiative.

## Definitions

**Engagement** — A tracked work initiative. One partner + one goal. Example: "Acme Security - FedRAMP Certification".

**Noise** — Auto-replies, out-of-office, newsletters, marketing blasts, internal distribution list digests, calendar notifications with no actionable content.

## Instructions

1. Read the email content carefully.
2. Compare against the engagement index provided. Match by partner name, topic alignment, and email domain.
3. Use the partner catalog to identify which partner the sender belongs to (match by email domain).
4. Return your classification.

## Matching Rules

- **Prefer existing engagements.** If the partner and topic align with an existing engagement, match it. Don't create new engagements when an existing one fits.
- **Domain matching.** Use the partner catalog's domain list to identify which partner the sender works for. If a sender's domain matches a partner, that strongly indicates which engagement(s) to consider.
- **New engagement.** Only set is_new: true when the email clearly represents a new initiative that doesn't fit any existing engagement. The email must have substantive content — a vague intro or forward without context is not enough for a new engagement.
- **Noise detection.** Auto-replies, OOO, newsletters, marketing blasts, calendar notifications = noise. Return content_type "noise" with confidence 1.0.
- **Meeting invites.** ICS attachments and calendar invitations are content_type "meeting_invite". Still match them to an engagement by topic/partner.
- **Mixed content.** Emails discussing multiple engagements: content_type "mixed", match to the primary one.

## Confidence Calibration

- 0.95–1.0: Email explicitly names the engagement or is a direct thread continuation (same subject line, same participants)
- 0.85–0.94: Same partner + same topic area, clear contextual match
- 0.70–0.84: Related partner or topic, but ambiguous which engagement
- Below 0.70: Tangential, vague, or could match multiple engagements
- Noise: always 1.0

## Response Format

Return ONLY valid JSON. No markdown, no preamble.

{
  "content_type": "engagement_email" | "meeting_invite" | "mixed" | "noise",
  "engagement_match": {
    "id": "uuid of existing engagement, or null if new/noise",
    "name": "existing engagement name, or suggested name if new",
    "confidence": 0.0-1.0,
    "is_new": true/false,
    "partner_name": "company name or null",
    "partner_id": "uuid from partner catalog or null"
  }
}

If noise: content_type "noise", engagement_match with null id, confidence 1.0, is_new false.
If new: engagement_match with null id, is_new true, suggested name in "Partner - Initiative" format.
```

### Context Builder (what Phase 1 sees)

```
## Forwarder
Steven Romero | sterme@amazon.com | PDM, AWS Security ISV Partners

## Engagement Index
- "Acme Security - FedRAMP Cert" (id: abc123) — Partner: Acme Security | Tags: fedramp, compliance | Messages: 12 | Last: 2026-02-18
- "NinjaOne - NFL Partnership" (id: def456) — Partner: NinjaOne | Tags: co-sell, sports | Messages: 5 | Last: 2026-02-20
[... one line per engagement]

## Partner Catalog
- Acme Security (id: p1) — Domains: acme.com, acmesec.io
- NinjaOne (id: p2) — Domains: ninjaone.com, ninjarmm.com
[... one line per partner]

---

## Email to Classify

**From:** Jane Smith <jane@acme.com>
**To:** Steven Romero <sterme@amazon.com>
**Subject:** Re: FedRAMP timeline update
**Date:** 2026-02-22

[email body]
```

**What's NOT here (compared to current system):**
- No current_state for any engagement (saves ~100-500 chars each)
- No open_items for any engagement
- No events, programs, or relationships catalog
- No engagement descriptions or pillar info

### Token Budget Estimate

| Component | Chars | ~Tokens |
|-----------|-------|---------|
| System prompt | 2,200 | 550 |
| Forwarder section | 80 | 20 |
| Engagement index (40 engagements) | 4,000 | 1,000 |
| Partner catalog (20 partners) | 1,200 | 300 |
| Email body (typical) | 2,000 | 500 |
| **Total input** | **~9,500** | **~2,400** |
| Response | 200 | 50 |

Compare to current single-phase: engagement section alone sends ~20K chars with current_state and open_items for 40 engagements, plus full event/program/relationship catalogs (~8K chars). Phase 1 cuts input by 60-70%.

**Model:** `claude-haiku-4-5-20251001` — this is pure pattern matching, doesn't need Sonnet-level reasoning. Faster and 10x cheaper.

---

## Phase 2: Analyze

### Purpose

Deep analysis of the new email in the context of the engagement's full history. Produces the rich classification output: current_state, open_items, participants, entity matches, tags, and pillar inference.

Phase 2 only runs when we know which engagement the email belongs to (from Phase 1 or manual assignment).

### System Prompt

```
You are Relay Analyst, an AI that analyzes emails for an AWS Partner Development Manager (PDM). You are given the FULL history of an engagement and a NEW email to incorporate.

## Your Job

Analyze the NEW email (clearly marked below) in the context of the engagement's history. Produce:
1. An updated current_state summary
2. New open items (if any)
3. Identification of resolved open items (if any)
4. A participant list extracted from the NEW email
5. Matched events, programs, and AWS relationships
6. Suggested tags
7. A pillar classification

## Thread Awareness

The source emails below are the COMPLETE conversation history for this engagement. The NEW email is clearly marked with ">>> NEW EMAIL — CLASSIFY THIS <<<". Rules:

- Extract information ONLY from the NEW email for open_items, participants, and entity matches
- Use the history emails for CONTEXT ONLY — to understand what has already been discussed, who the key players are, and what the engagement's trajectory looks like
- Do NOT re-extract participants or open items from history emails — those have already been processed

## current_state Instructions

You are given the engagement's existing current_state as an anchor. Your job is to EVOLVE it.

**For existing engagements:**
- Read the existing current_state carefully — it represents the accumulated knowledge so far
- If the NEW email contains material information (decisions, scope changes, new stakeholders, status updates, blockers), update the relevant parts while preserving the rest
- If the NEW email is routine (scheduling ack, brief reply, "thanks"), make minimal or no changes to current_state
- Never drop important context just because a new email arrived
- Keep it 3-5 sentences, executive briefing style

**Temporal awareness:**
- Compare the NEW email's date against the engagement's last_activity date
- If the NEW email is OLDER than the existing state (late-arriving forward), be conservative — incorporate only facts not already captured, don't overwrite newer information with older
- If the NEW email is newer, update state normally

**Style rules:**
- Write concretely: names, specifics, outcomes. "Brian sent the architecture diagram to the security team on Feb 15" not "stakeholders are facilitating comprehensive collaboration"
- Use first names only — full details are in the participants field
- No fabricated dates or timelines
- No bullet points or markdown formatting
- No vague filler ("various stakeholders", "ongoing discussions", "comprehensive approach")

Return null if this is noise (shouldn't normally happen in Phase 2, but handle gracefully).

## open_items Instructions

Extract ONLY concrete, actionable commitments from the NEW email. These should be items worth mentioning in a status update to leadership — blockers and commitments, not granular tasks.

**What qualifies:**
- Explicit commitments: "I'll send the architecture doc by Friday"
- Clear blockers: "We're blocked on security review approval"
- Deadlines: "POC must be complete before re:Invent"
- Requests with specific asks: "Can you connect us with the CloudFormation team?"

**What does NOT qualify:**
- Vague intentions: "Let's circle back on this"
- Pleasantries: "Looking forward to working together"
- Granular tasks: "I'll update the spreadsheet" (unless it's a key deliverable)
- Things already captured in existing open_items

**Assignee:** Use first name. If a team, use "Acme team" or "AWS team". If unknown, null.

**Due date:** ONLY if explicitly stated ("by Friday", "due March 15", "before re:Invent"). Convert relative dates using the email's date. Never fabricate from "soon" or "ASAP".

**Existing open items:** You can see them in the engagement context with their resolved/unresolved status. Do NOT re-extract existing items. Only return genuinely NEW items from the NEW email.

## resolved_open_items Instructions

If the NEW email indicates that an existing open item has been completed (e.g., "I sent the document", "the meeting is scheduled", "security review passed"), include that item's description in resolved_open_items.

Match by meaning, not exact wording. "Jordan sent the GTM doc" resolves "Send GTM campaign strategy document". When in doubt, do NOT resolve — let the user handle it.

## Participants

Extract all people mentioned in the NEW email (From, To, CC headers and body). Each person appears ONCE — merge header info with body/signature info.

**Roles (use this vocabulary):**
- "forwarder" — the PDM (always include, always this role)
- "partner_contact" — someone from the partner company
- "aws_stakeholder" — an AWS employee (not the PDM)
- "executive" — a VP/C-level/Director explicitly involved (from either side)
- "technical_contact" — an engineer, architect, or technical lead
- "third_party" — someone from neither AWS nor the partner

Set email to null only if truly unavailable. The forwarder is identified in the context — always include them once with role "forwarder", do not duplicate if they appear in headers.

## Entity Matching

**Events:** Match ONLY to events in the provided list, by ID. Never invent events. Meetings, calls, demos, and partner-specific gatherings are NOT events — they are engagement workflow (mention in current_state only). Relationships: relevant_to, preparation_for, deadline, presenting_at, sponsoring.

**Programs:** Match ONLY to programs in the provided list, by ID. Never invent programs. Relationships: implements, qualifies_for, enrolled_in, graduating, blocked_by.

**AWS Relationships:** Match when people from a known AWS relationship appear in the NEW email. Match by email address or name against the provided list. Relationships: involved_in, consulted, introduced, escalated_to.

If nothing matches for any category, return an empty array. Empty arrays are always better than fabricated matches.

## Pillar Inference

Classify the engagement's primary pillar based on ALL available context (history + new email):

- **Co-Sell** — Revenue-focused: deals, pipeline, marketplace listings, customer introductions, GTM motions, account mapping
- **Co-Build** — Technical: integrations, certifications, competencies, technical validations, POCs, architecture reviews
- **Co-Market** — Awareness: events, content, webinars, campaigns, case studies, press releases, speaking slots

Return null if unclear. It's fine to not classify early-stage engagements.

## Tags

Suggest short, lowercase labels. Examples: "co-sell", "fedramp", "poc", "migration", "marketplace", "security-review", "nfl", "finserv". Only suggest tags genuinely descriptive of this engagement. Empty array is fine.

## Engagement Naming (new engagements only)

If this is a new engagement, suggest a name in the format: "Partner Name - Descriptive Initiative"
Examples: "Acme Security - FedRAMP Certification", "NinjaOne - NFL Sports League Partnership"
Keep it concise but specific enough to distinguish from other engagements with the same partner.

## Response Format

Return ONLY valid JSON. No markdown code blocks, no preamble.

{
  "current_state": "3-5 sentence executive briefing or null if noise",
  "open_items": [
    {
      "description": "specific actionable commitment or blocker",
      "assignee": "first name or null",
      "due_date": "ISO date or null"
    }
  ],
  "resolved_open_items": ["description of resolved item"],
  "participants": [
    {
      "name": "full name",
      "email": "email or null",
      "organization": "company or null",
      "role": "forwarder | partner_contact | aws_stakeholder | executive | technical_contact | third_party"
    }
  ],
  "matched_events": [
    { "id": "uuid", "name": "event name", "relationship": "relevant_to | preparation_for | deadline | presenting_at | sponsoring" }
  ],
  "matched_programs": [
    { "id": "uuid", "name": "program name", "relationship": "implements | qualifies_for | enrolled_in | graduating | blocked_by" }
  ],
  "matched_relationships": [
    { "id": "uuid", "name": "relationship name", "relationship": "involved_in | consulted | introduced | escalated_to" }
  ],
  "suggested_tags": ["lowercase-tag"],
  "pillar": "Co-Sell" | "Co-Build" | "Co-Market" | null
}
```

### Context Builder (what Phase 2 sees)

```
## Forwarder Identity

This email was forwarded to Relay by the PDM:
**Name:** Steven Romero
**Email:** sterme@amazon.com
**Role:** Partner Development Manager (PDM)
**Segment:** AWS Security, ISV Partners

The forwarder is ALWAYS a participant with role "forwarder".

## Engagement Context

**Name:** NinjaOne - NFL Sports League Partnership
**ID:** 8a9281ef-...
**Partner:** NinjaOne (id: p2)
**Status:** active
**Created:** 2026-02-10
**Last activity:** 2026-02-20
**Message count:** 5

**Current state (anchor — evolve this):**
NinjaOne wants to replicate their MLB league-wide deal with NFL. March 2nd meeting scheduled with Julie D'Ambrosio's NFL account team. Steven connected Garen Ingleby from NinjaOne's channel team with the AWS Sports vertical.

**Open items:**
- Schedule meeting with AWS Sports & Events team (Steven) [RESOLVED]

**Tags:** co-sell, sports, nfl

## Engagement History (5 messages, oldest first)

### Message 1 of 5 — HISTORY
**From:** Steven Romero <sterme@amazon.com>
**To:** Garen Ingleby <garen@ninjaone.com>
**Date:** 2026-02-10
**Subject:** NinjaOne NFL

[body text]

### Message 2 of 5 — HISTORY
**From:** Garen Ingleby <garen@ninjaone.com>
**To:** Steven Romero <sterme@amazon.com>
**Date:** 2026-02-17
**Subject:** Re: NinjaOne NFL

[body text]

[... more history messages ...]

### Message 5 of 5 — >>> NEW EMAIL — CLASSIFY THIS <<<
**From:** Julie D'Ambrosio <julie@amazon.com>
**To:** Steven Romero <sterme@amazon.com>, Garen Ingleby <garen@ninjaone.com>
**Date:** 2026-02-22
**Subject:** Re: NinjaOne NFL - Prep for March 2 Call

[body text]

## Linked Meetings
- "NinjaOne & NFL@AWS: Introductory Call" — 2026-03-02, 2:30-3:00 PM, 12 attendees, Confirmed

## Reference Data

### Tracked Events
- **re:Invent 2026** (id: evt1, type: conference, 2026-11-30 to 2026-12-04) — Annual AWS conference
- **re:Inforce 2026** (id: evt2, type: conference, 2026-06-16 to 2026-06-18) — AWS security conference
[... full event list]

### Active Programs
- **ISV Accelerate** (id: prg1, type: Program) — GTM co-sell motion for ISVs
- **Security Competency** (id: prg2, type: Competency) — AWS Security Partner validation
[... full program list]

### AWS Relationships
- **NFL Account Team** (id: rel1) — Type: account_team | Org: AWS Sports | Contact: Julie D'Ambrosio | Emails: julie@amazon.com
[... full relationship list]
```

**Key differences from Phase 1 context:**
- Full email history for the matched engagement (body text included)
- Existing current_state as an "anchor" to evolve
- Existing open_items with resolved status
- Full event/program/relationship catalogs (needed for entity matching)
- Linked meetings
- Clear visual separation between HISTORY and NEW EMAIL

### Token Budget Estimate

| Component | Chars | ~Tokens |
|-----------|-------|---------|
| System prompt | 5,600 | 1,400 |
| Forwarder + engagement context | 1,200 | 300 |
| Email history (5 msgs, ~6K chars) | 6,000 | 1,500 |
| New email | 2,000 | 500 |
| Linked meetings | 400 | 100 |
| Events catalog (43 events) | 4,300 | 1,075 |
| Programs catalog (62 programs) | 4,960 | 1,240 |
| Relationships catalog (7 rels) | 700 | 175 |
| **Total input** | **~25,160** | **~6,290** |
| Response | 1,200 | 300 |

For a mature engagement with 50 messages (~50K body chars):

| Component | Chars | ~Tokens |
|-----------|-------|---------|
| System prompt + context | 7,000 | 1,750 |
| Email history (50 msgs) | 50,000 | 12,500 |
| Catalogs | 10,000 | 2,500 |
| **Total input** | **~67,000** | **~16,750** |

Well within the 200K token context window. Even at 100 messages (~100K body chars, ~25K tokens), total input would be ~30K tokens — still comfortable.

**Model:** `claude-sonnet-4-20250514` (same as current). This phase requires genuine reasoning — state evolution, temporal awareness, entity matching.

---

## Orchestration Flow

### Webhook path (processSingleMessage)

```
Email arrives via Mailgun webhook
  → Parse email (email-parser.ts) — unchanged
  → Parse ICS if present (ics-parser.ts) — unchanged
  → Store messages in DB — unchanged
  → Store meeting if ICS — unchanged
  ┌─────────────────────────────────────┐
  │ PHASE 1: Match                      │
  │ Input: compact index + new email    │
  │ Model: Haiku                        │
  │ Output: engagement_match            │
  └──────────────┬──────────────────────┘
                 │
      ┌──────────┼──────────────┐
      ▼          ▼              ▼
    NOISE    LOW CONF        HIGH CONF
   (done)   (< 0.85)        (≥ 0.85)
              │                 │
              ▼                 │
    Store Phase 1 result        │
    Create approval_queue       │
    Show in Inbox               │
              │                 │
              │ (user resolves) │
              ▼                 ▼
  ┌─────────────────────────────────────┐
  │ PHASE 2: Analyze                    │
  │ Input: full history + new email     │
  │        + catalogs                   │
  │ Model: Sonnet                       │
  │ Output: full ClassificationResult   │
  └──────────────┬──────────────────────┘
                 │
                 ▼
    Persist results (unchanged logic):
    - Update engagement state
    - Create entity links
    - Upsert participants
    - Append/resolve open items
    - Link meetings
    - Push to Airtable
```

### Key routing decisions

| Phase 1 result | Action |
|----------------|--------|
| Noise, confidence 1.0 | Mark messages as noise. Skip Phase 2. Done. |
| Existing engagement, confidence ≥ 0.85 | Fetch history → Phase 2 → persist → Airtable sync |
| New engagement, confidence ≥ 0.85 | Phase 2 (no history) → create engagement → persist → Airtable sync |
| Any non-noise, confidence < 0.85 | Store Phase 1 result on messages → create approval_queue item |
| User resolves approval (assigns engagement) | Fetch history for assigned engagement → Phase 2 → persist |
| User resolves approval (creates new) | Phase 2 (no history) → create engagement → persist |

### What changes in the approval/inbox flow

Currently, the Inbox UI stores the full `ClassificationResult` from the single-phase call. With two phases:

- **Phase 1 result** gets stored on the message (`classification_result` column) when flagged for review. This is a smaller payload — just the match info.
- **Phase 2 runs AFTER** the user resolves the approval. The user picks the correct engagement (or creates new), then Phase 2 runs with that engagement's full context.
- The `persistClassificationResult()` function stays the same — it already handles both new and existing engagements.

This is actually better than the current flow: today, the single-phase result includes a current_state and open_items written without knowing the correct engagement. With two phases, Phase 2 writes state with the correct engagement context.

### Batch path (processUnclassifiedMessages)

Same flow, just iterates over message groups. No structural change.

---

## Changes Required

### New files

| File | Purpose |
|------|---------|
| `src/lib/phase1-prompt.ts` | Phase 1 system prompt constant + `buildPhase1Context()` function |
| `src/lib/phase2-prompt.ts` | Phase 2 system prompt constant + `buildPhase2Context()` function |

### Modified files

| File | Changes |
|------|---------|
| `src/lib/claude.ts` | Add `classifyPhase1(messages, phase1Context)` and `classifyPhase2(messages, phase2Context)`. Phase 1 uses Haiku, Phase 2 uses Sonnet. Deprecate `classifyMessage()` (keep for rollback). |
| `src/lib/classifier.ts` | Rewrite `applyClassificationResult()` to orchestrate Phase 1 → routing → Phase 2 → persist. `persistClassificationResult()` stays unchanged. |
| `src/lib/prompt-builder.ts` | Add compact builders for Phase 1 (`buildEngagementIndex`, `buildCompactPartnerCatalog`). Existing builders (`buildEventsSection`, `buildProgramsSection`, `buildRelationshipsSection`, `buildEmailSection`) reused in Phase 2 as-is. Add `buildEngagementHistorySection()` for Phase 2. |
| `src/lib/supabase.ts` | Add `getEngagementHistory(engagementId)` — fetches engagement record + all messages (ordered by sent_at ASC) + linked meetings in one call. |
| `src/lib/types.ts` | Add `Phase1Result` type (lightweight match). Add `pillar` field to `ClassificationResult` (becomes Phase 2 output). |
| `src/app/api/inbox/resolve/route.ts` | After user assigns engagement, call Phase 2 before persisting (instead of using the stale single-phase result). |

### Unchanged files

| File | Why |
|------|-----|
| `src/lib/email-parser.ts` | Parsing happens before classification — no change |
| `src/lib/ics-parser.ts` | ICS parsing happens before classification — no change |
| `src/lib/user-config.ts` | Identity config — no change |
| `src/lib/sync.ts` | Airtable push — no change (called from persist, which is unchanged) |
| All UI pages/components | They consume engagement/message data from DB — schema doesn't change |

---

## New Types

```typescript
// Phase 1 output — lightweight match result
interface Phase1Result {
  content_type: "engagement_email" | "meeting_invite" | "mixed" | "noise";
  engagement_match: {
    id: string | null;
    name: string;
    confidence: number;
    is_new: boolean;
    partner_name: string | null;
    partner_id: string | null;
  };
}

// Phase 2 output — extends current ClassificationResult with pillar
// (current ClassificationResult minus content_type and engagement_match,
//  which come from Phase 1)
interface Phase2Result {
  current_state: string | null;
  open_items: {
    description: string;
    assignee: string | null;
    due_date: string | null;
  }[];
  resolved_open_items: string[];
  participants: {
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  }[];
  matched_events: { id: string; name: string; relationship: string }[];
  matched_programs: { id: string; name: string; relationship: string }[];
  matched_relationships: { id: string; name: string; relationship: string }[];
  suggested_tags: string[];
  pillar: "Co-Sell" | "Co-Build" | "Co-Market" | null;
}

// Combined result used by persistClassificationResult() — backwards compatible
// Merges Phase1Result + Phase2Result into the shape the persistence layer expects
type CombinedClassificationResult = Phase1Result & Phase2Result;
```

The persistence layer (`persistClassificationResult`) continues to receive the combined shape. The only addition is the `pillar` field, which gets written to the engagement record.

---

## Migration Strategy

### Phase A: Build alongside existing system
1. Create `phase1-prompt.ts` and `phase2-prompt.ts` with prompts and context builders
2. Add `classifyPhase1()` and `classifyPhase2()` to `claude.ts`
3. Add `getEngagementHistory()` to `supabase.ts`
4. Add new types to `types.ts`
5. Write tests for Phase 1 and Phase 2 prompt builders
6. **Do NOT modify `classifier.ts` yet** — existing flow still works

### Phase B: Test with real emails
1. Add a `/api/debug/classify-two-phase` endpoint that runs both phases on a message and returns the result without persisting
2. Forward a few real emails and compare single-phase vs two-phase output
3. Verify: Does Phase 1 route correctly? Does Phase 2 produce better current_state with history context?

### Phase C: Swap classifier
1. Update `classifier.ts` to use two-phase flow
2. Update inbox resolve route to run Phase 2 after user assignment
3. Keep old `classifyMessage()` in `claude.ts` but mark as deprecated
4. Deploy and monitor

### Phase D: Cleanup
1. Remove deprecated `classifyMessage()` and old `SYSTEM_PROMPT`
2. Remove any unused prompt-builder functions
3. Update test suites

---

## Open Questions

### 1. Should Phase 2 for new engagements receive the partner catalog?

**Recommendation: Yes, but just the matched partner's entry.**

Phase 1 already identified the partner. Phase 2 for new engagements needs the partner's details (segment, alliance lead) to write a good initial current_state and suggest an engagement name, but doesn't need the full catalog.

### 2. Should Phase 2 re-run when the user manually assigns an engagement from Inbox?

**Recommendation: Yes, this is critical.**

Today, when a user resolves an approval by assigning to a different engagement, the system uses the original classification's current_state — which was written without knowing the correct engagement. With two phases, the Inbox resolve flow should:
1. Take the user's engagement choice
2. Fetch that engagement's history
3. Run Phase 2 with the correct context
4. Persist the Phase 2 result

This produces a current_state that actually incorporates the engagement's history. Much better than today.

### 3. At what message count should we start truncating history?

**Recommendation: Don't truncate yet. Revisit at 100+ messages.**

Token math: 100 messages at ~1K chars each = ~100K chars = ~25K tokens. With prompt and catalogs, total is ~30K tokens. Still well under the 200K limit and the ~$0.10/call cost at Sonnet pricing is acceptable for a single-user app.

When we eventually need truncation, the approach should be:
- Keep the 10 most recent messages in full
- Summarize older messages into a "thread summary" paragraph
- The summary could be generated by a separate Claude call (or cached from previous Phase 2 runs)

But this is a future optimization — not needed for the first implementation.

### 4. Should Phase 1 use Haiku or Sonnet?

**Recommendation: Start with Haiku, promote to Sonnet if accuracy suffers.**

Phase 1 is pattern matching — compare email domains and topics against an index. Haiku should handle this well. If we see routing errors in testing (Phase B), we can switch to Sonnet with minimal code change (just the model parameter).

Cost difference: Haiku at ~2.4K input tokens ≈ $0.002/call vs Sonnet ≈ $0.007/call. Not a huge savings in absolute terms for a single-user app, but Haiku is also faster (~500ms vs ~2s), which improves webhook response time.

### 5. How should we handle the `classification_result` column on messages?

Currently this stores the full `ClassificationResult`. With two phases:

**Option A:** Store the combined result (Phase1 + Phase2 merged) — backwards compatible, no schema change.

**Option B:** Store Phase 1 result initially, overwrite with combined result after Phase 2.

**Recommendation: Option A.** Merge Phase 1 and Phase 2 results into a single `CombinedClassificationResult` before storing. The UI and other consumers never need to distinguish which phase produced what. For approval_queue items (where Phase 2 hasn't run yet), store just the Phase 1 result — it has the same `engagement_match` shape, just with empty arrays for the Phase 2 fields.
