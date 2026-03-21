import { classifyPhase2 } from "./claude";
import { buildPhase2Context } from "./phase2-prompt";
import {
  getSupabaseClient,
  getEngagementHistory,
  getPartner,
  upsertParticipants,
  backfillMessageSenderNames,
  getContactsByPartner,
  getPartnerScratchpad,
  getCondensedDigestsByEngagement,
} from "./db";
import {
  ClassificationResult,
  CombinedClassificationResult,
  Phase1Result,
  Message,
} from "./types";
import { buildNameResolutionMap } from "./name-resolver";

// ============================================================
// Phase 2 synthesis (called from inbox resolve after user routes)
// ============================================================

/**
 * Run Phase 2 synthesis for a routed engagement.
 * Core operation used by inbox assignment, new engagement creation,
 * and engagement merge.
 */
export async function synthesizeIntoEngagement(
  messages: Message[],
  phase1Result: Phase1Result,
  forwarderNote?: string | null
): Promise<CombinedClassificationResult> {
  const engagementId = phase1Result.engagement_match.id;
  const partnerId = phase1Result.engagement_match.partner_id;
  const isNew = phase1Result.engagement_match.is_new;

  const [history, matchedPartner, nameMap, partnerContacts, scratchpadEntries, condensedDigests] =
    await Promise.all([
      engagementId && !isNew
        ? getEngagementHistory(engagementId)
        : Promise.resolve(null),
      partnerId ? getPartner(partnerId) : Promise.resolve(null),
      buildNameResolutionMap(),
      partnerId ? getContactsByPartner(partnerId) : Promise.resolve([]),
      partnerId ? getPartnerScratchpad(partnerId) : Promise.resolve([]),
      engagementId && !isNew
        ? getCondensedDigestsByEngagement(engagementId)
        : Promise.resolve([]),
    ]);

  const phase2Context = buildPhase2Context({
    newMessages: messages,
    phase1Result,
    history: history ? {
      engagement: history.engagement,
      participants: history.participants,
    } : null,
    matchedPartner,
    forwarderNote,
    nameResolutionMap: nameMap,
    partnerContacts,
    scratchpadEntries,
    condensedMeetingDigests: condensedDigests,
  });

  return await classifyPhase2(phase2Context);
}

// ============================================================
// Synthetic Phase 1 result builder
// ============================================================

/**
 * Build a synthetic Phase1Result for the synthesis pipeline.
 * Used by the resolve route to construct the routing context
 * that synthesizeIntoEngagement expects.
 */
export function buildSyntheticPhase1Result(
  engagementId: string | null,
  partnerId: string,
  partnerName: string,
  isNew: boolean,
  suggestedName?: string
): Phase1Result {
  return {
    content_type: "engagement_email",
    engagement_match: {
      id: engagementId,
      name: suggestedName ?? "New Engagement",
      confidence: 1.0,
      is_new: isNew,
      partner_name: partnerName,
      partner_id: partnerId,
    },
  };
}

// ============================================================
// Group messages by forwarded_at (same batch = same forward)
// ============================================================

function groupByForwardedAt(messages: Message[]): Message[][] {
  if (messages.length === 0) return [];

  // Sort by forwarded_at
  const sorted = [...messages].sort(
    (a, b) =>
      new Date(a.forwarded_at).getTime() - new Date(b.forwarded_at).getTime()
  );

  const groups: Message[][] = [];
  let currentGroup: Message[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].forwarded_at).getTime();
    const currTime = new Date(sorted[i].forwarded_at).getTime();

    // Within 5 seconds = same forwarded email batch
    if (Math.abs(currTime - prevTime) <= 5000) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  groups.push(currentGroup);

  return groups;
}

// ============================================================
// Shared persistence function — single source of truth for
// both auto-assign (classifier) and manual resolve (route)
// ============================================================

/**
 * Persist classification results to the database.
 *
 * Operations:
 * 1. Update messages with classification data and engagement assignment
 * 2. Update engagement state (current_state, pillar, condensed, topic, name)
 * 3. Upsert participants and link to engagement
 * 4. Backfill message sender_names from participant registry
 *
 * Idempotent — safe to call multiple times with the same data.
 */
export async function persistClassificationResult(
  result: ClassificationResult,
  engagementId: string,
  messageIds: string[],
  isNewEngagement: boolean
): Promise<void> {
  const db = getSupabaseClient();

  // 1. Update messages with classification data and engagement assignment
  await db
    .from("messages")
    .update({
      engagement_id: engagementId,
      content_type: result.content_type,
      classification_confidence: result.engagement_match.confidence,
      classification_result: result,
      pending_review: false,
    })
    .in("id", messageIds);

  // 2. Update engagement state and structured fields
  {
    const combined = result as CombinedClassificationResult;
    const updates: Record<string, unknown> = {};

    // All fields write for both new and existing engagements
    if (combined.topic) updates.topic = combined.topic;
    if (combined.engagement_name) updates.name = combined.engagement_name;
    if (result.current_state) updates.current_state = result.current_state;
    if (combined.pillar) updates.pillar = combined.pillar;
    if (combined.condensed !== undefined && combined.condensed !== null) {
      updates.condensed = combined.condensed;
    }

    if (Object.keys(updates).length > 0) {
      await db.from("engagements").update(updates).eq("id", engagementId);
    }
  }

  // 3. Upsert participants and link to engagement
  if (result.participants.length > 0) {
    await upsertParticipants(result.participants, engagementId);
  }

  // 4. Backfill message sender_names with richer participant names
  const backfilled = await backfillMessageSenderNames(engagementId);
  if (backfilled > 0) {
    console.log(`[BACKFILL] Updated ${backfilled} message sender name(s) for engagement ${engagementId}`);
  }
}
