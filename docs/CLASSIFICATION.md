# Classification Pipeline

> Last updated: 2026-03-01

## Overview

Roadrunner uses a **two-phase classification pipeline** to process forwarded emails:

- **Phase 1 (Routing)** — Lightweight engagement matching. "Which engagement does this email belong to?" Uses a compact engagement index with participant emails, pillar, topic, and linked entities. Fast, focused, high-accuracy.
- **Phase 2 (Analysis)** — Deep extraction with full thread history. Produces topic, goal, current_state, participants, entity matches, and pillar. Only runs after routing is determined.

### Curated-Input Philosophy

Every email Roadrunner receives has been **intentionally forwarded** by the PDM because it's relevant to their partner work. The classifier's job is **routing** ("which engagement?"), not **filtering** ("is this relevant?"). Noise handling exists but is treated as a rare edge case, not a primary concern.

### Engagement-Hub Model

The classifier's primary output is an engagement assignment. Everything else — partner, program, event, AWS relationships — is resolved **through the engagement**, not independently. Meetings inherit their entity connections from their parent engagement. This creates a single resolution path for all entity relationships.

## Phase 1: Routing

**Purpose:** Determine which engagement an email belongs to (existing, new, or unclear). Nothing else — no state updates, no participant extraction, no entity matching.

**Model:** `claude-sonnet-4-20250514` · 512 output tokens

### Input Context

Phase 1 receives a compact, enriched context built by `buildPhase1Context()`:

| Section | Builder | Content |
|---------|---------|---------|
| Forwarder | `buildCompactForwarder()` | PDM name, email, role + optional forwarding note |
| Engagement Index | `buildEngagementIndex()` | Grouped by partner. Per engagement: pillar, topic, participant emails (capped at 8, forwarder excluded, partner domains first), linked programs/events, last email subject |
| Partner Catalog | `buildCompactPartnerCatalog()` | Partner name, ID, email domains (extracted from `partner_contacts` JSONB) |
| Email | `buildEmailSection()` | From, To, CC, Subject, Date, body text |
| Meeting Data | `buildMeetingHint()` | Only if ICS attachment: partner hint, organizer, attendees, recurring flag |

### Decision Framework

The system prompt instructs Claude to follow these steps in order, stopping when confident:

1. **Forwarder note** — High-authority routing context from the PDM
2. **Participant match** — Compare sender/CC against engagement participant lists. A sender in exactly one engagement is a strong signal.
3. **Partner match** — Identify partner by email domain. Single-engagement partners route directly.
4. **Disambiguation** (for multi-engagement partners, strongest first):
   - a. Participant overlap — sender/CC unique to one engagement
   - b. Topic alignment — email subject/content matches engagement topic
   - c. Pillar alignment — Co-Sell vs Co-Build vs Co-Market
   - d. Linked entities — email references a program/event linked to a specific engagement
   - e. Subject continuity — subject line matches an engagement's last email subject
5. **Internal/third-party senders** — Route by topic, participant overlap, and subject matching
6. **New engagement** — Clearly different initiative for a known partner → `is_new: true`
7. **Flag for review** — Cannot determine → confidence below 0.70

### Output

```typescript
interface Phase1Result {
  content_type: "engagement_email" | "meeting_invite" | "mixed" | "noise";
  engagement_match: {
    id: string | null;       // existing engagement UUID, or null if new/noise
    name: string;            // existing name, or suggested "Partner - Initiative"
    confidence: number;      // 0.0–1.0
    is_new: boolean;
    partner_name: string | null;
    partner_id: string | null;
  };
}
```

### Confidence Routing

| Score | Action |
|-------|--------|
| 0.95–1.0 | Sender is known participant in exactly one engagement + topic aligns |
| 0.85–0.94 | Partner + topic clearly align, or strong subject continuity |
| 0.70–0.84 | Partner identified but topic partial, or sender in multiple engagements |
| < 0.70 | Cannot determine → approval queue for human review |
| Noise | Always 1.0 |

**Routing:** ≥ 0.85 → auto-assign (or auto-create if `is_new`). < 0.85 → create `approval_queue` item → appears in Inbox UI.

## Phase 2: Deep Analysis

**Purpose:** Extract structured engagement data after routing is determined. Runs with the full engagement context.

**Model:** `claude-sonnet-4-20250514` · 4096 output tokens

### Input Context

Phase 2 receives everything Phase 1 sees, plus the matched engagement's full history. Built by `buildPhase2Context()`:

