import { NextRequest, NextResponse } from "next/server";
import {
  getMeetingNote,
  updateMeetingNote,
  deleteAiTasksForNote,
  createNoteTask,
} from "@/lib/db";
import { buildPartnerContext, formatContextForPrompt } from "@/lib/notes-context";
import { summarizeNotes } from "@/lib/notes-summarizer";
import type { NoteTask } from "@/lib/types";

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

    // Save AI results to the note record
    await updateMeetingNote(id, {
      ai_summary: result.summary,
      ai_tasks: result.tasks,
      ai_flags: result.flags,
      context_snapshot: context,
      status: "summarized",
    });

    // Materialize AI tasks as first-class note_tasks rows.
    // Delete previous AI tasks first (safe for re-summarization — manual tasks preserved).
    await deleteAiTasksForNote(id);

    const createdTasks: NoteTask[] = [];
    for (const task of result.tasks) {
      const created = await createNoteTask({
        meeting_note_id: id,
        partner_id: note.partner_id,
        description: task.description,
        owner: task.owner,
        owner_name: task.owner_name,
        due_date: task.due_date,
        source: note.note_type,
        origin: "ai",
      });
      createdTasks.push(created);
    }

    return NextResponse.json({ ...result, tasks: createdTasks });
  } catch (error) {
    console.error("POST /api/notes/[id]/summarize error:", error);
    return NextResponse.json(
      { error: "Failed to summarize note" },
      { status: 500 }
    );
  }
}
