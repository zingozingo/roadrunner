import Anthropic from "@anthropic-ai/sdk";
import {
  CombinedClassificationResult,
  Phase1Result,
  Message,
} from "./types";
import { PHASE1_SYSTEM_PROMPT, parsePhase1Response } from "./phase1-prompt";
import { PHASE2_SYSTEM_PROMPT, parsePhase2Response } from "./phase2-prompt";

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
// Phase 1 classification — lightweight routing
// ============================================================

export async function classifyPhase1(
  messages: Message[],
  phase1Context: string
): Promise<Phase1Result> {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: PHASE1_SYSTEM_PROMPT,
    messages: [{ role: "user", content: phase1Context }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return parsePhase1Response(textBlock.text);
}

// ============================================================
// Phase 2 classification — deep analysis with full history
// ============================================================

export async function classifyPhase2(
  phase2Context: string
): Promise<CombinedClassificationResult> {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: PHASE2_SYSTEM_PROMPT,
    messages: [{ role: "user", content: phase2Context }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return parsePhase2Response(textBlock.text);
}
