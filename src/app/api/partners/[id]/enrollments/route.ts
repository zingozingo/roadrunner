import { NextRequest, NextResponse } from "next/server";
import { createEnrollment } from "@/lib/db";
import { VALID_ENROLLMENT_STATUSES, validateEnum } from "@/lib/validation";

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
  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }
  const statusErr = validateEnum("status", status, VALID_ENROLLMENT_STATUSES);
  if (statusErr) {
    return NextResponse.json({ error: statusErr }, { status: 400 });
  }

  try {
    const enrollment = await createEnrollment({
      partner_id: partnerId,
      program_name: program_name.trim(),
      status,
      date_achieved: date_achieved || null,
      notes: notes?.trim() || null,
      program_id: program_id || null,
    });

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
