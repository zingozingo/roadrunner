import { classifyPhase1, classifyPhase2 } from "./claude";
import { buildPhase1Context } from "./phase1-prompt";
import { buildPhase2Context } from "./phase2-prompt";
import {
  getSupabaseClient,
  getActiveEvents,
  getActivePrograms,
  getRelationships,
  getUnclassifiedMessages,
  getEngagementHistory,
  getPartner,
  createApproval,
  createEngagement,
  createEntityLink,
  upsertParticipants,
  backfillMessageSenderNames,
  linkMeetingToEngagement,
  linkEngagementRelationship,
  getEntityLinksForEntity,
  getRelationshipsByEngagement,
} from "./db";
import {
  ClassificationResult,
  CombinedClassificationResult,
  Meeting,
  Phase1Result,
  Message,
} from "./types";
import { buildNameResolutionMap } from "./name-resolver";
import type { NameResolutionMap } from "./name-resolver";

const AUTO_ASSIGN_THRESHOLD = 0.85;

// ============================================================
// Two-phase classification pipeline
// ============================================================

/**
 * Run Phase 1 (match) → Phase 2 (analyze) on a group of messages.
 * Returns a CombinedClassificationResult suitable for persistence.
 */
async function classifyTwoPhase(
  messages: Message[],
  forwarderNote?: string | null,
  nameResolutionMap?: NameResolutionMap | null
): Promise<CombinedClassificationResult> {
  // ── Phase 1: Match ──────────────────────────────────────────
  const phase1Context = await buildPhase1Context(messages, forwarderNote);
  const phase1Result = await classifyPhase1(messages, phase1Context);

  // If noise, return early — no Phase 2 needed
  if (phase1Result.content_type === "noise") {
    return noiseResult(phase1Result);
  }

  // ── Between phases: fetch data for Phase 2 ──────────────────
  const engagementId = phase1Result.engagement_match.id;
  const partnerId = phase1Result.engagement_match.partner_id;
  const isNew = phase1Result.engagement_match.is_new;
  const db = getSupabaseClient();

  // Query meetings linked to these messages (created by createMeetingFromICS before classification)
  const messageIds = messages.map((m) => m.id);
  const meetingsQuery = db
    .from("meetings")
    .select("*")
    .in("message_id", messageIds)
    .then(({ data }: { data: unknown }) => (data ?? []) as Meeting[]);

  const [history, matchedPartner, events, programs, relationships, nameMap, newMeetings, engagementEntityLinks, engagementRels] =
    await Promise.all([
      engagementId && !isNew
        ? getEngagementHistory(engagementId)
        : Promise.resolve(null),
      partnerId ? getPartner(partnerId) : Promise.resolve(null),
      getActiveEvents(),
      getActivePrograms(),
      getRelationships(),
      nameResolutionMap
        ? Promise.resolve(nameResolutionMap)
        : buildNameResolutionMap(),
      meetingsQuery,
      engagementId && !isNew
        ? getEntityLinksForEntity("engagement", engagementId)
        : Promise.resolve([]),
      engagementId && !isNew
        ? getRelationshipsByEngagement(engagementId)
        : Promise.resolve([]),
    ]);

  // Resolve entity link names from in-memory catalogs (no extra DB call)
  const existingEntityLinks = engagementEntityLinks.map(link => {
    let name = link.target_id;
    if (link.target_type === "program") {
      const prog = programs.find(p => p.id === link.target_id);
      if (prog) name = prog.name;
    } else if (link.target_type === "event") {
      const evt = events.find(e => e.id === link.target_id);
      if (evt) name = evt.name;
    }
    return { type: link.target_type, name, relationship: link.context || "linked" };
  });

  const existingRelationships = engagementRels.map(r => ({
    name: r.name,
    relationship: "linked",
  }));

  const existingLinks = (existingEntityLinks.length > 0 || existingRelationships.length > 0)
    ? { entityLinks: existingEntityLinks, awsRelationships: existingRelationships }
    : null;

  // ── Phase 2: Analyze ────────────────────────────────────────
  const phase2Context = buildPhase2Context(
    messages,
    phase1Result,
    history,
    { events, programs, relationships },
    matchedPartner,
    forwarderNote,
    nameMap,
    newMeetings.length > 0 ? newMeetings : null,
    existingLinks
  );

  return await classifyPhase2(phase2Context);
}

/**
 * Build a CombinedClassificationResult for noise without running Phase 2.
 */
