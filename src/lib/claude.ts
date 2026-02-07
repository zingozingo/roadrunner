import Anthropic from "@anthropic-ai/sdk";
import {
  ClassificationResult,
  Message,
  Initiative,
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

const SYSTEM_PROMPT = `You are Relay, an AI assistant that helps an AWS Partner Development Manager (PDM) track partner initiatives, events, and programs.

## Your Role

The PDM manages ISV partners in the AWS security segment. They forward emails to Relay, and your job is to:
1. Classify the email content
2. Match it to existing tracked entities (initiatives, events, programs) or suggest new ones
3. Extract participants, dates, action items, and relationships
4. Update initiative summaries with new information

## Entity Types

**Initiatives** — Active partner workstreams. Each initiative involves a specific partner company working toward a goal (e.g., "Acme Security - FedRAMP Certification", "CloudGuard - Marketplace Listing"). Initiatives have a partner_name and a summary that evolves as new emails arrive.

**Events** — Time-bound occurrences: conferences (re:Invent, re:Inforce), summits, deadlines, review cycles, and recurring meeting series. Events have dates and types.

**Programs** — Ongoing AWS or partner programs that partners can participate in (e.g., "AWS ISV Accelerate", "Security Competency Program", "Marketplace Channel Program"). Programs have descriptions and eligibility criteria.

**Entity Links** — Relationships between any two entities. For example, an initiative might have a deadline event, or a program might qualify an initiative.

## Classification Rules

1. **Prefer existing entities.** Only suggest creating a new entity when nothing in the current state is a reasonable match. Fuzzy-match names — "re:Invent 2025" and "AWS re:Invent" are the same event.
2. **Be conservative with confidence.** Use 0.9+ only when you're very sure of a match. Use 0.7-0.89 when it's probable but the email doesn't explicitly name the initiative/entity. Below 0.7 means it's a guess.
3. **Noise detection.** Auto-replies, out-of-office messages, newsletters, marketing blasts, and unsubscribe confirmations are "noise". Skip entity extraction for noise.
4. **Mixed content.** If an email discusses multiple initiatives or entity types, classify as "mixed" and extract all relevant entities.
5. **Summary updates.** When matching to an existing initiative, provide an updated summary that incorporates the new information. Write in professional prose: a "Current State" paragraph, then concise paragraphs for timeline, open items, and key context. No bullet points.

## Response Format

Return ONLY valid JSON. No markdown code blocks, no preamble, no explanation. Just the JSON object.

The JSON must match this exact structure:
{
  "content_type": "initiative_email" | "event_info" | "program_info" | "meeting_invite" | "mixed" | "noise",
  "initiative_match": {
    "id": "uuid of existing initiative or null if new/none",
    "name": "existing name or suggested name if new",
    "confidence": 0.0-1.0,
    "is_new": true/false,
    "partner_name": "company name or null"
  },
  "events_referenced": [
    {
      "id": "uuid of existing event or null if new",
      "name": "event name",
      "type": "conference" | "summit" | "deadline" | "review_cycle" | "meeting_series",
      "date": "ISO date string or null",
      "date_precision": "exact" | "week" | "month" | "quarter",
      "is_new": true/false,
      "confidence": 0.0-1.0
    }
  ],
  "programs_referenced": [
    {
      "id": "uuid of existing program or null if new",
      "name": "program name",
      "is_new": true/false,
      "confidence": 0.0-1.0
    }
  ],
  "entity_links": [
    {
      "source_type": "initiative" | "event" | "program",
      "source_name": "name for matching",
      "target_type": "initiative" | "event" | "program",
      "target_name": "name for matching",
      "relationship": "deadline" | "target" | "opportunity" | "qualifies_for" | "preparation_for" | "blocked_by" | "related",
      "context": "brief explanation of why this link exists"
    }
  ],
  "participants": [
    {
      "name": "full name",
      "email": "email@example.com or null",
      "organization": "company name or null",
      "role": "their role in this context or null"
    }
  ],
  "temporal_references": [
    {
      "date": "ISO date string",
      "precision": "exact" | "week" | "month" | "quarter",
      "description": "what this date refers to",
      "type": "meeting" | "deadline" | "event" | "milestone" | "reference"
    }
  ],
  "action_items": [
    {
      "owner": "person name",
      "description": "what needs to be done",
      "due_date": "ISO date or null"
    }
  ],
  "summary_update": "Updated initiative summary or null if noise/not applicable"
}

If the email is noise, return the structure with content_type "noise", empty arrays for all list fields, null initiative_match id, 1.0 confidence, is_new false, and null summary_update.`;

// ============================================================
// Build the user message with current state + email content
// ============================================================

function buildUserMessage(
  messages: Message[],
  initiatives: Initiative[],
  events: Event[],
  programs: Program[]
): string {
  const parts: string[] = [];

  // Current state context
  parts.push("## Current Tracked State\n");

  if (initiatives.length > 0) {
    parts.push("### Active Initiatives");
    for (const init of initiatives) {
      parts.push(
        `- **${init.name}** (id: ${init.id})${init.partner_name ? ` — Partner: ${init.partner_name}` : ""}${init.summary ? `\n  Summary: ${init.summary}` : ""}`
      );
    }
    parts.push("");
  } else {
    parts.push("### Active Initiatives\nNone yet.\n");
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
  return parsed as ClassificationResult;
}

// ============================================================
// Main classification function
// ============================================================

export interface ClassifyContext {
  initiatives: Initiative[];
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
    context.initiatives,
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
