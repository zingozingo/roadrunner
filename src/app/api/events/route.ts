import { NextRequest, NextResponse } from "next/server";
import {
  getAllEventsWithCounts,
  getEventApprovalById,
  resolveEventApproval,
  findOrCreateEvent,
  createEntityLink,
} from "@/lib/supabase";
import { EventSuggestion } from "@/lib/types";

export async function GET() {
  try {
    const events = await getAllEventsWithCounts();
    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { approval_id, action } = body as {
      approval_id: string;
      action: "approve" | "deny";
    };

    if (!approval_id || !action) {
      return NextResponse.json(
        { error: "approval_id and action are required" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "deny") {
      return NextResponse.json(
        { error: "action must be 'approve' or 'deny'" },
        { status: 400 }
      );
    }

    const approval = await getEventApprovalById(approval_id);
    if (!approval) {
      return NextResponse.json(
        { error: "Event approval not found" },
        { status: 404 }
      );
    }

    if (approval.resolved) {
      return NextResponse.json(
        { error: "This event approval has already been resolved" },
        { status: 409 }
      );
    }

    if (action === "deny") {
      await resolveEventApproval(approval_id, "denied");
      return NextResponse.json({ status: "denied" });
    }

    // Approve: create event and link to initiative
    const eventData = approval.event_data as EventSuggestion;
    const event = await findOrCreateEvent({
      name: eventData.name,
      type: eventData.type,
      start_date: eventData.date,
      date_precision: eventData.date_precision,
    });

    // Link to initiative if one exists
    if (approval.initiative_id) {
      await createEntityLink({
        source_type: "initiative",
        source_id: approval.initiative_id,
        target_type: "event",
        target_id: event.id,
        relationship: "relevant_to",
        context: `Event approved from email classification`,
      });
    }

    await resolveEventApproval(approval_id, `approved:${event.id}:${event.name}`);

    return NextResponse.json({ status: "approved", event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/events error:", message);
    return NextResponse.json(
      { error: `Failed to process event approval: ${message}` },
      { status: 500 }
    );
  }
}
