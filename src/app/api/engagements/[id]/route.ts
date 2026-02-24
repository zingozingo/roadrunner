import { NextRequest, NextResponse } from "next/server";
import {
  getEngagementById,
  getMessagesByEngagement,
  getParticipantsByEngagement,
  getEntityLinksForEntity,
  updateEngagement,
  deleteEngagement,
  deleteMessagesByEngagement,
} from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const engagement = await getEngagementById(id);

    if (!engagement) {
      return NextResponse.json(
        { error: "Engagement not found" },
        { status: 404 }
      );
    }

    const [messages, participants, entityLinks] = await Promise.all([
      getMessagesByEngagement(id),
      getParticipantsByEngagement(id),
      getEntityLinksForEntity("engagement", id),
    ]);

    return NextResponse.json({
      engagement,
      messages,
      participants,
      entityLinks,
    });
  } catch (error) {
    console.error("GET /api/engagements/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagement" },
      { status: 500 }
    );
  }
}

const VALID_STATUSES = new Set(["active", "planned", "archived"]);
const VALID_PILLARS = new Set(["Co-Sell", "Co-Market", "Co-Build"]);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, partner_name, status, current_state, pillar } = body;

    // Validate: at least one field must be provided
    if (
      name === undefined &&
      partner_name === undefined &&
      status === undefined &&
      current_state === undefined &&
      pillar === undefined
    ) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 }
      );
    }

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Must be one of: active, planned, archived` },
        { status: 400 }
      );
    }

    if (pillar !== undefined && pillar !== null && !VALID_PILLARS.has(pillar)) {
      return NextResponse.json(
        { error: `Invalid pillar "${pillar}". Must be one of: Co-Sell, Co-Market, Co-Build` },
        { status: 400 }
      );
    }

    if (name !== undefined && typeof name === "string" && !name.trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    // Verify engagement exists
    const existing = await getEngagementById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Engagement not found" },
        { status: 404 }
      );
    }

    const updated = await updateEngagement(id, {
      name: name?.trim(),
      partner_name,
      status,
      current_state,
      pillar,
    });

    // Fire-and-forget: push update to Airtable
    import("@/lib/sync")
      .then(({ pushEngagementToAirtable }) => pushEngagementToAirtable(id))
      .then((r) => console.log(`Airtable push: ${r.action} engagement ${id}`))
      .catch((err) => console.error(`Airtable push failed for ${id}:`, err));

    return NextResponse.json({ engagement: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/engagements/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update engagement: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const includeMessages = request.nextUrl.searchParams.get("includeMessages") === "true";

    // Verify engagement exists
    const existing = await getEngagementById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Engagement not found" },
        { status: 404 }
      );
    }

    let messagesDeleted = 0;
    if (includeMessages) {
      messagesDeleted = await deleteMessagesByEngagement(id);
    }

    await deleteEngagement(id);

    return NextResponse.json({ status: "deleted", messagesDeleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/engagements/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete engagement: ${message}` },
      { status: 500 }
    );
  }
}
