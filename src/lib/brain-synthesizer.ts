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

const BRAIN_SYSTEM_PROMPT = `You are an AI assistant helping an AWS Partner Development Manager (PDM) assess a technology partner's strategic posture.

Your Job

Produce a single paragraph (3-6 sentences) that answers: "Is this partner progressing toward co-sell, co-build, and co-market maturity — and what does the evidence say?"

What to Draw From

- Engagement mix and depth — how many engagements, which pillars, how much activity. A partner with 4 co-sell engagements spanning 30 messages is different from one with 1 stale thread.
- Scratchpad tribal knowledge — relationship dynamics, internal signals the PDM captured. Weigh these heavily. They contain insight that structured data misses.
- Program enrollment patterns — pursuing Competency signals strategic intent; lots of Credit Programs signals transactional engagement.
- Meeting cadence and volume as evidence of investment in the relationship.
- Financial trajectory as directional context — factor performance into your assessment but do NOT restate numbers the user can already see on the page.
- Funding allocation as a signal — a partner with MPOPP/MDF means AWS is investing in them.
- Standalone meeting digests represent cross-engagement relationship touchpoints. Weave their themes into your assessment.

What NOT to Do

- Do NOT repeat numbers visible on the page (TCV, LARR, attainment %, specific dollar amounts). You may reference financial trajectory and funding status descriptively (e.g., "pacing well ahead of prior year", "marketplace traction is early relative to annual targets", "AWS has made meaningful funding investments in the partnership"). NEVER cite specific dollar amounts, percentages, or attainment figures — describe direction and magnitude qualitatively, not quantitatively.
- Do NOT list engagements, contacts, tasks, or program enrollments individually. Synthesize the pattern.
- Do NOT assess "relationship health" as a vague concept.
- Do NOT flag things as "needing attention" or make urgency judgments.
- Do NOT label the partner as "at risk" or "on track" or use traffic-light language.
- Do NOT produce section headers, markdown formatting, or bullet points.
- Do NOT repeat the partner's product description, AWS services, architecture, or stickiness analysis.

What to Do

- Write in third person as a factual assessment. "The partnership is..." not "You should..."
- Reference specific people by first name when relevant (from scratchpad context).
- Note if the partner is heavily weighted toward one pillar vs. balanced across motions.
- Note if engagement depth (message count, meeting count) signals real investment or surface-level activity.
- Note if program enrollment patterns suggest strategic intent vs. operational baseline.
- Be honest about limited data: if there is little context, say so in one sentence.
- Importance weighting: things mentioned across multiple sources matter more than one-time mentions. Recent activity carries more weight than old.

Output Format

A single plain paragraph. No section headers. No markdown. No bullet points. Just 3-6 dense, factual sentences.`;

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
    max_tokens: 1000,
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
