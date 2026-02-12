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

**Engagements** — The core unit of work. One partner + one goal, tracked through email threads. Example: "Acme Security - FedRAMP Certification". Each has a partner_name and evolving current_state summary. Engagements are the ONLY entity you can create. If this email represents new work not matching any existing engagement, set is_new: true.

**Programs** — Pre-defined AWS programs, frameworks, and motions. Examples: ISV Accelerate, Well-Architected, M-POP, Security Competency. These are REFERENCE DATA — you MUST match by ID from the provided list. Never invent a program. If no program is relevant, return an empty matched_programs array.

**Events** — Pre-defined AWS events and milestones. Examples: re:Invent, re:Inforce, NY Summit. These are REFERENCE DATA — you MUST match by ID from the provided list. Never invent an event. If no event is relevant, return an empty matched_events array.

## What Is NOT an Event

Meetings are NOT events. Calls, demos, cadence calls, 1:1s, syncs, working sessions, check-ins, and any partner-specific gatherings are engagement workflow. Mention them in current_state only. Do NOT include them in matched_events.

Only match to events that appear in the "Tracked Events" list provided in the context.

## Rules

1. **Prefer existing engagements.** Match to existing engagements when the partner and topic align. Only set is_new: true when nothing matches.
2. **Match programs and events by ID only.** You are given a list of programs and events with their IDs. Return only IDs from that list. Never fabricate an ID. If unsure whether something matches, omit it.
3. **Noise.** Auto-replies, OOO, newsletters, marketing blasts = "noise". Return null current_state, empty arrays, confidence 1.0.
4. **Mixed content.** If an email discusses multiple engagements, set content_type "mixed" and classify the primary engagement.
5. **Multi-message threads.** Messages from the same forward are one classification unit. Synthesize across all messages.
6. **Participants.** Extract ALL people mentioned by name, even without email addresses. Set email to null if unavailable. Correlate names in the body with From/To/CC headers when possible. The person whose email matches the forwarding address gets role "forwarder".
7. **Temporal honesty.** Only include dates that are explicitly confirmed: scheduled dates, named conference dates, explicit deadlines ("POC due March 15"). Vague intentions ("let's connect next week") go in current_state prose only, never as due_dates.
8. **Tags.** Suggest short, lowercase labels that help categorize this engagement. Examples: "co-sell", "finserv", "poc", "migration", "marketplace", "security-review". Only suggest tags that are genuinely descriptive. Empty array is fine.

## Confidence Calibration

- 0.95–1.0: Email explicitly names the engagement or is a direct thread continuation
- 0.85–0.94: Same partner + topic, clear contextual match
- 0.70–0.84: Related partner or topic, but no direct engagement reference
- Below 0.70: Tangential or ambiguous
- Noise: always 1.0 confidence, is_new: false

## current_state Instructions

Write 3-5 sentences. Executive briefing style: what this engagement is about, who's involved (first names only — full details are in participants), current status and momentum, key context.

Write concretely: "Brian and Tanya are coordinating an integration discussion with the security team" not "Teams are actively facilitating comprehensive collaboration."

Do NOT include: fabricated dates, participant lists with titles/emails, bullet points, markdown formatting, or vague filler.

Return null if noise.

## open_items Instructions

Extract concrete action items only: who needs to do what.
- assignee: person name or null if unclear
- due_date: ISO date string ONLY if an explicit deadline is stated in the email. Otherwise null.
- Do not fabricate deadlines from vague language

## Response Format

Return ONLY valid JSON. No markdown code blocks, no preamble, no explanation.

{
  "content_type": "engagement_email" | "meeting_invite" | "mixed" | "noise",
  "engagement_match": {
    "id": "uuid of existing engagement or null if new",
    "name": "existing name or suggested name if new",
    "confidence": 0.0-1.0,
    "is_new": true/false,
    "partner_name": "company name or null"
  },
  "matched_events": [
    {
      "id": "uuid from the Tracked Events list — MUST be an ID you were given",
      "name": "event name for logging",
      "relationship": "relevant_to | preparation_for | deadline | presenting_at | sponsoring"
    }
  ],
  "matched_programs": [
    {
      "id": "uuid from the Active Programs list — MUST be an ID you were given",
      "name": "program name for logging",
      "relationship": "implements | qualifies_for | enrolled_in | graduating | blocked_by"
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
  "current_state": "3-5 sentence executive briefing or null if noise",
  "open_items": [
    {
      "description": "what needs to be done",
      "assignee": "person name or null",
      "due_date": "ISO date or null — ONLY if explicitly stated"
    }
  ],
  "suggested_tags": ["lowercase-tag", "another-tag"]
}

If noise: content_type "noise", engagement_match with null id, 1.0 confidence, is_new false, null current_state, all arrays empty.`;

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
        `- **${eng.name}** (id: ${eng.id})${eng.partner_name ? ` — Partner: ${eng.partner_name}` : ""}${eng.current_state ? `\n  Current state: ${eng.current_state}` : ""}`
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
      const hostStr = evt.host ? `, host: ${evt.host}` : "";
      parts.push(
        `- **${evt.name}** (id: ${evt.id}, type: ${evt.type}${hostStr}, ${dateStr})${evt.description ? ` — ${evt.description}` : ""}`
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
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    cleaned = cleaned.replace(/\n?```\s*$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Default suggested_tags if Claude omits it
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
