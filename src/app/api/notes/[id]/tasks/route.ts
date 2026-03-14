import { NextRequest, NextResponse } from "next/server";
import { getMeetingNote, createTask } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = await getMeetingNote(id);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const body = await request.json();
    const { description, owner, owner_name, due_date } = body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    const validOwners = new Set(["me", "internal", "partner", "third_party"]);
    if (!owner || !validOwners.has(owner)) {
      return NextResponse.json(
        { error: "owner must be 'me', 'internal', 'partner', or 'third_party'" },
        { status: 400 }
      );
    }

    const task = await createTask({
      meeting_note_id: id,
      partner_id: note.partner_id,
      description: description.trim(),
      owner,
      owner_name: owner_name ?? null,
      due_date: due_date ?? null,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notes/[id]/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
