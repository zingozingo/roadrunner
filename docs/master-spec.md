# Relay — Master Spec

**Project Codename:** Roadrunner
**Owner:** Steven
**Last Updated:** 2026-02-07

---

## One-Liner

A personal initiative tracker where forwarding an email is the only input required — AI handles classification, summarization, and timeline construction automatically.

---

## Problem

Managing 5-15+ concurrent partner initiatives across dozens of email threads makes it nearly impossible to maintain a clear picture of what's active, what's changed, and what needs attention. Re-reading 30-email threads to rebuild context is a daily time sink.

---

## Solution

Forward emails (and meeting invites) to a dedicated address (`inbox@relay.stevenromero.dev`). The system:

1. Parses and extracts individual messages from forwarded threads
2. Matches to an existing initiative or flags for user review
3. Maintains a living summary and timeline per initiative
4. Links initiatives to relevant programs and events
5. Flags uncertain matches via SMS for quick resolution
6. Delivers a daily digest of what moved

---

## Core Principles

- **Email-in, insight-out.** The user never leaves Outlook to feed the system.
- **AI proposes, user disposes.** Auto-classify when confident; ask when not.
- **Summaries are the product.** Raw emails are stored but never the primary view.
- **Editable everything.** User can rename initiatives, reassign messages, correct participants, close items, override any AI decision.
- **Connect, don't create.** The AI is biased toward linking new information to existing entities rather than spawning new ones.

---

## The Mental Model

**People work with your partners on initiatives that may or may not be part of a larger program and may or may not be tied to an event.**

That's the entire data model in one sentence. Every forwarded email is just adding detail to one or more of those relationships.

```
People ──work on──→ Initiatives ──may belong to──→ Programs
                         │
                    may be tied to
                         │
                         ▼
                       Events
```

---

## The Three Entity Types

### 1. Initiatives

The primary unit of work. An active workstream with a specific partner toward a specific outcome.

Examples:
- "Wiz co-sell motion for FinServ segment"
- "CrowdStrike Stage 3 graduation push"
- "Lacework technical validation POC"

Initiatives have a lifecycle: `active` → `paused` or `closed`. Closed initiatives are archived — still searchable but not shown in active views or matched against new emails.

Each initiative maintains a **living summary** that evolves as new emails arrive. The summary follows a consistent structure:

```
Participants: Jane Smith (AWS SA, technical lead), Bob Lee (Wiz, primary contact)

Current State:
Where things stand right now as of the latest message or meeting.

Timeline:
[Feb 1] Kickoff email from Jane proposing co-sell motion
[Feb 3] Bob confirmed technical requirements
[Feb 4] Architecture review call with Jane, Bob, Maria
[Feb 6] Maria sent updated proposal — waiting on Bob's sign-off

Open Items:
Bob to confirm pricing tier by Feb 10. Jane to schedule follow-up demo.

Key Context:
Initiative velocity is tied to re:Inforce deadline. If POC isn't signed
off by April, the case study timeline is at risk.
```

### 2. Events

Shared anchor points on the calendar that exist independently of any single initiative. Multiple initiatives may reference the same event.

**Events ARE:**
- Industry conferences: re:Invent, re:Inforce, RSA Conference, Black Hat
- Partner conferences/summits: Wiz Innovation Summit, CrowdStrike Fal.Con
- Review cycles: Q2 Stage 3 Review Cycle
- Deadlines that affect multiple initiatives

**Events are NOT:**
- Meetings within a single initiative (a call, a review, a demo)
- Vague future intentions ("we should meet next week")
- Unconfirmed scheduling negotiations ("maybe Thursday works?")

Initiative-specific meetings and calls are captured in the **initiative's timeline** (within its summary), not as Event entities. The distinction: if only one initiative cares about it, it's a timeline entry. If multiple initiatives orbit around it, it's an Event.

Events have types: `conference`, `summit`, `deadline`, `review_cycle`, `meeting_series`

Events have date precision: `exact`, `week`, `month`, `quarter` — never display false precision.

### 3. Programs

Ongoing AWS or partner programs that partners can participate in. Programs are relatively stable — they rarely change week to week, but knowing about them lets you spot opportunities and track eligibility.

Examples:
- "AWS ISV Accelerate Program"
- "AWS Marketplace Co-Sell"
- "Rising Star Partner Track"
- "AWS Security Competency"

Programs are the broadest category — anything a partner can be involved in that isn't just a one-and-done. A program usually involves several initiatives and could be tied to events, or not.

### How They Connect

Any entity can link to any other entity via the `entity_links` table. Each link has a relationship type and context explaining why the link exists.

