import Anthropic from "@anthropic-ai/sdk";
import { buildPartnerContext, formatContextForPrompt } from "./notes-context";
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

const BRAIN_SYSTEM_PROMPT = `You are an AI assistant helping an AWS Partner Development Manager (PDM) synthesize everything they know about a technology partner into a concise briefing.

Produce a "60-second briefing" — a short 2-4 sentence paragraph that captures:

- Relationship narrative: where things stand overall, what's active, what's the trajectory
- Key people dynamics: who's the main contact, any important relationship notes from the scratchpad
- Current priorities: what the PDM should focus on next based on open tasks and active engagements
- Risks or blockers: anything stalled, overdue, or needing attention

Rules:

- Do NOT repeat the partner's product description, AWS services, or architecture — the PDM can see those on the same page
- Focus on the RELATIONSHIP and WORK STATUS, not the product
- Write in direct, concise prose. No bullet points. No headers. No markdown.
- Reference specific people by name, specific engagements by name, specific tasks if relevant
- If there's very little data (no meetings, no scratchpad), say so honestly — "Early-stage relationship, limited context captured so far."
- Address the PDM as "you" where natural`;

// ============================================================
// Synthesize partner brain
// ============================================================

export async function synthesizePartnerBrain(
  partnerId: string
): Promise<{ synthesis: string }> {
  const context = await buildPartnerContext(partnerId);
  const contextText = formatContextForPrompt(context);

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: BRAIN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          contextText +
          "\n\nSynthesize this into a 60-second briefing for the PDM.",
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
