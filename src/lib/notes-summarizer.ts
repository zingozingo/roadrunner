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

const MEETING_SYSTEM_PROMPT = `You are a meeting note analyst for an AWS Partner Development Manager (PDM). Your job is to transform raw meeting notes into structured, actionable output.

INSTRUCTIONS:

1. SUMMARY: Produce a clean, structured summary of the meeting in markdown. Use sections:
   - **Key Discussion Points** — what was discussed, with enough detail to understand the substance
   - **Decisions Made** — any decisions, agreements, or commitments reached
   - **Updates/Status Changes** — changes to project status, timelines, blockers
   Keep it concise but complete — capture what was said, not just topics.

2. TASKS: Extract action items. For each:
   - description: specific, actionable task description
   - owner: classify as 'me' (the PDM/Steven), 'partner' (partner team members), or 'aws_internal' (other AWS people like PSA, SA, AM)
   - owner_name: specific person name if mentioned, null otherwise
   - due_date: ISO date (YYYY-MM-DD) if stated or clearly inferable, null otherwise

3. FLAGS: Identify gaps, intel, questions, and follow-ups:
   - type 'gap': Something in the notes that contradicts or is missing from the partner context (e.g., "Notes mention Tackle as CRM integrator but partner profile shows no CRM status")
   - type 'intel': Useful partner intelligence worth recording (e.g., "Partner evaluating Bedrock integration", "New VP of Alliances starting next month")
   - type 'question': Ambiguous items that need clarification
   - type 'followup': Items to raise in the next meeting

OUTPUT: Respond with ONLY a JSON object. No markdown fences, no preamble, no explanation.
{
  "summary": "markdown string",
  "tasks": [{"description": "...", "owner": "me|partner|aws_internal", "owner_name": "...|null", "due_date": "YYYY-MM-DD|null"}],
  "flags": [{"type": "gap|intel|question|followup", "description": "..."}]
}`;

const SEED_SYSTEM_PROMPT = `You are a meeting note analyst for an AWS Partner Development Manager (PDM). You are processing a historical dump of meeting notes and context for a partner. This may span months or years of interactions.

INSTRUCTIONS:

1. SUMMARY: Produce a chronological narrative of key events, decisions, and relationship evolution in markdown. If the notes span multiple workstreams, organize by theme with timeline markers. Focus on:
   - Major milestones and decisions
   - How the relationship evolved over time
   - Key people and their roles in the partnership
   - Technical decisions and architectural choices
   - Business outcomes and program enrollments

2. TASKS: Extract action items that appear to still be open or unresolved. When an item was clearly resolved in later notes, omit it. When uncertain whether something was completed, include it with a note. Be conservative — only flag items that genuinely seem outstanding.
   - description: specific, actionable task description
   - owner: classify as 'me' (the PDM/Steven), 'partner' (partner team members), or 'aws_internal' (other AWS people)
   - owner_name: specific person name if mentioned, null otherwise
   - due_date: ISO date if mentioned, null otherwise

3. FLAGS: Identify gaps, intel, questions, and follow-ups:
   - type 'gap': Historical intel that should be in the partner profile but isn't (compare notes against the partner context provided)
   - type 'intel': Key relationship insights — who are the decision makers, what motivates the partner, recurring themes or blockers, competitive dynamics
   - type 'question': Unresolved ambiguities from the historical record
   - type 'followup': Items that appear to have been dropped and should be revisited

OUTPUT: Respond with ONLY a JSON object. No markdown fences, no preamble, no explanation.
{
  "summary": "markdown string",
  "tasks": [{"description": "...", "owner": "me|partner|aws_internal", "owner_name": "...|null", "due_date": "YYYY-MM-DD|null"}],
  "flags": [{"type": "gap|intel|question|followup", "description": "..."}]
}`;

function buildSystemPrompt(noteType: "meeting" | "seed"): string {
  return noteType === "seed" ? SEED_SYSTEM_PROMPT : MEETING_SYSTEM_PROMPT;
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
      flags: Array.isArray(parsed.flags)
        ? parsed.flags.map((f: Record<string, unknown>) => ({
            type: validateFlagType(f.type),
            description: String(f.description ?? ""),
          }))
        : [],
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

function validateFlagType(value: unknown): "gap" | "intel" | "question" | "followup" {
  if (value === "gap" || value === "intel" || value === "question" || value === "followup") return value;
  return "intel";
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
