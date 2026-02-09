import { NextRequest, NextResponse } from "next/server";
import {
  getInitiativeById,
  getMessagesByInitiative,
  getParticipantsByInitiative,
  getEntityLinksForEntity,
  updateInitiative,
  deleteInitiative,
} from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const initiative = await getInitiativeById(id);

    if (!initiative) {
      return NextResponse.json(
        { error: "Initiative not found" },
        { status: 404 }
      );
    }

    const [messages, participants, entityLinks] = await Promise.all([
      getMessagesByInitiative(id),
      getParticipantsByInitiative(id),
      getEntityLinksForEntity("initiative", id),
    ]);

    return NextResponse.json({
      initiative,
      messages,
      participants,
      entityLinks,
    });
  } catch (error) {
    console.error("GET /api/initiatives/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch initiative" },
      { status: 500 }
    );
  }
}

const VALID_STATUSES = new Set(["active", "paused", "closed"]);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, partner_name, status, summary, current_state, open_items } = body;

    // Validate: at least one field must be provided
    if (
      name === undefined &&
      partner_name === undefined &&
      status === undefined &&
      summary === undefined &&
      current_state === undefined &&
      open_items === undefined
    ) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 }
      );
    }

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Must be one of: active, paused, closed` },
        { status: 400 }
      );
    }

    if (name !== undefined && typeof name === "string" && !name.trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    // Verify initiative exists
    const existing = await getInitiativeById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Initiative not found" },
        { status: 404 }
      );
    }

    const updated = await updateInitiative(id, {
      name: name?.trim(),
      partner_name,
      status,
      summary,
      current_state,
      open_items,
    });

    return NextResponse.json({ initiative: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/initiatives/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update initiative: ${message}` },
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

    // Verify initiative exists
    const existing = await getInitiativeById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Initiative not found" },
        { status: 404 }
      );
    }

    await deleteInitiative(id);

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/initiatives/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete initiative: ${message}` },
      { status: 500 }
    );
  }
}
