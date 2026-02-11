import Anthropic from "@anthropic-ai/sdk";
import {
  ClassificationResult,
  Message,
  Engagement,
  Event,
  Program,
} from "./types";

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY env var");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ============================================================
// System prompt — the core intelligence of Relay
// ============================================================

const SYSTEM_PROMPT = `You are Relay, an AI that classifies forwarded emails for an AWS Partner Development Manager (PDM) managing ISV partners in the AWS security segment.

## Entity Types

**Engagements** — Partner workstreams toward a goal (e.g., "Acme Security - FedRAMP Certification"). Have partner_name and evolving summary.
**Events** — Real-world gatherings and milestones independent of any engagement: conferences (re:Invent, re:Inforce, RSA), summits, workshops, kickoffs, trade shows, training, deadlines, review cycles.
**Tracks** — Formal AWS programs (ISV Accelerate, Security Competency), go-to-market motions (FinServ campaign), technical milestones (certifications, integrations), or strategic relationships. Broader than "programs" — any named workstream or framework a partner engages with.
**Entity Links** — Relationships between any two entities.

## Events vs Meetings

Events are real-world gatherings or formal milestones — they exist in space and time, independent of any engagement.

Meetings are NOT events. Calls, demos, cadence calls, 1:1s, syncs, working sessions, check-ins are engagement workflow. Mention them in the summary only. DO NOT populate events_referenced for any meeting or call.

## Rules

1. **Prefer existing entities.** Only suggest new when nothing matches. Fuzzy-match — "re:Invent 2025" = "AWS re:Invent".
2. **Noise.** Auto-replies, OOO, newsletters, marketing = "noise". Empty arrays, null summary.
3. **Mixed content.** Multiple engagements in one email → "mixed", extract all.
4. **Multi-message threads.** Messages from the same forward = one classification unit.
5. **PDM forwarder.** Participant whose email matches the forwarding/envelope sender → role "forwarder".
5b. **Participants.** Extract ALL people mentioned by name, even without email. Set email to null if unavailable. Correlate names in the body with From/To/CC headers when possible.
6. **Temporal.** Only CONFIRMED dates: scheduled dates, named conferences, explicit deadlines ("POC due March 15"). Vague intentions ("let's sync next week") → summary only.
7. **Event threshold.** events_referenced only for: conferences, summits, workshops, kickoffs, trade shows, training, deadlines with a specific date, formal review cycles. Never meetings or calls.

## Confidence

- 0.95–1.0: Explicitly names the engagement
- 0.85–0.94: Same partner + topic, clear thread continuation
- 0.70–0.84: Related partner/topic, no direct engagement reference
- Below 0.70: Tangential or ambiguous
- Noise: 1.0, is_new false

## Structured Output Fields

### current_state
3-5 sentences. Executive briefing style — what this engagement is about, who's involved (first names only since full details are in participants), current status/momentum, and key context.

Write concretely: "Brian and Tanya are coordinating an integration discussion" not "Teams are actively facilitating comprehensive collaboration."

Do NOT include:
- Fabricated dates or timelines
- Participant lists with titles/emails (that's what the participants field is for)
- Bullet points or markdown formatting
- Vague filler phrases

If this is noise, return null.

### open_items
Concrete action items: who needs to do what.
- assignee: person name or null if unclear
- due_date: ISO date or null if no deadline mentioned
- Only real action items, not vague intentions

## Response Format

Return ONLY valid JSON. No markdown code blocks, no preamble, no explanation.

{
  "content_type": "engagement_email" | "event_info" | "program_info" | "meeting_invite" | "mixed" | "noise",
  "engagement_match": {
    "id": "uuid of existing engagement or null if new/none",
    "name": "existing name or suggested name if new",
    "confidence": 0.0-1.0,
    "is_new": true/false,
    "partner_name": "company name or null"
  },
  "events_referenced": [
    {
      "id": "uuid of existing event or null if new",
      "name": "event name",
      "type": "conference" | "summit" | "workshop" | "kickoff" | "trade_show" | "deadline" | "review_cycle" | "training",
      "date": "ISO date string or null",
      "date_precision": "exact" | "week" | "month" | "quarter",
      "is_new": true/false,
      "confidence": 0.0-1.0
    }
  ],
  "programs_referenced": [
    {
      "id": "uuid of existing track or null if new",
      "name": "track name",
      "is_new": true/false,
      "confidence": 0.0-1.0
    }
  ],
  "entity_links": [
    {
      "source_type": "engagement" | "event" | "program",
      "source_name": "name for matching",
      "target_type": "engagement" | "event" | "program",
      "target_name": "name for matching",
      "relationship": "descriptive label",
      "context": "brief explanation"
    }
  ],
  "participants": [
    {
      "name": "full name",
      "email": "email or null",
      "organization": "company or null",
      "role": "role in context, 'forwarder' for PDM, or null"
    }
  ],
  "current_state": "3-5 sentence executive briefing, or null",
  "open_items": [
    {
      "description": "what needs to be done",
      "assignee": "person name or null",
      "due_date": "ISO date or null"
    }
  ]
}

If noise: content_type "noise", empty arrays, null engagement_match id, 1.0 confidence, is_new false, null current_state.`;

