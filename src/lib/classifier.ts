import { classifyMessage, ClassifyContext } from "./claude";
import {
  getSupabaseClient,
  getActiveInitiatives,
  getActiveEvents,
  getActivePrograms,
  getUnclassifiedMessages,
  createPendingReview,
} from "./supabase";
import { sendClassificationPrompt } from "./sms";
import { ClassificationResult, Message, Initiative, Event, Program } from "./types";

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
      await applyClassificationResult(group, result, context);
      stats.processed += group.length;

      const isNoise = result.content_type === "noise";
      const hasHighConfidenceMatch =
        !isNoise &&
        result.initiative_match.confidence >= AUTO_ASSIGN_THRESHOLD &&
        !result.initiative_match.is_new &&
        result.initiative_match.id;
      const hasNewEntitySuggestions =
        result.initiative_match.is_new ||
        result.events_referenced.some((e) => e.is_new) ||
        result.programs_referenced.some((p) => p.is_new);

      if (hasHighConfidenceMatch && !hasNewEntitySuggestions) {
        stats.autoAssigned += group.length;
      } else if (!isNoise) {
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
): Promise<void> {
  const db = getSupabaseClient();
  const messageIds = messages.map((m) => m.id);

  // Determine if this is an auto-assign or needs review
  const isNoise = result.content_type === "noise";
  const hasHighConfidenceMatch =
    !isNoise &&
    result.initiative_match.confidence >= AUTO_ASSIGN_THRESHOLD &&
    !result.initiative_match.is_new &&
    result.initiative_match.id;

  const hasNewEntitySuggestions =
    result.initiative_match.is_new ||
    result.events_referenced.some((e) => e.is_new) ||
    result.programs_referenced.some((p) => p.is_new);

  const needsReview =
    !isNoise && (!hasHighConfidenceMatch || hasNewEntitySuggestions);

  // 1. Update messages with classification result
  const messageUpdate: Record<string, unknown> = {
    content_type: result.content_type,
    classification_confidence: result.initiative_match.confidence,
    classification_result: result,
    pending_review: needsReview,
  };

  // Auto-assign to initiative if high confidence match to existing
  if (hasHighConfidenceMatch) {
    messageUpdate.initiative_id = result.initiative_match.id;
  }

  await db.from("messages").update(messageUpdate).in("id", messageIds);

  // 2. If auto-assigned, update initiative summary
  if (hasHighConfidenceMatch && result.summary_update) {
    await db
      .from("initiatives")
      .update({ summary: result.summary_update })
      .eq("id", result.initiative_match.id!);
  }

  // 3. Create entity links where both source and target already exist
  if (!isNoise) {
    await createEntityLinks(result, context);
  }

  // 4. Upsert participants
  if (!isNoise && result.participants.length > 0) {
    await upsertParticipants(result, messages, context);
  }

  // 5. If flagged for review, create pending review and send SMS
  if (needsReview) {
    try {
      const initiatives = context.initiatives;
      // Use the first message as the representative for the SMS
      const representative = messages[0];
      const { options } = await sendClassificationPrompt(
        representative,
        result,
        initiatives
      );

      await createPendingReview({
        message_id: representative.id,
        classification_result: result,
        options_sent: options,
        sms_sent: true,
        sms_sent_at: new Date().toISOString(),
      });
    } catch (smsError) {
      // SMS failure shouldn't block classification — create review without SMS
      console.error("Failed to send classification SMS:", smsError);
      await createPendingReview({
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

// ============================================================
// Upsert participants (insert new, update existing if better info)
// ============================================================

async function upsertParticipants(
  result: ClassificationResult,
  messages: Message[],
  context: ClassifyContext
): Promise<void> {
  const db = getSupabaseClient();

  for (const participant of result.participants) {
    if (!participant.email) continue;

    // Try to find existing participant by email
    const { data: existing } = await db
      .from("participants")
      .select("*")
      .eq("email", participant.email)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update if we have better info (name or org was null, now we have it)
      const updates: Record<string, string> = {};
      if (!existing[0].name && participant.name) {
        updates.name = participant.name;
      }
      if (!existing[0].organization && participant.organization) {
        updates.organization = participant.organization;
      }
      if (Object.keys(updates).length > 0) {
        await db
          .from("participants")
          .update(updates)
          .eq("id", existing[0].id);
      }

      // Link to initiative if we have a high-confidence match
      if (
        result.initiative_match.id &&
        !result.initiative_match.is_new &&
        result.initiative_match.confidence >= AUTO_ASSIGN_THRESHOLD
      ) {
        await ensureParticipantLink(
          db,
          existing[0].id,
          "initiative",
          result.initiative_match.id,
          participant.role
        );
      }
    } else {
      // Insert new participant
      const { data: inserted } = await db
        .from("participants")
        .insert({
          email: participant.email,
          name: participant.name,
          organization: participant.organization,
        })
        .select("id")
        .single();

      if (
        inserted &&
        result.initiative_match.id &&
        !result.initiative_match.is_new &&
        result.initiative_match.confidence >= AUTO_ASSIGN_THRESHOLD
      ) {
        await ensureParticipantLink(
          db,
          inserted.id,
          "initiative",
          result.initiative_match.id,
          participant.role
        );
      }
    }
  }
}

async function ensureParticipantLink(
  db: ReturnType<typeof getSupabaseClient>,
  participantId: string,
  entityType: string,
  entityId: string,
  role: string | null
): Promise<void> {
  const { data: existing } = await db
    .from("participant_links")
    .select("id")
    .eq("participant_id", participantId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .limit(1);

  if (!existing || existing.length === 0) {
    await db.from("participant_links").insert({
      participant_id: participantId,
      entity_type: entityType,
      entity_id: entityId,
      role,
    });
  }
}
