import { NextRequest, NextResponse } from "next/server";
import { getMeetingNote, updateMeetingNote, deleteMeetingNote } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = await getMeetingNote(id);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error("GET /api/notes/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch note" },
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

    const existing = await getMeetingNote(id);
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const updated = await updateMeetingNote(id, {
      title: body.title,
      raw_notes: body.raw_notes,
      ai_summary: body.ai_summary,
      ai_tasks: body.ai_tasks,
      ai_flags: body.ai_flags,
      context_snapshot: body.context_snapshot,
      status: body.status,
      engagement_id: body.engagement_id,
    });

    return NextResponse.json({ note: updated });
  } catch (error) {
    console.error("PUT /api/notes/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
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

    const existing = await getMeetingNote(id);
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await deleteMeetingNote(id);
    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    console.error("DELETE /api/notes/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