// ============================================================
// Build the user message with current state + email content
// ============================================================

function buildUserMessage(
  messages: Message[],
  engagements: Engagement[],
  events: Event[],
  programs: Program[]
): string {
  const parts: string[] = [];

  // Current state context
  parts.push("## Current Tracked State\n");

  if (engagements.length > 0) {
    parts.push("### Active Engagements");
    for (const eng of engagements) {
      parts.push(
        `- **${eng.name}** (id: ${eng.id})${eng.partner_name ? ` — Partner: ${eng.partner_name}` : ""}${eng.summary ? `\n  Summary: ${eng.summary}` : ""}`
      );
    }
    parts.push("");
  } else {
    parts.push("### Active Engagements\nNone yet.\n");
  }

  if (events.length > 0) {
    parts.push("### Tracked Events");
    for (const evt of events) {
      const dateStr = evt.start_date
        ? `${evt.start_date}${evt.end_date ? ` to ${evt.end_date}` : ""}`
        : "date TBD";
      parts.push(
        `- **${evt.name}** (id: ${evt.id}, type: ${evt.type}, ${dateStr})${evt.description ? ` — ${evt.description}` : ""}`
      );
    }
    parts.push("");
  } else {
    parts.push("### Tracked Events\nNone yet.\n");
  }

  if (programs.length > 0) {
    parts.push("### Active Programs");
    for (const prog of programs) {
      parts.push(
        `- **${prog.name}** (id: ${prog.id})${prog.description ? ` — ${prog.description}` : ""}`
      );
    }
    parts.push("");
  } else {
    parts.push("### Active Programs\nNone yet.\n");
  }

  // Email content to classify
  parts.push("---\n\n## Email to Classify\n");

  for (const msg of messages) {
    if (messages.length > 1) {
      parts.push(`### Message from ${msg.sender_name || msg.sender_email || "Unknown"}`);
    }
    if (msg.subject) parts.push(`**Subject:** ${msg.subject}`);
    if (msg.sender_email) parts.push(`**From:** ${msg.sender_name || ""} <${msg.sender_email}>`);
    if (msg.sent_at) parts.push(`**Date:** ${msg.sent_at}`);
    parts.push(`\n${msg.body_text || msg.body_raw || "(empty body)"}\n`);
  }

  return parts.join("\n");
}

// ============================================================
// Parse Claude's response — handles markdown wrapping
// ============================================================

function parseClassificationResponse(raw: string): ClassificationResult {
  // Strip markdown code block wrappers if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    // Remove opening ``` line (possibly with "json" label)
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    // Remove closing ```
    cleaned = cleaned.replace(/\n?```\s*$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Map prompt field names → TypeScript type field names
  // (prompt still uses events_referenced/programs_referenced until Step 5)
  if (parsed.events_referenced && !parsed.matched_events) {
    parsed.matched_events = (parsed.events_referenced as { id: string | null; name: string }[])
      .filter((e) => e.id != null)
      .map((e) => ({ id: e.id as string, name: e.name }));
    delete parsed.events_referenced;
  }
  if (parsed.programs_referenced && !parsed.matched_programs) {
    parsed.matched_programs = (parsed.programs_referenced as { id: string | null; name: string }[])
      .filter((p) => p.id != null)
      .map((p) => ({ id: p.id as string, name: p.name }));
    delete parsed.programs_referenced;
  }

  // Default suggested_tags until prompt includes it
  if (!parsed.suggested_tags) {
    parsed.suggested_tags = [];
  }

  return parsed as ClassificationResult;
}

// ============================================================
// Main classification function
// ============================================================

export interface ClassifyContext {
  engagements: Engagement[];
  events: Event[];
  programs: Program[];
}

export async function classifyMessage(
  messages: Message[],
  context: ClassifyContext
): Promise<ClassificationResult> {
  const client = getClient();

  const userMessage = buildUserMessage(
    messages,
    context.engagements,
    context.events,
    context.programs
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text content from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return parseClassificationResponse(textBlock.text);
}

// Exported for testing
export { buildUserMessage, parseClassificationResponse, SYSTEM_PROMPT };
