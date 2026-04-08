import {
  updateEngagement,
  deleteEngagementRecord,
  getMessagesByEngagement,
  getPartner,
  getEngagementById,
  reparentMessagesToEngagement,
  reparentMeetingsToEngagement,
  reparentNotesToEngagement,
  reparentTasksToEngagement,
  mergeEngagementParticipants,
} from "@/lib/db";
import {
  synthesizeIntoEngagement,
  persistClassificationResult,
  buildSyntheticPhase1Result,
} from "@/lib/classifier";
import type { Engagement, Message } from "@/lib/types";

// --- Types ---

export interface MergeResult {
  engagement: Engagement | null;
  moved: {
    messages: number;
    meetings: number;
    notes: number;
    tasks: number;
    participants: number;
  };
}

// --- Main service function ---

/**
 * Merge source engagement into target: reparent all entities, delete source,
 * re-synthesize target, and sync to Airtable.
 *
 * Caller is responsible for fetching both engagements and validating inputs
 * (same partner, both exist, not self-merge). This function handles everything
 * from "I have two valid engagements" through "merge is complete and synced."
 */
export async function mergeEngagements(
  source: Engagement,
  target: Engagement
): Promise<MergeResult> {
  console.log(`Merging engagement "${source.name}" → "${target.name}"`);

  // 1. Reparent all entities from source to target
  const movedMessageCount = await reparentMessagesToEngagement(source.id, target.id);
  console.log(`Moved ${movedMessageCount} messages`);

  const movedMeetingCount = await reparentMeetingsToEngagement(source.id, target.id);
  console.log(`Moved ${movedMeetingCount} meetings`);

  const movedNoteCount = await reparentNotesToEngagement(source.id, target.id);
  console.log(`Moved ${movedNoteCount} meeting notes`);

  const movedTaskCount = await reparentTasksToEngagement(source.id, target.id);
  console.log(`Moved ${movedTaskCount} tasks`);

  const mergedParticipantCount = await mergeEngagementParticipants(source.id, target.id);

  // 2. Delete source from Airtable
  if (source.airtable_record_id) {
    try {
      const { deleteEngagementFromAirtable } = await import("@/lib/sync");
      await deleteEngagementFromAirtable(source.airtable_record_id);
      console.log(`Airtable delete: removed source engagement ${source.id}`);
    } catch (err) {
      console.error(`Airtable delete failed for source ${source.id} (non-blocking):`, err);
    }
  }

  // 3. Enrich target's current_state with source context before deletion
  if (source.current_state) {
    const enrichedAnchor = target.current_state
      ? `${target.current_state}\n\n[MERGED FROM "${source.name}"]\n${source.current_state}`
      : source.current_state;
    await updateEngagement(target.id, { current_state: enrichedAnchor });
    console.log(`Enriched target current_state with source context`);
  }

  // 4. Delete source engagement (CASCADE cleans up its junction table rows)
  await deleteEngagementRecord(source.id);
  console.log(`Deleted source engagement ${source.id}`);

  // 5. Re-synthesize target with its latest messages for fresh current_state
  try {
    const allMessages = await getMessagesByEngagement(target.id);
    const latestMessages = allMessages.slice(0, 5);

    if (latestMessages.length > 0) {
      const partnerId = target.partner_id!;
      const partner = await getPartner(partnerId);

      const phase1 = buildSyntheticPhase1Result(
        target.id,
        partnerId,
        partner?.name ?? "Unknown",
        false,
        target.name
      );

      const result = await synthesizeIntoEngagement(
        latestMessages as Message[],
        phase1
      );
      await persistClassificationResult(result, target.id, latestMessages.map((m) => m.id), false);
      console.log("Re-synthesized merged engagement");
    }
  } catch (err) {
    console.error("Post-merge synthesis failed (merge still succeeded):", err);
  }

  // 6. Push merged target to Airtable
  try {
    const { pushEngagementToAirtable } = await import("@/lib/sync");
    await pushEngagementToAirtable(target.id);
    console.log(`Airtable push: updated merged engagement ${target.id}`);
  } catch (err) {
    console.error(`Airtable push failed for ${target.id}:`, err);
  }

  // Fetch updated target to return
  const updatedTarget = await getEngagementById(target.id);

  return {
    engagement: updatedTarget,
    moved: {
      messages: movedMessageCount,
      meetings: movedMeetingCount,
      notes: movedNoteCount,
      tasks: movedTaskCount,
      participants: mergedParticipantCount,
    },
  };
}
