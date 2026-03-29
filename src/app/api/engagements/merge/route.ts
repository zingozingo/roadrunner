import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db";
import {
  synthesizeIntoEngagement,
  persistClassificationResult,
  buildSyntheticPhase1Result,
} from "@/lib/classifier";
import type { Engagement, Message } from "@/lib/types";

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

    const db = getSupabaseClient();

    // Fetch both engagements
    const [{ data: source }, { data: target }] = await Promise.all([
      db.from("engagements").select("*").eq("id", source_id).single(),
      db.from("engagements").select("*").eq("id", target_id).single(),
    ]);

    if (!source) {
      return NextResponse.json({ error: `Source engagement ${source_id} not found` }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ error: `Target engagement ${target_id} not found` }, { status: 404 });
    }

    const sourceEng = source as Engagement;
    const targetEng = target as Engagement;

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
    const { data: movedMessages } = await db
      .from("messages")
      .update({ engagement_id: target_id })
      .eq("engagement_id", source_id)
      .select("id");
    console.log(`Moved ${movedMessages?.length ?? 0} messages`);

    // 2. Move all meetings from source to target
    const { data: movedMeetings } = await db
      .from("meetings")
      .update({ engagement_id: target_id })
      .eq("engagement_id", source_id)
      .select("id");
    console.log(`Moved ${movedMeetings?.length ?? 0} meetings`);

    // 2b. Update meeting_notes engagement_id (follows meetings)
    const { data: movedNotes } = await db
      .from("meeting_notes")
      .update({ engagement_id: target_id })
      .eq("engagement_id", source_id)
      .select("id");
    console.log(`Moved ${movedNotes?.length ?? 0} meeting notes`);

    // 2c. Update tasks engagement_id (follows meetings)
    const { data: movedTasks } = await db
      .from("tasks")
      .update({ engagement_id: target_id })
      .eq("engagement_id", source_id)
      .select("id");
    console.log(`Moved ${movedTasks?.length ?? 0} tasks`);

    // 3. Move engagement_programs (dedup via ON CONFLICT)
    const { data: sourcePrograms } = await db
      .from("engagement_programs")
      .select("program_id, context, created_by")
      .eq("engagement_id", source_id);

    for (const sp of sourcePrograms ?? []) {
      await db
        .from("engagement_programs")
        .upsert(
          {
            engagement_id: target_id,
            program_id: sp.program_id,
            context: sp.context,
            created_by: sp.created_by,
          },
          { onConflict: "engagement_id,program_id" }
        );
    }

    // 4. Move engagement_events (dedup via ON CONFLICT)
    const { data: sourceEvents } = await db
      .from("engagement_events")
      .select("event_id, context, created_by")
      .eq("engagement_id", source_id);

    for (const se of sourceEvents ?? []) {
      await db
        .from("engagement_events")
        .upsert(
          {
            engagement_id: target_id,
            event_id: se.event_id,
            context: se.context,
            created_by: se.created_by,
          },
          { onConflict: "engagement_id,event_id" }
        );
    }

    // 5. Merge engagement_participants (upsert to target)
    const { data: sourceParticipants } = await db
      .from("engagement_participants")
      .select("participant_id, role")
      .eq("engagement_id", source_id);

    for (const sp of sourceParticipants ?? []) {
      await db
        .from("engagement_participants")
        .upsert(
          {
            engagement_id: target_id,
            participant_id: sp.participant_id,
            role: sp.role,
          },
          { onConflict: "engagement_id,participant_id" }
        );
    }

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
    // The re-synthesis in step 8 reads this as its anchor via getEngagementHistory,
    // produces a unified synthesis, and overwrites with a clean result.
    if (sourceEng.current_state) {
      const enrichedAnchor = targetEng.current_state
        ? `${targetEng.current_state}\n\n[MERGED FROM "${sourceEng.name}"]\n${sourceEng.current_state}`
        : sourceEng.current_state;
      await db
        .from("engagements")
        .update({ current_state: enrichedAnchor })
        .eq("id", target_id);
      console.log(`Enriched target current_state with source context`);
    }

    // 7. Delete source engagement (CASCADE cleans up its junction table rows)
    await db.from("engagements").delete().eq("id", source_id);
    console.log(`Deleted source engagement ${source_id}`);

    // 8. Re-synthesize target with its latest messages for fresh current_state
    try {
      const { data: latestMessages } = await db
        .from("messages")
        .select("*")
        .eq("engagement_id", target_id)
        .order("forwarded_at", { ascending: false })
        .limit(5);

      if (latestMessages && latestMessages.length > 0) {
        const partnerId = targetEng.partner_id;
        const { data: partner } = await db
          .from("partners")
          .select("name")
          .eq("id", partnerId)
          .single();

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
        await persistClassificationResult(result, target_id, latestMessages.map((m: any) => m.id), false);
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
    const { data: updatedTarget } = await db
      .from("engagements")
      .select("*")
      .eq("id", target_id)
      .single();

    return NextResponse.json({
      status: "merged",
      engagement: updatedTarget,
      moved: {
        messages: movedMessages?.length ?? 0,
        meetings: movedMeetings?.length ?? 0,
        notes: movedNotes?.length ?? 0,
        tasks: movedTasks?.length ?? 0,
        programs: sourcePrograms?.length ?? 0,
        events: sourceEvents?.length ?? 0,
        participants: sourceParticipants?.length ?? 0,
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
