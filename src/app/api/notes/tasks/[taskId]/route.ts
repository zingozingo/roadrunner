import { NextRequest, NextResponse } from "next/server";
import { updateNoteTask, deleteNoteTask } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();

    const task = await updateNoteTask(taskId, {
      description: body.description,
      owner: body.owner,
      owner_name: body.owner_name,
      status: body.status,
      due_date: body.due_date,
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error("PUT /api/notes/tasks/[taskId] error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    await deleteNoteTask(taskId);
    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    console.error("DELETE /api/notes/tasks/[taskId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
