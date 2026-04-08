import { NextRequest, NextResponse } from "next/server";
import { createEventParticipation } from "@/lib/db";
import { VALID_EVENT_PARTICIPATION_STATUSES, validateEnum } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: partnerId } = await params;
  const body = await request.json();
  const { event_id, status, sponsoring, notes } = body;

  if (!event_id) {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }
  const statusErr = validateEnum("status", status, VALID_EVENT_PARTICIPATION_STATUSES);
  if (statusErr) {
    return NextResponse.json({ error: statusErr }, { status: 400 });
  }

  try {
    const participation = await createEventParticipation({
      partner_id: partnerId,
      event_id,
      status,
      sponsoring: sponsoring === true,
      notes: notes?.trim() || null,
    });

    return NextResponse.json({ participation }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return NextResponse.json(
        { error: "This partner is already linked to this event" },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
