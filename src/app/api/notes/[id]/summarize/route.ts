import { NextRequest, NextResponse } from "next/server";
import {
  getMeetingNote,
  getMeeting,
  updateMeetingNote,
  createTask,
} from "@/lib/db";
import { buildMeetingNoteContext } from "@/lib/notes-context";
import { summarizeNotes } from "@/lib/notes-summarizer";
import type { Task } from "@/lib/types";

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

    // Resolve engagement_id: note direct FK → meeting FK → null
    let engagementId: string | null = note.engagement_id ?? null;
    if (!engagementId && note.meeting_id) {
      const meeting = await getMeeting(note.meeting_id);
      engagementId = meeting?.engagement_id ?? null;
    }

    // Build scoped context for this meeting note
    const formattedContext = await buildMeetingNoteContext(note.partner_id, engagementId);

    // Collect ALL existing tasks for this note (ai_extracted + manual).
    // The prompt deduplicates against these — AI returns only genuinely new tasks.
    const existingTasks = note.tasks ?? [];

    // Call AI summarizer with existing tasks for non-redundancy
    const result = await summarizeNotes({
      rawNotes: note.raw_notes,
      partnerContext: formattedContext,
      noteType: note.note_type,
      meetingTitle: note.title ?? undefined,
      meetingDate: note.meeting_date ?? undefined,
      existingTasks: existingTasks.map((t) => ({
        description: t.description,
        owner: t.owner,
        owner_name: t.owner_name,
      })),
    });

    // Save AI prose to the note record (summary + condensed overwrite is fine).
    const existingTaskJsonb = existingTasks.map((t) => ({
      description: t.description,
      owner: t.owner,
      owner_name: t.owner_name,
      due_date: t.due_date,
    }));
    await updateMeetingNote(id, {
      ai_summary: result.summary,
      ai_tasks: [...existingTaskJsonb, ...result.tasks],
      condensed: result.condensed ?? null,
      context_snapshot: null,
      status: "complete",
    });

    // Materialize ONLY new tasks as first-class task rows.
    const createdTasks: Task[] = [];
    for (const task of result.tasks) {
      const created = await createTask({
        meeting_note_id: id,
        partner_id: note.partner_id,
        engagement_id: engagementId,
        description: task.description,
        owner: task.owner,
        owner_name: task.owner_name,
        due_date: task.due_date,
        origin: "ai_extracted",
      });
      createdTasks.push(created);
    }

    return NextResponse.json({
      ...result,
      tasks: createdTasks,
      existing_task_count: existingTasks.length,
    });
  } catch (error) {
    console.error("POST /api/notes/[id]/summarize error:", error);
    return NextResponse.json(
      { error: "Failed to summarize note" },
      { status: 500 }
    );
  }
}