```
Initiative "Wiz Co-Sell Motion"
  ├── linked to Program: "ISV Accelerate" (qualifies_for)
  ├── linked to Program: "Marketplace Co-Sell" (qualifies_for)
  ├── linked to Event: "AWS re:Invent 2025" (deadline — POC must be done by then)
  ├── linked to Event: "RSA Conference 2025" (opportunity — booth demo)
  │
  └── Initiative Timeline (in summary, NOT the Events table):
       - [Feb 1] Kickoff email
       - [Feb 4] Architecture review call (Jane, Bob)
       - [Feb 12] Technical deep-dive scheduled
       - [Feb 15] POC demo with SA team
```

Relationship types: `deadline`, `target`, `opportunity`, `qualifies_for`, `preparation_for`, `blocked_by`, `related`

---

## User Flows

### Flow 1: Forward an Email

```
Forward email → inbox@relay.stevenromero.dev
      │
      ├─ HIGH confidence match (≥ 0.85)
      │   → Auto-assign to initiative
      │   → Update summary with new information
      │   → Extract participants, links, temporal refs
      │
      ├─ LOW confidence match (< 0.85)
      │   → SMS: "📧 New email from Jane Smith
      │           Re: 'Security Review - Next Steps'
      │           → [1] Wiz Co-Sell Motion (73%)
      │           → [2] Wiz Technical Onboarding (61%)
      │           → [3] New initiative
      │           Reply 1, 2, 3, or a name."
      │   → User replies: "1" → assigns to Wiz Co-Sell Motion
      │                    "3" or "new: Wiz Exec Alignment" → creates new
      │                    "skip" → parks in unclassified inbox
      │
      └─ NOISE (auto-reply, newsletter, marketing)
          → Classified as noise, no entities extracted, no notification
```

### Flow 2: Forward a Meeting Invite (v0.2)

```
Forward .ics invite → same address
      │
      └─ Extract: title, datetime, attendees, notes
         Match to initiative (same logic as above)
         Add as timeline entry in initiative summary
```

### Flow 3: Daily Digest (v0.2)

```
Cron (6:00 PM local) → generate digest email
      │
      └─ Initiatives that had activity today (with updated summaries)
         Upcoming deadlines and events in next 48 hrs
         Items flagged as "waiting on someone" for 5+ days
```

### Flow 4: Dashboard Review

```
User opens dashboard → sees all active initiatives
      │
      ├─ Each initiative shows: summary, participants, timeline, status,
      │   linked events and programs
      ├─ User can: edit summary, close initiative, reassign messages,
      │            merge initiatives, add manual notes
      ├─ Unclassified inbox: items waiting for assignment
      ├─ Events view: all tracked events with linked initiatives
      └─ Programs view: all programs with linked initiatives
```

---

## AI Classification Logic

### Single-Prompt Architecture

Every forwarded email gets one Claude API call that handles everything: classification, entity matching, temporal extraction, participant identification, and summary updates. The intelligence lives in the prompt, not the code.

The prompt receives the full current state (all active initiatives with summaries, all events with dates, all programs with descriptions) so Claude can match against them.

### Classification Rules

1. **Prefer existing entities.** Only suggest creating a new entity when nothing in the current state is a reasonable match. Fuzzy-match names — "re:Invent 2025" and "AWS re:Invent" are the same event.

2. **Confidence calibration.** 0.9+ means very sure. 0.7-0.89 means probable but not explicitly named. Below 0.7 is a guess.

3. **Noise detection.** Auto-replies, out-of-office, newsletters, marketing blasts are "noise". Skip entity extraction for noise.

4. **Mixed content.** If an email discusses multiple entity types, classify as "mixed" and extract all.

5. **Summary updates.** When matching to an existing initiative, provide an updated summary using the prescribed format (Participants → Current State → Timeline → Open Items → Key Context).

6. **Multi-message threads.** When multiple messages are provided from the same forward, classify as a single unit — one initiative match, one summary that incorporates all messages chronologically.

7. **Temporal extraction standards.** Only extract temporal references for CONFIRMED, CONCRETE dates. Scheduled meetings with specific dates, named conferences, explicit deadlines. NOT casual suggestions like "we should sync next week" or "maybe Thursday works?"

8. **Event creation threshold.** Only create Events for: (a) named industry/partner conferences and summits, (b) deadlines or milestones with specific dates that affect multiple initiatives, (c) review cycles with defined timeframes. A meeting that is part of one initiative's workflow is a timeline entry in the summary, NOT an Event entity.

### Confidence Thresholds