| Section | Content |
|---------|---------|
| Current date | Temporal anchor for date discipline |
| Forwarder identity | Full PDM identity + optional note |
| Phase 1 pass-through | content_type + engagement_match (to echo back) |
| Engagement context | Name, partner, topic, goal, status, pillar, current_state anchor, message count |
| Engagement history | All prior messages (oldest first) with From/To/CC/Subject/Date/body |
| Linked meetings | Existing meetings for this engagement |
| New email(s) | Clearly marked with `>>> NEW EMAIL — CLASSIFY THIS <<<` |
| Incoming meeting data | Structured ICS data (if present) |
| Matched partner | Segment, key contacts, what_they_do |
| Reference catalogs | Events, programs, AWS relationships (with JSONB contacts) |

### Output

```typescript
interface CombinedClassificationResult {
  // Echoed from Phase 1
  content_type: "engagement_email" | "meeting_invite" | "mixed" | "noise";
  engagement_match: { id, name, confidence, is_new, partner_name, partner_id };

  // Phase 2 extractions
  topic: string | null;           // 3-8 word engagement subject (stable across emails)
  goal: string | null;            // 1 sentence success definition (stable)
  engagement_name: string | null; // "{Partner} - {topic}"
  current_state: string | null;   // 3-8 sentence prose snapshot, date-anchored
  pillar: "Co-Sell" | "Co-Build" | "Co-Market" | null;
  participants: { name, email, organization, role }[];
  matched_events: { id, name, relationship }[];
  matched_programs: { id, name, relationship }[];
  matched_relationships: { id, name, relationship }[];
}
```

### Key Rules

- **Extract from NEW email only** — history is context, not a source of new participants or entity matches
- **Explicit entity references only** — match programs/events/relationships by name or participant presence, never by topic similarity
- **Date discipline** — no relative time words ("recently", "soon"), present progressive for ongoing actions, include factual dates from emails
- **Topic/goal stability** — return existing values exactly unless the engagement has fundamentally changed direction
- **current_state evolution** — update the anchor, don't replace it. Preserve important context from prior state.

## Pipeline Flow

```
Mailgun webhook → POST /api/inbound
  → email-parser.ts: parse forwarded email chain (two-pass)
  → ics-parser.ts: extract meeting data (if calendar attachment)
  → messages.ts: store messages (per-message fingerprint dedup)
  → meetings.ts: createMeetingFromICS (if ICS present)
  ↓
classifyTwoPhase(messages, forwarderNote, nameMap)
  → Phase 1: buildPhase1Context() → classifyPhase1()
     → Noise? Return early (no Phase 2)
  → Between phases: fetch engagement history, partner, catalogs, name map (parallel)
  → Phase 2: buildPhase2Context() → classifyPhase2()
  ↓
applyClassificationResult(messages, result)
  → confidence ≥ 0.85 + existing → auto-assign
  → confidence ≥ 0.85 + is_new → createEngagement() → auto-assign
  → confidence < 0.85 → createApproval() (Inbox review)
  ↓
persistClassificationResult(result, engagementId, messageIds, isNew)
  → Update messages with classification data
  → Update engagement (current_state, topic, goal, name, pillar)
  → Create entity links (engagement↔event, engagement↔program)
  → Create engagement↔relationship links
  → Upsert participants and link to engagement
  → Backfill message sender names
  → Link meetings to engagement (if meeting_invite)
  ↓
pushEngagementToAirtable(engagementId) — awaited
```

### Inbox Resolve Flow

When a user resolves an approval (assigns to existing or creates new engagement), the system runs **Phase 2 only** via `runPhase2ForResolve()`. This produces a `current_state` written with the correct engagement's full history — better than the original Phase 1 routing context.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/classifier.ts` | Orchestrator — Phase 1 → Phase 2 → persist → push |
| `src/lib/phase1-prompt.ts` | Phase 1 system prompt + context builders (engagement index, partner catalog) |
| `src/lib/phase2-prompt.ts` | Phase 2 system prompt + context builders (history, catalogs, partner) |
| `src/lib/prompt-builder.ts` | Shared section builders (forwarder, events, programs, relationships, email) |
| `src/lib/claude.ts` | Anthropic API client (classifyPhase1, classifyPhase2) |
| `src/lib/email-parser.ts` | Forwarded email chain parser (two-pass: headers then quoted replies) |
| `src/lib/ics-parser.ts` | ICS calendar event parser (RFC 5545) |
| `src/lib/name-resolver.ts` | Contact name resolution from JSONB columns |
| `src/lib/contact-parser.ts` | Universal "Name \<email\> (Title)" format parser/renderer |
