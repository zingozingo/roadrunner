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
  noteType?: "meeting";
  meetingTitle?: string;
  meetingDate?: string;
  existingTasks?: { description: string; owner: string; owner_name: string | null }[];
}): Promise<NoteSummaryResult> {
  const client = getClient();
  const systemPrompt = buildSystemPrompt(input.noteType ?? "meeting");
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
} as const;

const SYSTEM_PROMPT = `You are a note analyst for an AWS Partner Development Manager (PDM) named Steven. Your job is to produce a structured summary, a condensed digest, and extract every action item from raw notes.

The PARTNER CONTEXT section in the user message contains a condensed partner profile, known contacts, PDM scratchpad notes, and previous meeting digests scoped to the relevant engagement (or recent partner meetings if standalone). Use this context to enrich your output — but never add information that isn't present or directly implied in the notes.

<<NOTE_TYPE>>

SUMMARY RULES:
- Produce a STRUCTURED summary with these sections, using plain text labels on their own line (not markdown headers):

  Discussion
  [What was discussed. Prose paragraphs. Capture substance — what was said, explained, proposed — not just topic labels.]

  Decisions
  [Commitments, agreements, or conclusions reached. If none, write "No decisions reached." Don't fabricate.]

  Key Context
  [Important background info, signals, or relationship dynamics mentioned. Things that matter for understanding this engagement but aren't decisions or action items. If nothing notable, omit this section entirely.]

- Importance weighting: Topics and people mentioned repeatedly should be featured more prominently than one-time mentions. Recent context matters more than old. Respect the user's emphasis — "critical", "urgent", "important" are intentional signals.
- Proportionality: A 5-minute call gets 2-3 short paragraphs total. A 60-minute deep dive can be longer. Match the depth.
- When the notes reference something present in the partner context (marketplace listings, architecture, deployment status, pricing model, CRM integration, etc.), naturally weave that known context into the summary.
- Do NOT speculate about implications, strategic signals, or partner motivations.
- Do NOT add information not stated or directly implied in the notes.
- Tasks are extracted separately below. The Discussion and Key Context sections should reference decisions and context, but should NOT re-list action items that appear in the tasks array. If a task was discussed, mention the context around it, not the task itself.

CONDENSED DIGEST RULES:
- Produce a condensed digest: 3-5 bullet points using category tags.
- Format (each bullet on its own line, starting with the tag):
  - Discussed: [key topic and what was said about it]
  - Decided: [commitment or agreement reached]
  - Context: [important background info or signal]
  - Next: [what happens next or what to watch for]
  - Blocker: [if any — omit if none]
- This is NOT a copy of tasks. "Next" means the expected next development, not an assigned action item.
- 3-5 bullets max. No prose. Every bullet starts with a category tag.

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
     - AWS-side contacts (PSA, Account Manager, SA) → "internal"
  2. If the PDM (Steven) is the owner ("I need to...", "my action is...", "I'll send..."), set owner to "me".
  3. If a name is mentioned but does NOT match any known contact, still capture the name in owner_name and classify owner as best you can from context.
  4. If no owner is identifiable, default owner to "me" with owner_name null.
- Set due_date (YYYY-MM-DD) only if explicitly stated in the notes. Do not infer dates.
- If EXISTING TASKS are listed in the user message, do NOT re-extract those same tasks. Only extract NEW tasks from the notes.

OUTPUT: Respond with ONLY a JSON object. No markdown fences, no preamble, no explanation.
{
  "summary": "structured text with Discussion/Decisions/Key Context sections",
  "condensed": "3-5 categorized bullet lines",
  "tasks": [{"description": "...", "owner": "me|partner|internal|third_party", "owner_name": "...|null", "due_date": "YYYY-MM-DD|null"}]
}`;

function buildSystemPrompt(noteType: "meeting"): string {
  return SYSTEM_PROMPT.replace("<<NOTE_TYPE>>", NOTE_TYPE_MODIFIER[noteType]);
}

function buildUserMessage(input: {
  rawNotes: string;
  partnerContext: string;
  noteType?: "meeting";
  meetingTitle?: string;
  meetingDate?: string;
  existingTasks?: { description: string; owner: string; owner_name: string | null }[];
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

  // Existing tasks (so AI knows what not to re-extract)
  if (input.existingTasks && input.existingTasks.length > 0) {
    const taskLines = input.existingTasks.map((t) => {
      const owner = t.owner_name ? `${t.owner_name} (${t.owner})` : t.owner;
      return `- [${owner}] ${t.description}`;
    });
    sections.push("=== EXISTING TASKS FOR THIS MEETING ===\n" + taskLines.join("\n"));
  }

  // Raw notes (with truncation if needed)
  const truncated = truncateIfNeeded(input.rawNotes);
  sections.push("=== RAW MEETING NOTES ===\n" + truncated);

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
      condensed: typeof parsed.condensed === "string" ? parsed.condensed : null,
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map((t: Record<string, unknown>) => ({
            description: String(t.description ?? ""),
            owner: validateOwner(t.owner),
            owner_name: typeof t.owner_name === "string" ? t.owner_name : null,
            due_date: typeof t.due_date === "string" ? t.due_date : null,
          }))
        : [],
    };
  } catch {
    // Graceful fallback — never lose the user's notes
    console.error("Failed to parse note summarization response as JSON, using raw text as summary");
    return {
      summary: raw,
      condensed: null,
      tasks: [],
    };
  }
}

function validateOwner(value: unknown): "me" | "internal" | "partner" | "third_party" {
  if (value === "me" || value === "internal" || value === "partner" || value === "third_party") return value;
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
