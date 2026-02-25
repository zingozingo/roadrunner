# Roadrunner — Classification Pipeline

## Overview

The classification pipeline is the heart of Roadrunner. It takes a raw forwarded email and produces a structured classification: which engagement it belongs to, what participants were mentioned, which programs/events/relationships are relevant, whether any meetings were scheduled, and what the current state of the engagement is.

The pipeline follows the **constrained intelligence** principle: Claude matches emails to existing entities rather than fabricating new ones. Every program, event, partner, and relationship Claude references must already exist in the database.

## Pipeline Flow

```
Email arrives (Mailgun webhook)
  ↓
email-parser.ts — Extract sender, recipients, subject, body, forwarded content
  ↓
ics-parser.ts — If calendar data present, extract meeting details
  ↓
prompt-builder.ts — Build context sections from database
  ↓
claude.ts — Send prompt + email to Claude API
  ↓
classifier.ts — Evaluate confidence, route to auto-persist or approval queue
```

## Modular Prompt Architecture

The prompt is assembled from independent context builder functions in `prompt-builder.ts`. Each function queries the database and builds one section of the prompt. This is intentional — sections can be updated, reordered, or extended independently.

### Context Sections

1. **Partner Context** — All partners with names, segments, focus areas, email domains. Used for partner matching.
2. **Program Context** — All programs with names, types, descriptions. Used for program linking.
3. **Event Context** — All events with names, dates, types, locations. Used for event linking.
4. **AWS Relationship Context** — All relationships with names, types, orgs, contact emails. Used for relationship linking.
5. **Existing Engagements Context** — All active engagements for the matched partner, with current_state summaries. Critical for the "match to existing vs. create new" decision.
6. **User Context** — The PDM's identity, email aliases, and role description. Helps Claude understand the user's perspective.

### Key Prompt Instructions

The prompt instructs Claude to:

- **Prefer existing engagements** over creating new ones. If an email plausibly relates to an existing engagement, match it.
- **Match by ID** — entity references in the response must use database IDs, not names.
- **Produce a living summary** (current_state) that evolves with each email — not a summary of the single email, but an updated state of the entire engagement.
- **Classify participants** as AWS, partner, or other based on email domain.
- **Detect noise** — auto-newsletter, marketing blasts, and non-actionable emails should be flagged.

## Classification Output Schema

Claude returns a JSON object with this structure:

```json
{
  "engagement": {
    "id": "uuid or null (null = create new)",
    "name": "Engagement name",
    "current_state": "Updated living summary",
    "status": "active",
    "pillar": "optional",
    "tags": ["optional", "freeform", "labels"]
  },
  "partner_id": "matched partner UUID",
  "participants": [
    { "name": "...", "email": "...", "company": "...", "role": "...", "type": "aws|partner|other" }
  ],
  "entity_links": [
    { "entity_type": "program|event|aws_relationship", "entity_id": "uuid" }
  ],
  "meetings": [
    { "title": "...", "meeting_date": "...", "start_time": "...", "attendees": [...] }
  ],
  "confidence": 0.0-1.0,
  "reasoning": "Why Claude made these choices"
}
```

## Confidence Routing

| Score | Action |
|-------|--------|
| ≥ 0.85 | Auto-persist — classification is applied immediately |
| < 0.85 | Create approval_queue item — appears in Inbox UI for human review |

The threshold is intentionally high. It's better to ask the user than to misclassify.

When a user resolves an approval (approve, reject, or modify), the same `persistClassificationResult()` function is called. This ensures auto-assign and manual-resolve always produce identical database operations.

## Classification Rules

1. **Prefer existing engagements.** Only create new if the email clearly represents a net-new workstream.
2. **Confidence calibration.** High confidence requires: clear partner match, unambiguous engagement match or clear new workstream, extractable summary content.
3. **Noise detection.** Marketing emails, auto-newsletters, system notifications → flag as noise, do not create engagement.
4. **Mixed content.** If an email touches multiple engagements, classify for the primary one and note others in tags.
5. **Multi-message threads.** Forwarded threads may contain multiple messages — classify based on the most recent/relevant content.
6. **Event linking threshold.** Only link to an event if the email explicitly references it by name or clear context. Do not infer event relevance from vague timing.

## Living Summary Format

The `current_state` field follows a structured format:

```
WHAT: One-line description of what this engagement is about
STATUS: Current status and recent developments
CONTEXT: Background context, stakeholders, timeline
NEXT: Immediate next steps or pending items
```

This evolves with each email. Claude reads the existing current_state and updates it — not replaces it — incorporating new information while preserving historical context.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/classifier.ts` | Orchestrator — calls Claude, evaluates confidence, routes result |
| `src/lib/claude.ts` | Claude API wrapper — sends prompt, parses response |
| `src/lib/prompt-builder.ts` | Modular context section builders |
| `src/lib/email-parser.ts` | Forwarded email chain parser (extracts body, strips quotes) |
| `src/lib/ics-parser.ts` | ICS calendar event parser (RFC 5545) |
| `src/lib/__tests__/classifier.test.ts` | 12 tests |
| `src/lib/__tests__/claude.test.ts` | 16 tests |
| `src/lib/__tests__/prompt-builder.test.ts` | 16 tests |
| `src/lib/__tests__/email-parser.test.ts` | 72 tests |
| `src/lib/__tests__/ics-parser.test.ts` | 18 tests |

## Deduplication

Emails are deduplicated by `mailgun_message_id`. If a message ID already exists in the messages table, the email is silently dropped. This prevents re-processing if Mailgun retries the webhook or if the user accidentally forwards the same email twice.

## Email Parsing Details

The email parser handles several edge cases:

- **Forwarded chains:** Extracts the original sender, recipients, and body from forwarded headers.
- **Quoted replies:** Strips "On [date], [person] wrote:" blocks.
- **Mailgun field hierarchy:** Uses `body-plain` for email content (not `stripped-text`, which removes forwarded content). Calendar data comes from Mailgun's `body-calendar` field, not file attachments.
- **System address filtering:** Strips relay addresses, Salesforce system emails, and user aliases before participant extraction.
- **Forwarder note signature filtering:** When the forwarding user adds a note above the forwarded content, `stripSignatureLines()` removes corporate signature blocks (title lines, phone numbers, addresses, disclaimers — 14 patterns). Only substantive text (sentences with lowercase words) is captured as `forwarder_note` and sent to Claude as editorial context. This prevents contact-card boilerplate from polluting classification.