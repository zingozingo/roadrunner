import { NextRequest, NextResponse } from "next/server";
import {
  getEventById,
  getLinkedEngagementsForEntity,
  updateEvent,
  deleteEvent,
} from "@/lib/supabase";
import { Event } from "@/lib/types";

const VALID_TYPES = new Set<Event["type"]>([
  "conference", "summit", "workshop", "kickoff",
  "trade_show", "deadline", "review_cycle", "training",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await getEventById(id);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const linkedEngagements = await getLinkedEngagementsForEntity("event", id);

    return NextResponse.json({ event, linkedEngagements });
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, type, start_date, end_date, host, location, description, verified } = body;

    if (name !== undefined && typeof name === "string" && !name.trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    if (type !== undefined && !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Invalid type "${type}"` },
        { status: 400 }
      );
    }

    const existing = await getEventById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (start_date !== undefined) updates.start_date = start_date || null;
    if (end_date !== undefined) updates.end_date = end_date || null;
    if (host !== undefined) updates.host = host || null;
    if (location !== undefined) updates.location = location || null;
    if (description !== undefined) updates.description = description || null;
    if (verified !== undefined) updates.verified = verified;

    const updated = await updateEvent(id, updates);

    return NextResponse.json({ event: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/events/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update event: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getEventById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    await deleteEvent(id);

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/events/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete event: ${message}` },
      { status: 500 }
    );
  }
}
