import { NextRequest, NextResponse } from "next/server";
import {
  getEngagementsWithMessageCounts,
  createEngagement,
  updateEngagement,
} from "@/lib/db";
import { VALID_ENGAGEMENT_STATUSES, VALID_ENGAGEMENT_PILLARS, validateEnum } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const partnerId = request.nextUrl.searchParams.get("partner_id");
    let engagements = await getEngagementsWithMessageCounts();
    if (partnerId) {
      engagements = engagements.filter((e) => e.partner_id === partnerId);
    }
    return NextResponse.json({ engagements });
  } catch (error) {
    console.error("GET /api/engagements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagements" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, partner_name, partner_id, status, pillar, current_state } = body;

    // Validate name
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
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

    let engagement = await createEngagement({
      name: name.trim(),
      partner_id: partner_id || undefined,
      partner_name: partner_name?.trim() || null,
      current_state: current_state?.trim() || null,
      pillar: pillar ?? null,
    });

    // createEngagement() defaults to status "active" — update if different status requested
    if (status && status !== "active") {
      engagement = await updateEngagement(engagement.id, { status });
    }

    // Push to Airtable (awaited to prevent serverless termination)
    try {
      const { pushEngagementToAirtable } = await import("@/lib/sync");
      const pushResult = await pushEngagementToAirtable(engagement.id);
      console.log(`Airtable push: ${pushResult.action} engagement ${engagement.id}`);
    } catch (err) {
      console.error(`Airtable push failed for ${engagement.id}:`, err);
    }

    return NextResponse.json({ engagement }, { status: 201 });
  } catch (error) {
    console.error("POST /api/engagements error:", error);
    return NextResponse.json(
      { error: "Failed to create engagement" },
      { status: 500 }
    );
  }
}