| Confidence | Action |
|------------|--------|
| ≥ 0.85 | Auto-assign. Update summary. No notification. |
| 0.50 – 0.84 | SMS user with best guess + alternatives. Wait for reply. |
| < 0.50 | SMS user: "Doesn't match anything. Create new?" |
| Noise | Classify as noise. No action. No notification. |

### Agent Autonomy Rules

**Auto-proceed (no user approval needed):**
- Add a message to an initiative (confidence ≥ 0.85)
- Add a person to an initiative's participant list
- Update an initiative summary with new information
- Link an initiative to an event/program that was explicitly named in the email
- Create a timeline entry from a clearly stated date
- Update an event's details (e.g., date confirmed in a later email)

**Ask via SMS (needs user approval):**
- Create a new initiative
- Create a new event
- Create a new program
- Assign an email when confidence < 0.85
- Merge two initiatives that seem to be the same thing

**Never do (user only, via dashboard):**
- Delete anything
- Change an initiative name
- Remove a link between entities
- Resolve conflicting information

---

## SMS Interaction Design

**Outbound (Relay → User):**
```
📧 New email from Jane Smith
Re: "Security Review - Next Steps"
→ [1] Wiz Co-Sell Motion (73%)
→ [2] Wiz Technical Onboarding (61%)
→ [3] New initiative
Reply 1, 2, 3, or a name.
```

**Inbound (User → Relay):**
- `1` → assigns to Wiz Co-Sell Motion
- `3` or `new: Wiz Executive Alignment` → creates new initiative
- Any other text → creates new initiative with that name
- `skip` → parks in unclassified inbox for later

**Confirmation (Relay → User):**
```
✓ Assigned to: Wiz Co-Sell Motion
```

SMS messages are kept under 320 characters (2 segments max). Resolution requires a single reply from the phone — no back-and-forth.

---

## Data Model

### Initiatives
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | text | User-editable, AI-suggested on creation |
| status | enum | `active`, `paused`, `closed` |
| summary | text | AI-generated, user-editable |
| partner_name | text | Primary partner involved |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via trigger |
| closed_at | timestamptz | Nullable |

### Events
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | text | "AWS re:Invent 2025" |
| type | enum | `conference`, `summit`, `deadline`, `review_cycle`, `meeting_series` |
| start_date | date | Nullable if unknown |
| end_date | date | Nullable |
| date_precision | enum | `exact`, `week`, `month`, `quarter` |
| location | text | Nullable |
| description | text | AI-built from forwarded content |
| source | enum | `seed`, `email_extracted`, `user_created` |
| verified | boolean | User has confirmed details |
| created_at | timestamptz | |

### Programs
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | text | "AWS ISV Accelerate" |
| description | text | AI-built from forwarded content |
| eligibility | text | Nullable |
| url | text | Nullable |
| status | enum | `active`, `archived` |
| created_at | timestamptz | |

### Entity Links
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| source_type | enum | `initiative`, `event`, `program` |
| source_id | uuid | |
| target_type | enum | `initiative`, `event`, `program` |
| target_id | uuid | |
| relationship | text | `deadline`, `target`, `opportunity`, `qualifies_for`, `preparation_for`, `blocked_by`, `related` |
| context | text | Why this link exists |
| created_by | enum | `ai`, `user` |
| created_at | timestamptz | |

### Messages
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| initiative_id | uuid | FK, nullable (unclassified if null) |
| sender_name | text | |
| sender_email | text | |
| sent_at | timestamptz | Original send time |
| subject | text | |
| body_text | text | Cleaned plain text |
| body_raw | text | Original HTML |
| content_type | enum | `initiative_email`, `event_info`, `program_info`, `meeting_invite`, `mixed`, `noise` |
| classification_confidence | float | 0.0–1.0 |
| linked_entities | jsonb | Array of {type, id} |
| pending_review | boolean | Needs user decision |
| classification_result | jsonb | Full Claude output for review |
| forwarded_at | timestamptz | When Relay received it |

### Participants
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| email | text | Unique |
| name | text | |
| organization | text | Nullable |
| notes | text | Nullable |
| created_at | timestamptz | |

### Participant Links
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| participant_id | uuid | FK |
| entity_type | enum | `initiative`, `event` |
| entity_id | uuid | |
| role | text | Nullable |
| created_at | timestamptz | |

### Pending Reviews
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| message_id | uuid | FK to messages |
| sms_sent | boolean | Default false |
| sms_sent_at | timestamptz | Nullable |
| resolved | boolean | Default false |
| resolved_at | timestamptz | Nullable |
| resolution | text | What the user chose |
| classification_result | jsonb | Full Claude output |
| options_sent | jsonb | Numbered options as sent in SMS |
| created_at | timestamptz | |

