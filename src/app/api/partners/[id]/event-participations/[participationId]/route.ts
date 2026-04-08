import { NextRequest, NextResponse } from "next/server";
import { updateEventParticipation, deleteEventParticipation } from "@/lib/db";
import { VALID_EVENT_PARTICIPATION_STATUSES, validateEnum } from "@/lib/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participationId: string }> }
) {
  const { participationId } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.sponsoring !== undefined) updates.sponsoring = body.sponsoring === true;

  if (body.status !== undefined) {
    const err = validateEnum("status", body.status, VALID_EVENT_PARTICIPATION_STATUSES);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const participation = await updateEventParticipation(participationId, updates);
    return NextResponse.json({ participation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participationId: string }> }
) {
  const { participationId } = await params;

  try {
    await deleteEventParticipation(participationId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