function noiseResult(phase1: Phase1Result): CombinedClassificationResult {
  return {
    content_type: "noise",
    engagement_match: phase1.engagement_match,
    matched_events: [],
    matched_programs: [],
    matched_relationships: [],
    participants: [],
    current_state: null,
    topic: null,
    goal: null,
    engagement_name: null,
    pillar: null,
  };
}

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

  const messages = await getUnclassifiedMessages();
  if (messages.length === 0) return stats;

  // Group messages by forwarded_at timestamp (within 5s = same forwarded email)
  const groups = groupByForwardedAt(messages);

  for (const group of groups) {
    try {
      const representative = group[0];
      const forwarderNote = representative.forwarder_note ?? null;

      const result = await classifyTwoPhase(group, forwarderNote);
      const { needsReview } = await applyClassificationResult(group, result);
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
  forwarderNote?: string | null,
  nameResolutionMap?: NameResolutionMap | null
): Promise<CombinedClassificationResult | null> {
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

  try {
    const result = await classifyTwoPhase(
      messages as Message[],
      forwarderNote,
      nameResolutionMap
    );
    await applyClassificationResult(messages as Message[], result);
    return result;
  } catch (error) {
    console.error("Classification error:", error);
    return null;
  }
}

// ============================================================
// Run Phase 2 only (called from inbox resolve after user assigns)
// ============================================================

/**
 * Run Phase 2 analysis for an already-matched engagement.
 * Used by the inbox resolve flow after the user picks/creates an engagement.
 */
export async function runPhase2ForResolve(
  messages: Message[],
  phase1Result: Phase1Result,
  forwarderNote?: string | null
): Promise<CombinedClassificationResult> {
  const engagementId = phase1Result.engagement_match.id;
  const partnerId = phase1Result.engagement_match.partner_id;
  const isNew = phase1Result.engagement_match.is_new;

  const [history, matchedPartner, events, programs, relationships, nameMap, engagementEntityLinks, engagementRels] =
    await Promise.all([
      engagementId && !isNew
        ? getEngagementHistory(engagementId)
        : Promise.resolve(null),
      partnerId ? getPartner(partnerId) : Promise.resolve(null),
      getActiveEvents(),
      getActivePrograms(),
      getRelationships(),
      buildNameResolutionMap(),
      engagementId && !isNew
        ? getEntityLinksForEntity("engagement", engagementId)
        : Promise.resolve([]),
      engagementId && !isNew
        ? getRelationshipsByEngagement(engagementId)
        : Promise.resolve([]),
    ]);

  // Resolve entity link names from in-memory catalogs (no extra DB call)
  const existingEntityLinks = engagementEntityLinks.map(link => {
    let name = link.target_id;
    if (link.target_type === "program") {
      const prog = programs.find(p => p.id === link.target_id);
      if (prog) name = prog.name;
    } else if (link.target_type === "event") {
      const evt = events.find(e => e.id === link.target_id);
      if (evt) name = evt.name;
    }
    return { type: link.target_type, name, relationship: link.context || "linked" };
  });

  const existingRelationships = engagementRels.map(r => ({
    name: r.name,
    relationship: "linked",
  }));

  const existingLinks = (existingEntityLinks.length > 0 || existingRelationships.length > 0)
    ? { entityLinks: existingEntityLinks, awsRelationships: existingRelationships }
    : null;

  const phase2Context = buildPhase2Context(
    messages,
    phase1Result,
    history,
    { events, programs, relationships },
    matchedPartner,
    forwarderNote,
    nameMap,
    null, // newMeetings — not available in resolve path
    existingLinks
  );

  return await classifyPhase2(phase2Context);
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
 * 2. Update engagement state (current_state) — skip for new engagements (already set at creation)
 * 3. Create entity links (engagement↔event, engagement↔program) by ID
 * 4. Create engagement↔relationship links from matched_relationships
 * 5. Upsert participants and link to engagement
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

    // Structured fields — always update if present (both new and existing)
    if (combined.topic) updates.topic = combined.topic;
    if (combined.goal) updates.goal = combined.goal;
    if (combined.engagement_name) updates.name = combined.engagement_name;

    if (!isNewEngagement) {
      // current_state and pillar only update for existing engagements (new ones set at creation)
      if (result.current_state) updates.current_state = result.current_state;
      if (combined.pillar) updates.pillar = combined.pillar;
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

  // 4. Create engagement↔relationship links from matched_relationships
  for (const rel of result.matched_relationships ?? []) {
    try {
      await linkEngagementRelationship(engagementId, rel.id);
    } catch (err) {
      console.error(`Failed to link engagement to relationship "${rel.name}":`, err);
    }
  }

  // 5. Upsert participants and link to engagement
  if (result.participants.length > 0) {
    await upsertParticipants(result.participants, engagementId);
  }

  // 6. Backfill message sender_names with richer participant names
  const backfilled = await backfillMessageSenderNames(engagementId);
  if (backfilled > 0) {
    console.log(`[BACKFILL] Updated ${backfilled} message sender name(s) for engagement ${engagementId}`);
  }
}

// ============================================================
// Apply classification results to the database
// ============================================================

async function applyClassificationResult(
  messages: Message[],
  result: CombinedClassificationResult
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
      const engagementName = result.engagement_name || result.engagement_match.name;

      const engagement = await createEngagement({
        name: engagementName,
        partner_name: result.engagement_match.partner_name,
        current_state: currentState,
        topic: result.topic ?? null,
        goal: result.goal ?? null,
      });
      assignedEngagementId = engagement.id;

      // Set pillar on newly created engagement
      if (result.pillar) {
        await db.from("engagements").update({ pillar: result.pillar }).eq("id", engagement.id);
      }

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

    // Push engagement to Airtable (awaited to prevent serverless termination)
    try {
      const { pushEngagementToAirtable } = await import("./sync");
      const pushResult = await pushEngagementToAirtable(assignedEngagementId!);
      console.log(`Airtable push: ${pushResult.action} engagement ${assignedEngagementId}`);
    } catch (err) {
      console.error(`Airtable push failed for ${assignedEngagementId}:`, err);
    }
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

  // 3b. Link any meetings associated with these messages to the engagement.
  // No content_type gate — if a meeting record exists for a message, link it.
  if (assignedEngagementId && !needsReview) {
    for (const msgId of messageIds) {
      await linkMeetingToEngagement(msgId, assignedEngagementId);
    }
  }

  // 4. If flagged for review, create pending approval (resolved via Inbox UI)
  if (needsReview) {
    await createApproval({
      type: "engagement_assignment",
      message_id: messages[0].id,
      classification_result: result,
    });
  }

  console.log(
    `Classified ${messageIds.length} message(s): type=${result.content_type}, ` +
      `confidence=${result.engagement_match.confidence}, ` +
      `review=${needsReview}, engagement=${result.engagement_match.name}`
  );

  return { needsReview };
}
