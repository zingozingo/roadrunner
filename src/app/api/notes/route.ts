import { NextRequest, NextResponse } from "next/server";
import { listMeetingNotes, createMeetingNote, getMeeting, getMeetingNoteByMeetingId } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const result = await listMeetingNotes({
      partnerId: sp.get("partnerId") ?? undefined,
      status: sp.get("status") ?? undefined,
      noteType: sp.get("noteType") ?? undefined,
      limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
      offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partner_id } = body;

    if (!partner_id || typeof partner_id !== "string") {
      return NextResponse.json(
        { error: "partner_id is required" },
        { status: 400 }
      );
    }
    // Resolve engagement_id: explicit wins, otherwise inherit from meeting
    const meetingId: string | null = body.meeting_id ?? null;
    let resolvedEngagementId: string | null = body.engagement_id ?? null;
    let meeting: Awaited<ReturnType<typeof getMeeting>> | null = null;

    if (meetingId) {
      meeting = await getMeeting(meetingId);
      if (!meeting) {
        return NextResponse.json(
          { error: "Meeting not found" },
          { status: 400 }
        );
      }
      if (!body.engagement_id) {
        resolvedEngagementId = meeting.engagement_id;
      }
    }

    // Idempotent: if a note already exists for this meeting, return it
    if (meetingId) {
      const existing = await getMeetingNoteByMeetingId(meetingId);
      if (existing) {
        return NextResponse.json({ note: existing }, { status: 200 });
      }
    }

    const note = await createMeetingNote({
      partner_id: body.partner_id,
      meeting_id: meetingId,
      engagement_id: resolvedEngagementId,
      note_type: body.note_type ?? "meeting",
      title: body.title ?? null,
      meeting_date: body.meeting_date ?? null,
      date_range_start: body.date_range_start ?? null,
      date_range_end: body.date_range_end ?? null,
      raw_notes: (body.raw_notes ?? "").trim(),
    });

    // Auto-flip meeting status: scheduled → completed when notes are created
    if (meeting && meeting.status === "scheduled") {
      try {
        const { updateMeeting } = await import("@/lib/db");
        await updateMeeting(meetingId!, { status: "completed" });
        console.log(`Meeting ${meetingId} auto-completed via notes save`);

        const { pushMeetingToAirtable } = await import("@/lib/sync");
        await pushMeetingToAirtable(meetingId!);
      } catch (err) {
        console.error(`Auto-complete failed for meeting ${meetingId}:`, err);
      }
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notes error:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
