import { NextRequest, NextResponse } from "next/server";
import {
  getEngagementsWithMessageCounts,
  createEngagement,
  updateEngagement,
} from "@/lib/db";

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

const VALID_STATUSES = new Set(["active", "blocked", "completed", "archived"]);
const VALID_PILLARS = new Set(["Co-Sell", "Co-Market", "Co-Build"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, partner_name, status, pillar, current_state } = body;

    // Validate name
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Must be one of: active, blocked, completed, archived` },
        { status: 400 }
      );
    }

    if (pillar !== undefined && pillar !== null && !VALID_PILLARS.has(pillar)) {
      return NextResponse.json(
        { error: `Invalid pillar "${pillar}". Must be one of: Co-Sell, Co-Market, Co-Build` },
        { status: 400 }
      );
    }

    let engagement = await createEngagement({
      name: name.trim(),
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
