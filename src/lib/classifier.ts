import { classifyMessage, ClassifyContext, ForwarderContext } from "./claude";
import {
  getSupabaseClient,
  getActiveEngagements,
  getActiveEvents,
  getActivePrograms,
  getUnclassifiedMessages,
  createApproval,
  createEngagement,
  createEntityLink,
  upsertParticipants,
  appendOpenItems,
} from "./supabase";
import { sendClassificationPrompt } from "./sms";
import { ClassificationResult, Message } from "./types";

const AUTO_ASSIGN_THRESHOLD = 0.85;

// ============================================================
// Orchestration: process all unclassified messages
// ============================================================

export async function processUnclassifiedMessages(): Promise<{
  processed: number;
  autoAssigned: number;
  flaggedForReview: number;
  errors: number;
}> {
  const stats = { processed: 0, autoAssigned: 0, flaggedForReview: 0, errors: 0 };

  // Load current state once for the batch
  const [messages, engagements, events, programs] = await Promise.all([
    getUnclassifiedMessages(),
    getActiveEngagements(),
    getActiveEvents(),
    getActivePrograms(),
  ]);

  if (messages.length === 0) return stats;

  const context: ClassifyContext = { engagements, events, programs };

  // Group messages by forwarded_at timestamp (within 5s = same forwarded email)
  const groups = groupByForwardedAt(messages);

  for (const group of groups) {
    try {
      const result = await classifyMessage(group, context);
      const { needsReview } = await applyClassificationResult(group, result, context);
      stats.processed += group.length;

      const isNoise = result.content_type === "noise";
      if (!isNoise && !needsReview) {
        stats.autoAssigned += group.length;
      } else if (needsReview) {
        stats.flaggedForReview += group.length;
      }
    } catch (error) {
      console.error(
        `Classification error for message group [${group.map((m) => m.id).join(", ")}]:`,
        error
      );
      stats.errors += group.length;
    }
  }

  return stats;
}

// ============================================================
// Process a single message (called after inbound webhook)
// ============================================================

