import { NextRequest, NextResponse } from "next/server";
import { listMeetingNotes, createMeetingNote } from "@/lib/db";

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
    const note = await createMeetingNote({
      partner_id: body.partner_id,
      meeting_id: body.meeting_id ?? null,
      engagement_id: body.engagement_id ?? null,
      note_type: body.note_type ?? "meeting",
      title: body.title ?? null,
      meeting_date: body.meeting_date ?? null,
      date_range_start: body.date_range_start ?? null,
      date_range_end: body.date_range_end ?? null,
      raw_notes: (body.raw_notes ?? "").trim(),
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notes error:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