### Notes
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| initiative_id | uuid | FK |
| content | text | Freeform user input |
| created_at | timestamptz | |

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Hosting | Vercel | Serverless, free tier |
| Framework | Next.js 14+ (App Router) | API routes + dashboard in one project |
| Language | TypeScript | Type safety for structured data model |
| Database | Supabase (Postgres) | Free tier, relational, good DX |
| Inbound Email | Mailgun (relay.stevenromero.dev) | Webhook-based inbound routing |
| AI | Claude API (Sonnet) | Classification + summarization |
| SMS | Twilio | Low-confidence notifications + reply handling |
| Styling | Tailwind CSS | Fast iteration on dashboard |
| Daily Digest | Vercel Cron + email (v0.2) | Scheduled summary |

---

## Architecture

```
You (Outlook) ──forward──→ inbox@relay.stevenromero.dev
                                    │
                                    ▼
                           Mailgun (receives email)
                                    │
                                    ▼ (webhook POST)
                           Vercel: /api/inbound
                                    │
                                    ▼
                           Parse forwarded email into messages
                                    │
                                    ▼
                           Store raw messages in Supabase
                                    │
                                    ▼
                           Claude API: classify + extract + summarize
                                    │
                           ┌────────┴────────┐
                           │                 │
                     ≥ 0.85 confidence    < 0.85 confidence
                           │                 │
                     Auto-assign to       SMS via Twilio
                     initiative,          "Which initiative?"
                     update summary            │
                           │                 User replies
                           │                   │
                           │              Apply decision
                           │                   │
                           └────────┬──────────┘
                                    │
                                    ▼
                           Supabase (initiatives, events,
                           programs, links, participants)
                                    │
                                    ▼
                           Dashboard (Next.js) ← user browses/edits
```

---

## Build Phases

### v0.1 — The Loop (current build)
- [x] Project scaffold + database schema
- [x] Inbound email webhook + parser
- [x] Claude classification engine
- [x] Prompt tuning (temporal rules, event thresholds, summary format)
- [x] SMS notifications for low-confidence (sends via Twilio; A2P 10DLC registration pending for delivery)
- [x] Dashboard: initiatives list, detail view, unclassified inbox (dark theme, sidebar, inbox resolve, events, programs pages)
- [x] Dashboard: inbox review resolution (button click → initiative created → entities linked → review resolved)
- [x] Message deduplication on inbound webhook
- [x] End-to-end wiring + testing with real emails (Mailgun → parse → classify → review → resolve tested in production)
- [ ] Dashboard: edit/CRUD operations (rename initiatives, close, reassign messages, manual notes)

### v0.2 — The Polish
- [ ] Daily digest email
- [ ] Meeting invite (.ics) parsing
- [ ] Initiative merge/split
- [ ] Timeline visualization
- [ ] Seed data for known events (re:Invent, RSA, etc.)

### v0.3 — The Bridge
- [ ] Airtable sync
- [ ] Export initiative briefs as documents
- [ ] Cross-initiative event view ("everything tied to re:Invent")
- [ ] Search across all stored content
- [ ] Analytics (response times, initiative velocity)

---

## Preventing Bloat

1. **Initiatives have a lifecycle.** Closed initiatives archive cleanly — searchable but not active.
2. **Events expire naturally.** Past events move to "past" state.
3. **Programs are slow-moving.** A handful covers 80% of work.
4. **AI is biased toward connecting, not creating.** The prompt explicitly prefers linking to existing entities.
5. **Monthly housekeeping.** Flag initiatives with no activity in 30 days: "Close these?"
6. **Meetings stay in summaries.** Initiative-specific meetings are timeline entries, not Event entities. This prevents the Events table from ballooning with hundreds of one-off calls.

---

## Deduplication Strategy

- **Messages:** Hash on sender + timestamp + first 100 chars of body. If a thread is forwarded twice (once with 10 messages, later with 15), only new messages are added.
- **Entities:** Fuzzy name matching via Claude before creating new entities.
- **Entity links:** Check for existing link with same source/target/relationship before creating.
- **Participants:** Upsert by email address. Update name/org if better info is found.

---

## Privacy Note

Forwarded work emails live in a personal Supabase database. This is a personal productivity tool — be conscious of what's retained and for how long. Worth considering a retention policy if this evolves beyond personal use.

---

## Success Criteria

After 2 weeks of daily use:
- Forwarding habit is established (5+ emails/day forwarded)
- Classification accuracy ≥ 90% (measured by manual correction rate via SMS)
- Time to "catch up" on any initiative drops from 10-15 min to under 2 min
- Can produce a partner status update from dashboard data alone