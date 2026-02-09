import { classifyMessage, ClassifyContext } from "./claude";
import {
  getSupabaseClient,
  getActiveInitiatives,
  getActiveEvents,
  getActivePrograms,
  getUnclassifiedMessages,
  createApproval,
  createInitiative,
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
  const [messages, initiatives, events, programs] = await Promise.all([
    getUnclassifiedMessages(),
    getActiveInitiatives(),
    getActiveEvents(),
    getActivePrograms(),
  ]);

  if (messages.length === 0) return stats;

  const context: ClassifyContext = { initiatives, events, programs };

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
  const [initiatives, events, programs] = await Promise.all([
    getActiveInitiatives(),
    getActiveEvents(),
    getActivePrograms(),
  ]);

  const context: ClassifyContext = { initiatives, events, programs };

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
    result.initiative_match.confidence >= AUTO_ASSIGN_THRESHOLD;
  const hasHighConfidenceExisting =
    isHighConfidence && !result.initiative_match.is_new && result.initiative_match.id;
  const hasHighConfidenceNew =
    isHighConfidence && result.initiative_match.is_new;
  const hasNewTrackSuggestions =
    result.programs_referenced.some((p) => p.is_new);

  // Review needed when: low confidence, OR new tracks suggested
  // NOT needed for high-confidence new initiatives — those auto-create
  let needsReview =
    !isNoise && (!isHighConfidence || hasNewTrackSuggestions);

  // Track which initiative ID gets assigned to messages
  let assignedInitiativeId: string | null = null;

  // Extract structured fields with fallbacks
  const currentState = result.current_state ?? null;
  const openItems = (result.open_items ?? []).map((item) => ({
    ...item,
    resolved: false,
  }));

  // 1. Auto-create new initiative at high confidence
  if (hasHighConfidenceNew && !hasNewTrackSuggestions) {
    try {
      const initiative = await createInitiative({
        name: result.initiative_match.name,
        partner_name: result.initiative_match.partner_name,
        summary: currentState,
        current_state: currentState,
        open_items: openItems,
      });
      assignedInitiativeId = initiative.id;

      // Find or create referenced tracks (programs)
      for (const prog of result.programs_referenced) {
        try {
          await findOrCreateProgram({ name: prog.name });
        } catch (err) {
          console.error(`Failed to find/create track "${prog.name}":`, err);
        }
      }

      console.log(
        `Auto-created initiative: ${initiative.name} (${initiative.id}) from ${messageIds.length} message(s)`
      );
    } catch (err) {
      // Auto-create failed — fall back to review
      console.error("Auto-create initiative failed, falling back to review:", err);
      needsReview = true;
    }
  }

  // 2. Auto-assign to existing initiative at high confidence
  if (hasHighConfidenceExisting && !hasNewTrackSuggestions) {
    assignedInitiativeId = result.initiative_match.id!;
  }

  // 3. Update messages with classification result
  const messageUpdate: Record<string, unknown> = {
    content_type: result.content_type,
    classification_confidence: result.initiative_match.confidence,
    classification_result: result,
    pending_review: needsReview,
  };

  if (assignedInitiativeId) {
    messageUpdate.initiative_id = assignedInitiativeId;
  }

  await db.from("messages").update(messageUpdate).in("id", messageIds);

  // 4. If assigned to existing initiative, update structured data
  if (hasHighConfidenceExisting && !hasNewTrackSuggestions && assignedInitiativeId) {
    const updates: Record<string, unknown> = {};

    if (currentState) {
      updates.summary = currentState;
      updates.current_state = currentState;
    }

    // Merge open items: add new, keep existing unresolved
    if (openItems.length > 0) {
      const merged = await appendOpenItems(assignedInitiativeId, openItems);
      if (merged) {
        updates.open_items = merged;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.from("initiatives").update(updates).eq("id", assignedInitiativeId);
    }
  }

  // 5. Create entity links where both source and target already exist
  if (!isNoise) {
    await createEntityLinks(result, context);
  }

  // 6. Upsert participants — link to assigned initiative if available
  if (!isNoise && result.participants.length > 0) {
    await upsertParticipants(result.participants, assignedInitiativeId);
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
          initiative_id: assignedInitiativeId,
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
      const initiatives = context.initiatives;
      const representative = messages[0];
      const { options } = await sendClassificationPrompt(
        representative,
        result,
        initiatives
      );

      await createApproval({
        type: "initiative_assignment",
        message_id: representative.id,
        classification_result: result,
        options_sent: options,
        sms_sent: true,
        sms_sent_at: new Date().toISOString(),
      });
    } catch (smsError) {
      console.error("Failed to send classification SMS:", smsError);
      await createApproval({
        type: "initiative_assignment",
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
      `confidence=${result.initiative_match.confidence}, ` +
      `review=${needsReview}, initiative=${result.initiative_match.name}`
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

  for (const init of context.initiatives) {
    entityMap.set(normalizeEntityName(init.name), {
      type: "initiative",
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

