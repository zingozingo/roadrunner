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
5. **Forwarder.** The PDM who forwarded this email is identified in the "Forwarding Context" section. ALWAYS include them as a participant with role "forwarder". Do NOT try to identify the forwarder from the email body or greeting — use ONLY the forwarding context provided.
6. **Participants.** Extract all other people from the email headers (From, To, CC) and body. Each person should appear EXACTLY ONCE in the participants array — merge information from headers and body into a single entry. If someone appears in the From header AND signs the email with a title, combine into one entry. Set email to null only if truly unavailable. The forwarder should not be duplicated — if they also appear in From/To/CC, include them once with role "forwarder".
7. **Temporal honesty.** Only include dates that are explicitly confirmed: scheduled dates, named conference dates, explicit deadlines ("POC due March 15"). Vague intentions ("let's connect next week") go in current_state prose only, never as due_dates.
8. **Tags.** Suggest short, lowercase labels that help categorize this engagement. Examples: "co-sell", "finserv", "poc", "migration", "marketplace", "security-review". Only suggest tags that are genuinely descriptive. Empty array is fine.

## Confidence Calibration

- 0.95–1.0: Email explicitly names the engagement or is a direct thread continuation
- 0.85–0.94: Same partner + topic, clear contextual match
- 0.70–0.84: Related partner or topic, but no direct engagement reference
- Below 0.70: Tangential or ambiguous
- Noise: always 1.0 confidence, is_new: false

## current_state Instructions

You are given the engagement's existing current_state in the context (under "Current state:" for each engagement). Your job is to EVOLVE it, not replace it.

**If this email matches an EXISTING engagement:**
- Read the existing current_state carefully
- If the email contains material new information (new decisions, scope changes, new participants joining, status updates, blockers identified), update the relevant parts of the current_state while preserving the rest
- If the email is routine (scheduling logistics, acknowledgments, brief follow-ups), return the existing current_state with minimal or no changes
- Never drop important context just because a new email arrived — the state should accumulate knowledge, not reset it
- Keep it 3-5 sentences, executive briefing style

**If this is a NEW engagement (is_new: true):**
- Write a fresh 3-5 sentence briefing based on the email content

**Style rules (always apply):**
- Write concretely: "Brian and Tanya are coordinating an integration discussion with the security team" not "Teams are actively facilitating comprehensive collaboration"
- Use first names only — full participant details are in the participants field
- No fabricated dates or timelines
- No bullet points or markdown formatting
- No vague filler phrases ("various stakeholders", "ongoing discussions", "comprehensive approach")

Return null if noise.

## open_items Instructions

Extract ONLY concrete, actionable tasks explicitly stated or clearly implied in the email. An open item must have a specific action someone can take.

**What IS an open item:**
- "Can you send over the architecture diagram by Friday?" → { description: "Send architecture diagram", assignee: "Steven", due_date: "2026-02-14" }
- "We need to complete the security review" → { description: "Complete security review", assignee: null, due_date: null }
- "Monty will set up the integration environment" → { description: "Set up integration environment", assignee: "Monty", due_date: null }
- "The team needs to submit the PRM data by end of month" → { description: "Submit PRM data", assignee: "Contrast Security team", due_date: "2026-02-28" }

**What is NOT an open item:**
- "Let's circle back on this" — vague intention, not a task
- "Looking forward to working together" — pleasantry
- "We should probably think about timeline" — no specific action
- "Great progress so far" — status commentary
- "I'll loop in my team" — too vague unless a specific person/action is named

**Assignee rules:**
- One person: "Steven"
- Multiple people: "Steven and CJ"
- A team or company: "Contrast Security team" or "AWS team"
- The PDM/forwarder: "Steven" (use their name)
- Unknown who: null

**Due date rules:**
- ONLY if explicitly stated: "by Friday", "due March 15", "end of month", "before re:Invent"
- Convert relative dates to ISO format using the email's date as reference
- If no deadline is mentioned or implied, due_date is null
- NEVER fabricate a deadline from vague language like "soon" or "ASAP"

If the email contains no actionable tasks, return an empty array. An empty array is better than fabricated items.

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
      "description": "specific actionable task — not vague intentions",
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

export interface ForwarderContext {
  name: string;
  email: string;
}

function buildUserMessage(
  messages: Message[],
  engagements: Engagement[],
  events: Event[],
  programs: Program[],
  forwarderContext?: ForwarderContext
): string {
  const parts: string[] = [];

  // Forwarding context — tells Claude who the PDM/forwarder is
  if (forwarderContext) {
    parts.push("## Forwarding Context\n");
    parts.push(
      "This email was forwarded to Relay by the PDM (Partner Development Manager):"
    );
    parts.push(
      `**Forwarder:** ${forwarderContext.name} <${forwarderContext.email}>`
    );
    parts.push(
      'The forwarder is ALWAYS a participant with role "forwarder". Do NOT extract them from the email body — they are provided here.\n'
    );
  }

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
  context: ClassifyContext,
  forwarderContext?: ForwarderContext
): Promise<ClassificationResult> {
  const client = getClient();

  const userMessage = buildUserMessage(
    messages,
    context.engagements,
    context.events,
    context.programs,
    forwarderContext
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
