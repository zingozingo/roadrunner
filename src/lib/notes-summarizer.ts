import Anthropic from "@anthropic-ai/sdk";
import type { NoteSummaryResult } from "./types";

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
// Main summarization function
// ============================================================

export async function summarizeNotes(input: {
  rawNotes: string;
  partnerContext: string;
  noteType: "meeting" | "seed";
  meetingTitle?: string;
  meetingDate?: string;
}): Promise<NoteSummaryResult> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt(input.noteType);
  const userMessage = buildUserMessage(input);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content for note summarization");
  }

  return parseResponse(textBlock.text);
}

// ============================================================
// Prompt construction
// ============================================================

const NOTE_TYPE_MODIFIER = {
  meeting: "These are notes from a single meeting session. Summarize what was discussed in this meeting.",
  seed: "These notes span a longer period of historical context — possibly months or years of interactions. Summarize the key events and relationship arc chronologically. For tasks, only extract items that appear to still be open or unresolved; omit anything clearly completed in later notes.",
} as const;

const SYSTEM_PROMPT = `You are a note analyst for an AWS Partner Development Manager (PDM) named Steven. Your job is to produce a concise summary and extract every action item from raw notes.

The PARTNER CONTEXT section in the user message contains the partner's profile, known contacts, active engagements, recent meetings, previous note summaries, and open tasks. Use this context to enrich your output — but never add information that isn't present or directly implied in the notes.

<<NOTE_TYPE>>

SUMMARY RULES:
- Write concise prose. Use paragraph breaks to separate different topics or time periods.
- Use bullet points (plain dash) ONLY when listing 3+ specific items (e.g., multiple deliverables, multiple people mentioned). Otherwise use prose.
- Do NOT use markdown headers (##), bold markers (**), or section labels. Just clear sentences and paragraphs.
- When the notes reference something present in the partner context (marketplace listings, architecture, deployment status, pricing model, CRM integration, etc.), naturally weave that known context into the summary. For example: "discussed ramping marketplace presence (currently listed as AMI with Per-Seat/BYOL pricing)".
- Capture what was said, decided, or committed — not just topic labels.
- Keep it proportional — a 5-minute call summary should be 2-3 short paragraphs, not a page.
- Do NOT speculate about implications, strategic signals, or partner motivations.
- Do NOT add information not stated or directly implied in the notes.

TASK EXTRACTION RULES:
- Before creating each task, apply this test: Could someone check this off as DONE in a single action or short effort? If not, it's a goal — do not create a task.
- NOT a task (these are goals/directions — never create tasks for these):
  - "We want to help them target FSI accounts this year" (strategic goal — belongs in partner planning)
  - "They're pursuing competency certifications but haven't decided which ones" (status update, no action)
  - "Marketplace presence needs to improve" (aspiration, no specific next step)
  - "The partnership is progressing well" (general sentiment, not actionable)
- YES, a task (these have a clear done state — create tasks for these):
  - "I need to send them the Co-Sell training deck" (specific deliverable from me)
  - "They need to complete their partner migration portal before July 31" (partner action with explicit deadline — extract with due_date)
  - "Need to swap out Victoria for Jackie as preferred contact in Salesforce" (specific system update)
  - "Get SCA signature from Slade" (specific document action, named person)
  - "Chris confirmed they'll submit the architecture diagram by next week" (partner commitment with timeframe)
  - "I'm preparing the slide deck for the enablement call on Thursday" (specific deliverable for specific event)
- When the notes mention an explicit deadline or date for an action ("before July 31", "by next Friday", "due March 15"), ALWAYS extract it as a task with the due_date. A deadline implies a specific commitment — never treat it as just context.
- When in doubt, do NOT create the task. It is better to under-extract than to pollute the task list with vague goals. The user can always add tasks manually.
- For each task, identify the owner using this process:
  1. Check the KNOWN CONTACTS list in the partner context. If a name in the notes matches a known contact (e.g., "Jackie" matches "Jackie Funk" listed as Alliance Lead), set owner_name to their full name and owner to the appropriate category:
     - Partner-side contacts (Alliance Lead, partner team) → "partner"
     - AWS-side contacts (PSA, Account Manager, SA) → "aws_internal"
  2. If the PDM (Steven) is the owner ("I need to...", "my action is...", "I'll send..."), set owner to "me".
  3. If a name is mentioned but does NOT match any known contact, still capture the name in owner_name and classify owner as best you can from context.
  4. If no owner is identifiable, default owner to "me" with owner_name null.
- Set due_date (YYYY-MM-DD) only if explicitly stated in the notes. Do not infer dates.

OUTPUT: Respond with ONLY a JSON object. No markdown fences, no preamble, no explanation.
{
  "summary": "plain text string — no markdown headers",
  "tasks": [{"description": "...", "owner": "me|partner|aws_internal", "owner_name": "...|null", "due_date": "YYYY-MM-DD|null"}],
  "flags": []
}`;

function buildSystemPrompt(noteType: "meeting" | "seed"): string {
  return SYSTEM_PROMPT.replace("<<NOTE_TYPE>>", NOTE_TYPE_MODIFIER[noteType]);
}

function buildUserMessage(input: {
  rawNotes: string;
  partnerContext: string;
  noteType: "meeting" | "seed";
  meetingTitle?: string;
  meetingDate?: string;
}): string {
  const sections: string[] = [];

  // Partner context
  sections.push("=== PARTNER CONTEXT ===\n" + input.partnerContext);

  // Meeting metadata
  if (input.meetingTitle || input.meetingDate) {
    const meta: string[] = [];
    if (input.meetingTitle) meta.push(`Title: ${input.meetingTitle}`);
    if (input.meetingDate) meta.push(`Date: ${input.meetingDate}`);
    sections.push("=== MEETING INFO ===\n" + meta.join("\n"));
  }

  // Raw notes (with truncation if needed)
  const truncated = truncateIfNeeded(input.rawNotes);
  const label = input.noteType === "seed" ? "HISTORICAL NOTES" : "RAW MEETING NOTES";
  sections.push(`=== ${label} ===\n` + truncated);

  return sections.join("\n\n");
}

// ============================================================
// Response parsing
// ============================================================

function parseResponse(raw: string): NoteSummaryResult {
  const cleaned = raw.trim().replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : raw,
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map((t: Record<string, unknown>) => ({
            description: String(t.description ?? ""),
            owner: validateOwner(t.owner),
            owner_name: typeof t.owner_name === "string" ? t.owner_name : null,
            due_date: typeof t.due_date === "string" ? t.due_date : null,
          }))
        : [],
      flags: [],
    };
  } catch {
    // Graceful fallback — never lose the user's notes
    console.error("Failed to parse note summarization response as JSON, using raw text as summary");
    return {
      summary: raw,
      tasks: [],
      flags: [],
    };
  }
}

function validateOwner(value: unknown): "me" | "partner" | "aws_internal" {
  if (value === "me" || value === "partner" || value === "aws_internal") return value;
  return "me";
}

// ============================================================
// Token management
// ============================================================

const MAX_WORDS = 8000;

function truncateIfNeeded(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= MAX_WORDS) return text;

  const keepStart = Math.floor(MAX_WORDS * 0.6);
  const keepEnd = MAX_WORDS - keepStart;

  const start = words.slice(0, keepStart).join(" ");
  const end = words.slice(-keepEnd).join(" ");

  return start + "\n\n[... earlier notes truncated ...]\n\n" + end;
}
