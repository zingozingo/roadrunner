import {
  linkMeetingToEngagement,
  linkMessagesToEngagement,
} from "@/lib/db";
import {
  synthesizeIntoEngagement,
  persistClassificationResult,
  buildSyntheticPhase1Result,
} from "@/lib/classifier";
import type { Engagement, Message } from "@/lib/types";

// --- Types ---

interface ResolveParams {
  messages: Message[];
  engagement: Engagement;
  partnerId: string;
  partnerName: string;
  forwarderNote: string | null;
  isNew: boolean;
}

interface ResolveResult {
  engagement: Engagement;
}

// --- Main service function ---

/**
 * Shared orchestration for inbox resolution (both create_new and assign_existing).
 * Runs: AI synthesis -> persist classification -> link meetings -> push to Airtable.
 *
 * The caller is responsible for creating/fetching the engagement and validating inputs.
 * This function handles everything from "I have an engagement and messages" through
 * "engagement is fully synthesized and synced."
 */
export async function resolveInboxToEngagement(params: ResolveParams): Promise<ResolveResult> {
  const { messages, engagement, partnerId, partnerName, forwarderNote, isNew } = params;
  const messageIds = messages.map((m) => m.id);

  // Build synthetic Phase1 result for the classifier
  const phase1 = buildSyntheticPhase1Result(
    engagement.id,
    partnerId,
    partnerName,
    isNew,
    engagement.name
  );

  // Run AI synthesis (graceful degradation: if synthesis fails, we still link messages)
  let finalResult;
  try {
    finalResult = await synthesizeIntoEngagement(messages, phase1, forwarderNote);
  } catch (err) {
    console.error(`Synthesis failed for ${isNew ? "new" : "existing"} engagement, continuing with basic ${isNew ? "data" : "link"}:`, err);
    finalResult = null;
  }

  if (finalResult) {
    await persistClassificationResult(finalResult, engagement.id, messageIds, isNew);
  } else {
    // Minimal: just link messages to engagement
    await linkMessagesToEngagement(messageIds, engagement.id);
  }

  // Link any meetings associated with these messages
  for (const msgId of messageIds) {
    await linkMeetingToEngagement(msgId, engagement.id);
  }

  // Push to Airtable
  try {
    const { pushEngagementToAirtable } = await import("@/lib/sync");
    await pushEngagementToAirtable(engagement.id);
    console.log(`Airtable push: ${isNew ? "created" : "updated"} engagement ${engagement.id}`);
  } catch (err) {
    console.error(`Airtable push failed for ${engagement.id}:`, err);
  }

  return { engagement };
}
