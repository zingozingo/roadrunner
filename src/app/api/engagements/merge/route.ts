import { NextRequest, NextResponse } from "next/server";
import {
  getEngagementById,
  updateEngagement,
  deleteEngagementRecord,
  getMessagesByEngagement,
  getPartner,
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
import type { Message } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { source_id, target_id } = await request.json();

    if (!source_id || !target_id) {
      return NextResponse.json(
        { error: "source_id and target_id are required" },
        { status: 400 }
      );
    }

    if (source_id === target_id) {
      return NextResponse.json(
        { error: "Cannot merge an engagement into itself" },
        { status: 400 }
      );
    }

    // Fetch both engagements
    const [sourceEng, targetEng] = await Promise.all([
      getEngagementById(source_id),
      getEngagementById(target_id),
    ]);

    if (!sourceEng) {
      return NextResponse.json({ error: `Source engagement ${source_id} not found` }, { status: 404 });
    }
    if (!targetEng) {
      return NextResponse.json({ error: `Target engagement ${target_id} not found` }, { status: 404 });
    }

    // Same-partner guard
    if (sourceEng.partner_id !== targetEng.partner_id) {
      return NextResponse.json(
        { error: "Cannot merge engagements from different partners" },
        { status: 400 }
      );
    }

    if (!targetEng.partner_id) {
      return NextResponse.json(
        { error: "Cannot merge engagements without a partner" },
        { status: 400 }
      );
    }

    console.log(`Merging engagement "${sourceEng.name}" → "${targetEng.name}"`);

    // 1. Move all messages from source to target
    const movedMessageCount = await reparentMessagesToEngagement(source_id, target_id);
    console.log(`Moved ${movedMessageCount} messages`);

    // 2. Move all meetings from source to target
    const movedMeetingCount = await reparentMeetingsToEngagement(source_id, target_id);
    console.log(`Moved ${movedMeetingCount} meetings`);

    // 2b. Update meeting_notes engagement_id (follows meetings)
    const movedNoteCount = await reparentNotesToEngagement(source_id, target_id);
    console.log(`Moved ${movedNoteCount} meeting notes`);

    // 2c. Update tasks engagement_id (follows meetings)
    const movedTaskCount = await reparentTasksToEngagement(source_id, target_id);
    console.log(`Moved ${movedTaskCount} tasks`);

    // 3. Merge engagement_participants (upsert to target)
    const mergedParticipantCount = await mergeEngagementParticipants(source_id, target_id);

    // 6. Delete source engagement from Airtable
    if (sourceEng.airtable_record_id) {
      try {
        const { deleteEngagementFromAirtable } = await import("@/lib/sync");
        await deleteEngagementFromAirtable(sourceEng.airtable_record_id);
        console.log(`Airtable delete: removed source engagement ${source_id}`);
      } catch (err) {
        console.error(`Airtable delete failed for source ${source_id} (non-blocking):`, err);
      }
    }

    // 6c. Enrich target's current_state with source context before deletion
    if (sourceEng.current_state) {
      const enrichedAnchor = targetEng.current_state
        ? `${targetEng.current_state}\n\n[MERGED FROM "${sourceEng.name}"]\n${sourceEng.current_state}`
        : sourceEng.current_state;
      await updateEngagement(target_id, { current_state: enrichedAnchor });
      console.log(`Enriched target current_state with source context`);
    }

    // 7. Delete source engagement (CASCADE cleans up its junction table rows)
    await deleteEngagementRecord(source_id);
    console.log(`Deleted source engagement ${source_id}`);

    // 8. Re-synthesize target with its latest messages for fresh current_state
    try {
      const allMessages = await getMessagesByEngagement(target_id);
      const latestMessages = allMessages.slice(0, 5);

      if (latestMessages.length > 0) {
        const partnerId = targetEng.partner_id;
        const partner = await getPartner(partnerId);

        const phase1 = buildSyntheticPhase1Result(
          target_id,
          partnerId,
          partner?.name ?? "Unknown",
          false,
          targetEng.name
        );

        const result = await synthesizeIntoEngagement(
          latestMessages as Message[],
          phase1
        );
        await persistClassificationResult(result, target_id, latestMessages.map((m) => m.id), false);
        console.log("Re-synthesized merged engagement");
      }
    } catch (err) {
      console.error("Post-merge synthesis failed (merge still succeeded):", err);
    }

    // 9. Push merged target to Airtable
    try {
      const { pushEngagementToAirtable } = await import("@/lib/sync");
      await pushEngagementToAirtable(target_id);
      console.log(`Airtable push: updated merged engagement ${target_id}`);
    } catch (err) {
      console.error(`Airtable push failed for ${target_id}:`, err);
    }

    // Fetch updated target to return
    const updatedTarget = await getEngagementById(target_id);

    return NextResponse.json({
      status: "merged",
      engagement: updatedTarget,
      moved: {
        messages: movedMessageCount,
        meetings: movedMeetingCount,
        notes: movedNoteCount,
        tasks: movedTaskCount,
        participants: mergedParticipantCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Merge failed:", message);
    return NextResponse.json(
      { error: `Failed to merge: ${message}` },
      { status: 500 }
    );
  }
}
