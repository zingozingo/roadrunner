import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

const VALID_STATUSES = new Set(["not_started", "in_progress", "submitted", "approved", "interested", "denied", "expired"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partnerId } = await params;
  const body = await request.json();
  const { program_name, status, date_achieved, notes, program_id } = body;

  if (!program_name?.trim()) {
    return NextResponse.json({ error: "program_name is required" }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
  }

  const db = getSupabaseClient();

  try {
    const { data, error } = await db
      .from("partner_program_enrollments")
      .insert({
        partner_id: partnerId,
        program_name: program_name.trim(),
        status,
        date_achieved: date_achieved || null,
        notes: notes?.trim() || null,
        program_id: program_id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ enrollment: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
