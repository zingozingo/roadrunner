import { NextRequest, NextResponse } from "next/server";
import {
  getMeeting,
  updateMeeting,
  deleteMeeting,
} from "@/lib/db";

const VALID_STATUSES = new Set([
  "scheduled",
  "completed",
  "cancelled",
  "did_not_occur",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Resolve engagement name if linked
    let engagementName: string | null = null;
    if (meeting.engagement_id) {
      const { getEngagementById } = await import("@/lib/db");
      const eng = await getEngagementById(meeting.engagement_id);
      engagementName = eng?.name ?? null;
    }

    return NextResponse.json({ meeting, engagementName });
  } catch (error) {
    console.error("GET /api/meetings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, engagement_id, partner_name, status, meeting_date, start_time, end_time, location, notes } = body;

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      );
    }

    if (status !== undefined && status !== null && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await getMeeting(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (engagement_id !== undefined) updates.engagement_id = engagement_id || null;
    if (partner_name !== undefined) {
      // Resolve partner_name to partner_id
      if (partner_name?.trim()) {
        const { getSupabaseClient } = await import("@/lib/db");
        const db = getSupabaseClient();
        const { data: partnerRows } = await db
          .from("partners")
          .select("id")
          .ilike("name", partner_name.trim())
          .limit(1);
        updates.partner_id = partnerRows?.[0]?.id ?? null;
      } else {
        updates.partner_id = null;
      }
    }
    if (status !== undefined) updates.status = status;
    if (meeting_date !== undefined) updates.meeting_date = meeting_date || null;
    if (start_time !== undefined) updates.start_time = start_time?.trim() || null;
    if (end_time !== undefined) updates.end_time = end_time?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    const updated = await updateMeeting(id, updates);

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/meetings/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update meeting: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getMeeting(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    await deleteMeeting(id);

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/meetings/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete meeting: ${message}` },
      { status: 500 }
    );
  }
}
