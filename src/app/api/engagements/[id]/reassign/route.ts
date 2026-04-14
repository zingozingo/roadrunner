import { NextRequest, NextResponse } from "next/server";
import {
  getEngagementById,
  getMessagesByEngagement,
  getMeetingsByEngagement,
  createEngagement,
  deleteEngagement,
} from "@/lib/db";
import { reassignMessages, discardFromEngagement } from "@/lib/engagement-manager";

interface ReassignRequest {
  messageIds: string[];
  meetingIds: string[];
  action: "move_to_existing" | "move_to_new" | "return_to_inbox" | "discard";
  targetEngagementId?: string;
  newEngagementTitle?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    const body = (await request.json()) as ReassignRequest;
    const { messageIds, meetingIds, action, targetEngagementId, newEngagementTitle } = body;

    // --- Validate inputs ---

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    if (
      (!messageIds || messageIds.length === 0) &&
      (!meetingIds || meetingIds.length === 0)
    ) {
      return NextResponse.json(
        { error: "At least one messageId or meetingId is required" },
        { status: 400 }
      );
    }

    // Verify source engagement exists
    const source = await getEngagementById(sourceId);
    if (!source) {
      return NextResponse.json(
        { error: "Source engagement not found" },
        { status: 404 }
      );
    }

    // Validate all messageIds belong to source engagement
    if (messageIds && messageIds.length > 0) {
      const sourceMessages = await getMessagesByEngagement(sourceId);
      const sourceMessageIds = new Set(sourceMessages.map((m) => m.id));
      const invalid = messageIds.filter((id) => !sourceMessageIds.has(id));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Messages do not belong to source engagement: ${invalid.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validate all meetingIds belong to source engagement
    if (meetingIds && meetingIds.length > 0) {
      const sourceMeetings = await getMeetingsByEngagement(sourceId);
      const sourceMeetingIds = new Set(sourceMeetings.map((m) => m.id));
      const invalid = meetingIds.filter((id) => !sourceMeetingIds.has(id));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Meetings do not belong to source engagement: ${invalid.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // --- Discard (hard delete) ---

    if (action === "discard") {
      const result = await discardFromEngagement({
        messageIds: messageIds ?? [],
        meetingIds: meetingIds ?? [],
        sourceEngagementId: sourceId,
      });

      let sourceDeleted = false;
      if (result.sourceEmpty) {
        await deleteEngagement(sourceId);
        sourceDeleted = true;
        console.log(`[reassign] Auto-deleted empty source engagement ${sourceId}`);
      }

      return NextResponse.json({
        discarded: {
          messages: result.deletedMessages,
          meetings: result.deletedMeetings,
        },
        sourceDeleted,
      });
    }

    // --- Resolve target ---

    let resolvedTargetId: string | null = null;
    let targetEngagement: { id: string; name: string } | null = null;

    if (action === "move_to_existing") {
      if (!targetEngagementId) {
        return NextResponse.json(
          { error: "targetEngagementId is required for move_to_existing" },
          { status: 400 }
        );
      }

      if (targetEngagementId === sourceId) {
        return NextResponse.json(
          { error: "Cannot move items to the same engagement" },
          { status: 400 }
        );
      }

      const target = await getEngagementById(targetEngagementId);
      if (!target) {
        return NextResponse.json(
          { error: "Target engagement not found" },
          { status: 404 }
        );
      }

      // Same-partner check
      if (source.partner_id && target.partner_id && source.partner_id !== target.partner_id) {
        return NextResponse.json(
          { error: "Cannot move items between engagements of different partners" },
          { status: 400 }
        );
      }

      resolvedTargetId = target.id;
      targetEngagement = { id: target.id, name: target.name };
    } else if (action === "move_to_new") {
      if (!newEngagementTitle || !newEngagementTitle.trim()) {
        return NextResponse.json(
          { error: "newEngagementTitle is required for move_to_new" },
          { status: 400 }
        );
      }

      const newEng = await createEngagement({
        name: newEngagementTitle.trim(),
        partner_id: source.partner_id,
      });

      resolvedTargetId = newEng.id;
      targetEngagement = { id: newEng.id, name: newEng.name };
    }
    // action === "return_to_inbox": resolvedTargetId stays null

    // --- Execute reassignment ---

    const result = await reassignMessages({
      messageIds: messageIds ?? [],
      meetingIds: meetingIds ?? [],
      sourceEngagementId: sourceId,
      targetEngagementId: resolvedTargetId,
    });

    // --- Handle empty source ---

    let sourceDeleted = false;
    if (result.sourceEmpty) {
      await deleteEngagement(sourceId);
      sourceDeleted = true;
      console.log(`[reassign] Auto-deleted empty source engagement ${sourceId}`);
    }

    return NextResponse.json({
      moved: {
        messages: result.movedMessages,
        meetings: result.movedMeetings,
        notes: result.movedNotes,
        tasks: result.movedTasks,
      },
      sourceDeleted,
      targetEngagement,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/engagements/[id]/reassign error:", message);
    return NextResponse.json(
      { error: `Failed to reassign: ${message}` },
      { status: 500 }
    );
  }
}
