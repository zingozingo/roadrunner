import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

const VALID_STATUSES = new Set(["interested", "invited", "registered", "attended", "declined"]);

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
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
  }

  const db = getSupabaseClient();

  try {
    const { data, error } = await db
      .from("partner_event_participations")
      .insert({
        partner_id: partnerId,
        event_id,
        status,
        sponsoring: sponsoring === true,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This partner is already linked to this event" },
          { status: 409 }
        );
      }
      throw error;
    }
    return NextResponse.json({ participation: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
