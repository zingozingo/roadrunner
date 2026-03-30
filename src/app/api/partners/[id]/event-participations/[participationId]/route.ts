import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

const VALID_STATUSES = new Set(["invited", "registered", "sponsoring", "confirming"]);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participationId: string }> }
) {
  const { participationId } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

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
      .from("partner_event_participations")
      .update(updates)
      .eq("id", participationId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ participation: data });
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
  const db = getSupabaseClient();

  try {
    const { error } = await db
      .from("partner_event_participations")
      .delete()
      .eq("id", participationId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
