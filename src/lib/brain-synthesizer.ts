import Anthropic from "@anthropic-ai/sdk";
import { buildBrainContext } from "./notes-context";
import { getSupabaseClient } from "./db/client";

// ============================================================
// Anthropic client (same singleton pattern as notes-summarizer)
// ============================================================

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
// System prompt
// ============================================================

const BRAIN_SYSTEM_PROMPT = `You are an AI assistant helping an AWS Partner Development Manager (PDM) synthesize everything they know about a technology partner into a structured executive briefing.

Your Job

Produce a briefing that tells the PDM what the partner detail page CANNOT — relationship dynamics, tribal knowledge synthesis, activity patterns, what needs attention, and momentum assessment. The page already shows contacts, engagements, solution profile, and tasks. Do NOT rehash that visible data.

Output Structure

Produce these sections in order. Use the exact section headers shown. Omit a section if there is genuinely nothing to say for it.

## Relationship Overview

2-3 sentences on the overall relationship health. Who are the key people driving things? How engaged is the partner? Is the relationship deepening, plateauing, or cooling? Reference scratchpad tribal knowledge here — it's your most valuable input for relationship dynamics.

## Activity Patterns

Synthesize what the engagement and meeting data tells you as a PATTERN. Examples:

- "Partnership is heavily weighted toward Co-Build (4 of 6 engagements), with limited Co-Sell activity"
- "High meeting cadence (8 meetings in 30 days) suggests active execution phase"
- "Three engagements have gone stale — no activity in 2+ weeks"

Do NOT list engagements individually. The page already shows them. Synthesize the pattern.

## What Needs Attention

Flag items that need PDM action. Prioritize by urgency:

- Stale engagements (no recent activity)
- Overdue or at-risk tasks
- Relationship risks mentioned in scratchpad
- Missing data gaps (no pillar set, no condensed digest, unlinked meetings)
- Upcoming deadlines or events

If nothing needs attention, say so — that's a positive signal.

## Momentum Assessment

One sentence: is this partnership accelerating, steady, decelerating, or stalled? Ground it in evidence from the data above.

Rules

- Write in third person as a factual briefing. "The partnership is..." not "You should..."
- Reference specific people by first name, specific engagements by name when relevant to a pattern
- Scratchpad entries are PDM tribal knowledge — relationship observations, internal dynamics, strategic context. Weigh these heavily. They contain the insight that structured data misses.
- If standalone meeting digests are present, these represent cross-engagement relationship touchpoints (partner cadences, executive meetings). Weave their themes into the Relationship Overview.
- Importance weighting: things mentioned across multiple sources (scratchpad + meetings + engagements) matter more than one-time mentions. Recent activity carries more weight than old.
- If there is very little data (no meetings, no scratchpad, few engagements), be honest: "Early-stage relationship with limited context captured. Primary data sources are X engagements with Y total emails routed."
- Do NOT list every engagement, every task, or every contact. Synthesize patterns and flag exceptions.
- Do NOT repeat the partner's product description, AWS services, architecture, or stickiness analysis — the PDM sees those on the same page.`;

// ============================================================
// Synthesize partner brain
// ============================================================

export async function synthesizePartnerBrain(
  partnerId: string
): Promise<{ synthesis: string }> {
  const contextText = await buildBrainContext(partnerId);

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: BRAIN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          contextText +
          "\n\nSynthesize this into a structured executive briefing for the PDM.",
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(
      "Claude returned no text content for brain synthesis"
    );
  }

  return { synthesis: textBlock.text.trim() };
}

// ============================================================
// Save synthesis to partner_context
// ============================================================

export async function saveAndSynthesize(
  partnerId: string
): Promise<{ synthesis: string; id: string }> {
  const { synthesis } = await synthesizePartnerBrain(partnerId);

  const db = getSupabaseClient();

  // Replace existing ai_synthesis entries (don't accumulate)
  await db
    .from("partner_context")
    .delete()
    .eq("partner_id", partnerId)
    .eq("source", "ai_synthesis");

  // Insert new synthesis
  const { data, error } = await db
    .from("partner_context")
    .insert({
      partner_id: partnerId,
      content: synthesis,
      source: "ai_synthesis",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save brain synthesis: ${error.message}`);
  }

  return { synthesis, id: data.id as string };
}
