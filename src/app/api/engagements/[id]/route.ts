import { NextRequest, NextResponse } from "next/server";
import {
  getEngagementById,
  getMessagesByEngagement,
  getParticipantsByEngagement,
  updateEngagement,
  deleteEngagement,
  deleteMessagesByEngagement,
  resolvePartnerByName,
} from "@/lib/db";
import { VALID_ENGAGEMENT_STATUSES, VALID_ENGAGEMENT_PILLARS, validateEnum } from "@/lib/validation";

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

    const [messages, participants] = await Promise.all([
      getMessagesByEngagement(id),
      getParticipantsByEngagement(id),
    ]);

    return NextResponse.json({
      engagement,
      messages,
      participants,
    });
  } catch (error) {
    console.error("GET /api/engagements/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagement" },
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
    const { name, partner_name, status, current_state, condensed, pillar } = body;

    // Resolve partner_name to partner_id if provided
    let partner_id: string | null | undefined;
    if (partner_name !== undefined) {
      if (partner_name) {
        partner_id = await resolvePartnerByName(partner_name);
      } else {
        partner_id = null;
      }
    }

    // Validate: at least one field must be provided
    if (
      name === undefined &&
      partner_name === undefined &&
      status === undefined &&
      current_state === undefined &&
      condensed === undefined &&
      pillar === undefined
    ) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 }
      );
    }

    if (status !== undefined) {
      const err = validateEnum("status", status, VALID_ENGAGEMENT_STATUSES);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    if (pillar !== undefined && pillar !== null) {
      const err = validateEnum("pillar", pillar, VALID_ENGAGEMENT_PILLARS);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
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
      partner_id,
      status,
      current_state,
      condensed,
      pillar,
    });

    // Push to Airtable (awaited to prevent serverless termination)
    try {
      const { pushEngagementToAirtable } = await import("@/lib/sync");
      const pushResult = await pushEngagementToAirtable(id);
      console.log(`Airtable push: ${pushResult.action} engagement ${id}`);
    } catch (err) {
      console.error(`Airtable push failed for ${id}:`, err);
    }

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

    return NextResponse.json({ deleted: true, messagesDeleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/engagements/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete engagement: ${message}` },
      { status: 500 }
    );
  }
}
