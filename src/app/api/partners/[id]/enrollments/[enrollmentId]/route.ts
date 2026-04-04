import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

const VALID_STATUSES = new Set(["not_started", "in_progress", "submitted", "approved", "interested", "denied", "expired"]);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  const { enrollmentId } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.program_name !== undefined) updates.program_name = body.program_name?.trim() || null;
  if (body.program_id !== undefined) updates.program_id = body.program_id || null;
  if (body.date_achieved !== undefined) updates.date_achieved = body.date_achieved || null;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const db = getSupabaseClient();

  try {
    const { data, error } = await db
      .from("partner_program_enrollments")
      .update(updates)
      .eq("id", enrollmentId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ enrollment: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  const { enrollmentId } = await params;
  const db = getSupabaseClient();

  try {
    const { error } = await db
      .from("partner_program_enrollments")
      .delete()
      .eq("id", enrollmentId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
