import { classifyMessage, ClassifyContext } from "./claude";
import {
  getSupabaseClient,
  getActiveEngagements,
  getActiveEvents,
  getActivePrograms,
  getUnclassifiedMessages,
  createApproval,
  createEngagement,
  findOrCreateProgram,
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
  messageIds: string[]
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
    const result = await classifyMessage(messages as Message[], context);
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
  const hasNewTrackSuggestions =
    result.programs_referenced.some((p) => p.is_new);

  // Review needed when: low confidence, OR new tracks suggested
  // NOT needed for high-confidence new engagements — those auto-create
  let needsReview =
    !isNoise && (!isHighConfidence || hasNewTrackSuggestions);

  // Track which engagement ID gets assigned to messages
  let assignedEngagementId: string | null = null;

  // Extract structured fields with fallbacks
  const currentState = result.current_state ?? null;
  const openItems = (result.open_items ?? []).map((item) => ({
    ...item,
    resolved: false,
  }));

  // 1. Auto-create new engagement at high confidence
  if (hasHighConfidenceNew && !hasNewTrackSuggestions) {
    try {
      const engagement = await createEngagement({
        name: result.engagement_match.name,
        partner_name: result.engagement_match.partner_name,
        summary: currentState,
        current_state: currentState,
        open_items: openItems,
      });
      assignedEngagementId = engagement.id;

      // Find or create referenced tracks (programs)
      for (const prog of result.programs_referenced) {
        try {
          await findOrCreateProgram({ name: prog.name });
        } catch (err) {
          console.error(`Failed to find/create track "${prog.name}":`, err);
        }
      }

      console.log(
        `Auto-created engagement: ${engagement.name} (${engagement.id}) from ${messageIds.length} message(s)`
      );
    } catch (err) {
      // Auto-create failed — fall back to review
      console.error("Auto-create engagement failed, falling back to review:", err);
      needsReview = true;
    }
  }

  // 2. Auto-assign to existing engagement at high confidence
  if (hasHighConfidenceExisting && !hasNewTrackSuggestions) {
    assignedEngagementId = result.engagement_match.id!;
  }

  // 3. Update messages with classification result
  const messageUpdate: Record<string, unknown> = {
    content_type: result.content_type,
    classification_confidence: result.engagement_match.confidence,
    classification_result: result,
    pending_review: needsReview,
  };

  if (assignedEngagementId) {
    messageUpdate.engagement_id = assignedEngagementId;
  }

  await db.from("messages").update(messageUpdate).in("id", messageIds);

  // 4. If assigned to existing engagement, update structured data
  if (hasHighConfidenceExisting && !hasNewTrackSuggestions && assignedEngagementId) {
    const updates: Record<string, unknown> = {};

    if (currentState) {
      updates.summary = currentState;
      updates.current_state = currentState;
    }

    // Merge open items: add new, keep existing unresolved
    if (openItems.length > 0) {
      const merged = await appendOpenItems(assignedEngagementId, openItems);
      if (merged) {
        updates.open_items = merged;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.from("engagements").update(updates).eq("id", assignedEngagementId);
    }
  }

  // 5. Create entity links where both source and target already exist
  if (!isNoise) {
    await createEntityLinks(result, context);
  }

  // 6. Upsert participants — link to assigned engagement if available
  if (!isNoise && result.participants.length > 0) {
    await upsertParticipants(result.participants, assignedEngagementId);
  }

  // 6b. Store pending event approvals for new events
  if (!isNoise) {
    for (const eventRef of result.events_referenced) {
      if (!eventRef.is_new) continue;
      try {
        await createApproval({
          type: "event_creation",
          entity_data: {
            name: eventRef.name,
            type: eventRef.type,
            date: eventRef.date,
            date_precision: eventRef.date_precision,
            confidence: eventRef.confidence,
          },
          message_id: messages[0].id,
          engagement_id: assignedEngagementId,
        });
        console.log(`Pending event approval created: "${eventRef.name}"`);
      } catch (err) {
        console.error(`Failed to create pending event approval for "${eventRef.name}":`, err);
      }
    }
  }

  // 7. If flagged for review, create pending review and send SMS
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

// ============================================================
// Create entity links (only between existing entities)
// ============================================================

async function createEntityLinks(
  result: ClassificationResult,
  context: ClassifyContext
): Promise<void> {
  if (result.entity_links.length === 0) return;
  const db = getSupabaseClient();

  // Build a name->id lookup for all known entities
  const entityMap = new Map<string, { type: string; id: string }>();

  for (const init of context.engagements) {
    entityMap.set(normalizeEntityName(init.name), {
      type: "engagement",
      id: init.id,
    });
  }
  for (const evt of context.events) {
    entityMap.set(normalizeEntityName(evt.name), {
      type: "event",
      id: evt.id,
    });
  }
  for (const prog of context.programs) {
    entityMap.set(normalizeEntityName(prog.name), {
      type: "program",
      id: prog.id,
    });
  }

  const linksToInsert: {
    source_type: string;
    source_id: string;
    target_type: string;
    target_id: string;
    relationship: string;
    context: string;
    created_by: string;
  }[] = [];

  for (const link of result.entity_links) {
    const source = entityMap.get(normalizeEntityName(link.source_name));
    const target = entityMap.get(normalizeEntityName(link.target_name));

    // Only create links between entities that already exist
    if (!source || !target) continue;
    // Don't link an entity to itself
    if (source.id === target.id) continue;

    linksToInsert.push({
      source_type: link.source_type,
      source_id: source.id,
      target_type: link.target_type,
      target_id: target.id,
      relationship: link.relationship,
      context: link.context,
      created_by: "ai",
    });
  }

  if (linksToInsert.length === 0) return;

  // Idempotency: check for existing links to avoid duplicates
  for (const link of linksToInsert) {
    const { data: existing } = await db
      .from("entity_links")
      .select("id")
      .eq("source_type", link.source_type)
      .eq("source_id", link.source_id)
      .eq("target_type", link.target_type)
      .eq("target_id", link.target_id)
      .eq("relationship", link.relationship)
      .limit(1);

    if (!existing || existing.length === 0) {
      await db.from("entity_links").insert(link);
    }
  }
}

function normalizeEntityName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

