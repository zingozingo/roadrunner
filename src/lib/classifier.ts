import { classifyPhase2 } from "./claude";
import { buildPhase2Context } from "./phase2-prompt";
import {
  getSupabaseClient,
  getActiveEvents,
  getActivePrograms,
  getRelationships,
  getEngagementHistory,
  getPartner,
  upsertParticipants,
  backfillMessageSenderNames,
  linkEngagementRelationship,
  getEngagementPrograms,
  getEngagementEvents,
  linkEngagementToProgram,
  linkEngagementToEvent,
  getRelationshipsByEngagement,
  getContactsByPartner,
  getContactsByRelationship,
  getContactsByMeeting,
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

  const [history, matchedPartner, events, programs, relationships, nameMap, linkedPrograms, linkedEvents, engagementRels, partnerContacts] =
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
        ? getEngagementPrograms(engagementId)
        : Promise.resolve([]),
      engagementId && !isNew
        ? getEngagementEvents(engagementId)
        : Promise.resolve([]),
      engagementId && !isNew
        ? getRelationshipsByEngagement(engagementId)
        : Promise.resolve([]),
      partnerId
        ? getContactsByPartner(partnerId)
        : Promise.resolve([]),
    ]);

  // Build existing entity links for Phase 2 context (names come from join)
  const existingEntityLinks = [
    ...linkedPrograms.map(lp => ({
      type: "program" as const,
      name: lp.program_name ?? lp.program_id,
      relationship: lp.context || "linked",
    })),
    ...linkedEvents.map(le => ({
      type: "event" as const,
      name: le.event_name ?? le.event_id,
      relationship: le.context || "linked",
    })),
  ];

  const existingRelationships = engagementRels.map(r => ({
    name: r.name,
    relationship: "linked",
  }));

  const existingLinks = (existingEntityLinks.length > 0 || existingRelationships.length > 0)
    ? { entityLinks: existingEntityLinks, awsRelationships: existingRelationships }
    : null;

  // Bulk-fetch relationship contacts for prompt rendering
  const relationshipContactEntries = await Promise.all(
    relationships.map(async (r) => {
      const contacts = await getContactsByRelationship(r.id);
      return [r.id, contacts] as const;
    })
  );
  const relationshipContactsMap = new Map(
    relationshipContactEntries.filter(([, contacts]) => contacts.length > 0)
  );

  // Bulk-fetch meeting contacts for history meetings
  const historyMeetingIds = (history?.meetings ?? []).map((m) => m.id);
  const meetingContactEntries = await Promise.all(
    historyMeetingIds.map(async (mid) => {
      const contacts = await getContactsByMeeting(mid);
      return [mid, contacts.map((c) => ({ name: c.name, email: c.email }))] as const;
    })
  );
  const meetingContactsMap = new Map(
    meetingContactEntries.filter(([, contacts]) => contacts.length > 0)
  );

  const phase2Context = buildPhase2Context(
    messages,
    phase1Result,
    history,
    { events, programs, relationships },
    matchedPartner,
    forwarderNote,
    nameMap,
    null, // newMeetings — not available in resolve path
    existingLinks,
    partnerContacts,
    relationshipContactsMap,
    meetingContactsMap
  );

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

  // 3. Create engagement↔event and engagement↔program links
  for (const event of result.matched_events) {
    try {
      await linkEngagementToEvent(engagementId, event.id);
    } catch (err) {
      console.error(`Failed to link engagement to event "${event.name}":`, err);
    }
  }

  for (const program of result.matched_programs) {
    try {
      await linkEngagementToProgram(engagementId, program.id);
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