export async function processSingleMessage(
  messageIds: string[],
  forwarderContext?: ForwarderContext
): Promise<ClassificationResult | null> {
  if (messageIds.length === 0) return null;

  const db = getSupabaseClient();

  // Fetch the messages
  const { data: messages, error } = await db
    .from("messages")
    .select("*")
    .in("id", messageIds);

  if (error || !messages || messages.length === 0) {
    console.error("Failed to fetch messages for classification:", error);
    return null;
  }

  // Load current state
  const [engagements, events, programs] = await Promise.all([
    getActiveEngagements(),
    getActiveEvents(),
    getActivePrograms(),
  ]);

  const context: ClassifyContext = { engagements, events, programs };

  try {
    const result = await classifyMessage(messages as Message[], context, forwarderContext);
    await applyClassificationResult(messages as Message[], result, context);
    return result;
  } catch (error) {
    console.error("Classification error:", error);
    return null;
  }
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
 * Called from both the auto-assign path and the manual resolve path.
 *
 * Operations:
 * 1. Update messages with classification data and engagement assignment
 * 2. Update engagement state (current_state, open_items, tags) — skip for new engagements (already set at creation)
 * 3. Create entity links (engagement↔event, engagement↔program) by ID
 * 4. Upsert participants and link to engagement
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

  // 2. Update engagement state — skip for new engagements (fields set at creation)
  if (!isNewEngagement) {
    const currentState = result.current_state ?? null;
    const openItems = (result.open_items ?? []).map((item) => ({
      ...item,
      resolved: false,
    }));

    const updates: Record<string, unknown> = {};

    if (currentState) {
      updates.summary = currentState;
      updates.current_state = currentState;
    }

    if (openItems.length > 0) {
      // Only call appendOpenItems when there are actual items to merge
      const merged = await appendOpenItems(engagementId, openItems);
      if (merged) {
        updates.open_items = merged;
      }
    }
    // If open_items is empty, skip — nothing to append

    // Merge suggested tags (deduplicated)
    if (result.suggested_tags && result.suggested_tags.length > 0) {
      const { data: existing } = await db
        .from("engagements")
        .select("tags")
        .eq("id", engagementId)
        .maybeSingle();

      const existingTags: string[] = (existing?.tags as string[]) ?? [];
      const existingSet = new Set(existingTags.map((t) => t.toLowerCase()));
      const newTags = result.suggested_tags.filter(
        (t) => !existingSet.has(t.toLowerCase())
      );
      if (newTags.length > 0) {
        updates.tags = [...existingTags, ...newTags];
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.from("engagements").update(updates).eq("id", engagementId);
    }
  }

  // 3. Create entity links by ID (engagement↔event, engagement↔program)
  for (const event of result.matched_events) {
    try {
      await createEntityLink({
        source_type: "engagement",
        source_id: engagementId,
        target_type: "event",
        target_id: event.id,
        relationship: event.relationship,
        context: event.name,
      });
    } catch (err) {
      console.error(`Failed to link engagement to event "${event.name}":`, err);
    }
  }

  for (const program of result.matched_programs) {
    try {
      await createEntityLink({
        source_type: "engagement",
        source_id: engagementId,
        target_type: "program",
        target_id: program.id,
        relationship: program.relationship,
        context: program.name,
      });
    } catch (err) {
      console.error(`Failed to link engagement to program "${program.name}":`, err);
    }
  }

  // 4. Upsert participants and link to engagement
  if (result.participants.length > 0) {
    await upsertParticipants(result.participants, engagementId);
  }
}

// ============================================================
// Apply classification results to the database
// ============================================================

async function applyClassificationResult(
  messages: Message[],
  result: ClassificationResult,
  context: ClassifyContext
): Promise<{ needsReview: boolean }> {
  const db = getSupabaseClient();
  const messageIds = messages.map((m) => m.id);

  // Determine routing
  const isNoise = result.content_type === "noise";
  const isHighConfidence =
    !isNoise &&
    result.engagement_match.confidence >= AUTO_ASSIGN_THRESHOLD;
  const hasHighConfidenceExisting =
    isHighConfidence && !result.engagement_match.is_new && result.engagement_match.id;
  const hasHighConfidenceNew =
    isHighConfidence && result.engagement_match.is_new;

  let needsReview = !isNoise && !isHighConfidence;

  // Track which engagement ID gets assigned to messages
  let assignedEngagementId: string | null = null;

  // 1. Auto-create new engagement at high confidence
  if (hasHighConfidenceNew) {
    try {
      const currentState = result.current_state ?? null;
      const openItems = (result.open_items ?? []).map((item) => ({
        ...item,
        resolved: false,
      }));

      const engagement = await createEngagement({
        name: result.engagement_match.name,
        partner_name: result.engagement_match.partner_name,
        summary: currentState,
        current_state: currentState,
        open_items: openItems,
        tags: result.suggested_tags ?? [],
      });
      assignedEngagementId = engagement.id;

      console.log(
        `Auto-created engagement: ${engagement.name} (${engagement.id}) from ${messageIds.length} message(s)`
      );
    } catch (err) {
      console.error("Auto-create engagement failed, falling back to review:", err);
      needsReview = true;
    }
  }

  // 2. Auto-assign to existing engagement at high confidence
  if (hasHighConfidenceExisting) {
    assignedEngagementId = result.engagement_match.id!;
  }

  // 3. Persist classification data
  if (assignedEngagementId && !needsReview) {
    await persistClassificationResult(
      result,
      assignedEngagementId,
      messageIds,
      !!hasHighConfidenceNew
    );
  } else {
    // Not assigned — still update messages with classification data
    const messageUpdate: Record<string, unknown> = {
      content_type: result.content_type,
      classification_confidence: result.engagement_match.confidence,
      classification_result: result,
      pending_review: needsReview,
    };

    await db.from("messages").update(messageUpdate).in("id", messageIds);
  }

  // 4. If flagged for review, create pending review and send SMS
  if (needsReview) {
    try {
      const engagements = context.engagements;
      const representative = messages[0];
      const { options } = await sendClassificationPrompt(
        representative,
        result,
        engagements
      );

      await createApproval({
        type: "engagement_assignment",
        message_id: representative.id,
        classification_result: result,
        options_sent: options,
        sms_sent: true,
        sms_sent_at: new Date().toISOString(),
      });
    } catch (smsError) {
      console.error("Failed to send classification SMS:", smsError);
      await createApproval({
        type: "engagement_assignment",
        message_id: messages[0].id,
        classification_result: result,
        options_sent: [],
        sms_sent: false,
        sms_sent_at: null,
      });
    }
  }

  console.log(
    `Classified ${messageIds.length} message(s): type=${result.content_type}, ` +
      `confidence=${result.engagement_match.confidence}, ` +
      `review=${needsReview}, engagement=${result.engagement_match.name}`
  );

  return { needsReview };
}
