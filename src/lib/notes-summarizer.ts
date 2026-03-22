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
- The key question for every potential task: "Does this describe something that STILL NEEDS TO HAPPEN?" If yes → extract it. If it describes something that already happened → do not extract.
- Bias: When in doubt, DO extract. Missing a real task is worse than including a borderline one. The user will remove false positives — they cannot recover tasks you silently dropped.
- FORWARD-POINTING = extract as task. These describe future obligations:
  - First person: "I need to", "I have to", "I should", "I'll", "Let me", "I'm going to", "I want to [specific action]"
  - Second/third person: "They need to", "He/she needs to", "Partner needs to", "We need to"
  - Imperative: "Get X", "Send X", "Follow up on", "Schedule", "Set up", "Check with", "Coordinate", "Prepare", "Submit", "Complete", "Review"
  - Commitments: "X confirmed they'll do Y", "X promised to", "X will send", "X is going to"
  - Compound sentences: When a sentence mixes past and future ("CJ nominated them for X, Slade wanted to check in for an update"), extract only the forward-pointing part ("Check in on X update").
- BACKWARD-POINTING = do NOT extract. These describe things that already happened:
  - "CJ nominated KnowBe4 for Security Hub" — observation of past event
  - "The partnership is progressing well" — sentiment
  - "We discussed potential expansion into EMEA" — recap of discussion
  - "They achieved ISVa approval last month" — completed event
  - "We want to help them target FSI accounts this year" — strategic aspiration with no concrete next step
- YES, extract these (real examples):
  - "I need to get Slade's availability for SCA kickoff call" → task, owner: me
  - "i need to fix mpopp issue with ChuQi and Brian" → task, owner: me
  - "update alliance lead – knowbe4 needs to do this" → task, owner: partner
  - "They will send us the architecture diagram next week" → task, owner: partner
  - "Need to follow up with Stefan on MDF numbers" → task, owner: me
  - "Get the Co-Sell deck to Jackie before Friday" → task, owner: me, with due_date
  - "Need to swap out Victoria for Jackie as preferred contact in Salesforce" → task, owner: me
  - "Chris confirmed they'll submit the architecture diagram by next week" → task, owner: partner
- When the notes mention an explicit deadline or date for an action ("before July 31", "by next Friday", "due March 15"), ALWAYS extract it as a task with the due_date. A deadline implies a specific commitment — never treat it as just context.
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
