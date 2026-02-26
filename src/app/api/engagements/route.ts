import { NextRequest, NextResponse } from "next/server";
import {
  getEngagementsWithMessageCounts,
  createEngagement,
  updateEngagement,
} from "@/lib/supabase";

export async function GET() {
  try {
    const engagements = await getEngagementsWithMessageCounts();
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
    const { name, partner_name, status, pillar, current_state, tags } = body;

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
      tags: tags ?? [],
      pillar: pillar ?? null,
    });

    // createEngagement() defaults to status "active" — update if different status requested
    if (status && status !== "active") {
      engagement = await updateEngagement(engagement.id, { status });
    }

    // Fire-and-forget: push to Airtable
    import("@/lib/sync")
      .then(({ pushEngagementToAirtable }) => pushEngagementToAirtable(engagement.id))
      .then((r) => console.log(`Airtable push: ${r.action} engagement ${engagement.id}`))
      .catch((err) => console.error(`Airtable push failed for ${engagement.id}:`, err));

    return NextResponse.json({ engagement }, { status: 201 });
  } catch (error) {
    console.error("POST /api/engagements error:", error);
    return NextResponse.json(
      { error: "Failed to create engagement" },
      { status: 500 }
    );
  }
}
