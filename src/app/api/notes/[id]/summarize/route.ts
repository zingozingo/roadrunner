import { NextRequest, NextResponse } from "next/server";
import { getMeetingNote, updateMeetingNote } from "@/lib/db";
import { buildPartnerContext, formatContextForPrompt } from "@/lib/notes-context";
import { summarizeNotes } from "@/lib/notes-summarizer";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const note = await getMeetingNote(id);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Build partner context
    const context = await buildPartnerContext(note.partner_id);
    const formattedContext = formatContextForPrompt(context);

    // Call AI summarizer
    const result = await summarizeNotes({
      rawNotes: note.raw_notes,
      partnerContext: formattedContext,
      noteType: note.note_type,
      meetingTitle: note.title ?? undefined,
      meetingDate: note.meeting_date ?? undefined,
    });

    // Save results atomically — only update if AI succeeded
    await updateMeetingNote(id, {
      ai_summary: result.summary,
      ai_tasks: result.tasks,
      ai_flags: result.flags,
      context_snapshot: context,
      status: "summarized",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/notes/[id]/summarize error:", error);
    return NextResponse.json(
      { error: "Failed to summarize note" },
      { status: 500 }
    );
  }
}
