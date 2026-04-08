import { NextRequest, NextResponse } from "next/server";
import { getEngagementById } from "@/lib/db";
import { mergeEngagements } from "@/lib/engagement-merge";

export async function POST(request: NextRequest) {
  try {
    const { source_id, target_id } = await request.json();

    if (!source_id || !target_id) {
      return NextResponse.json(
        { error: "source_id and target_id are required" },
        { status: 400 }
      );
    }

    if (source_id === target_id) {
      return NextResponse.json(
        { error: "Cannot merge an engagement into itself" },
        { status: 400 }
      );
    }

    // Fetch both engagements
    const [sourceEng, targetEng] = await Promise.all([
      getEngagementById(source_id),
      getEngagementById(target_id),
    ]);

    if (!sourceEng) {
      return NextResponse.json({ error: `Source engagement ${source_id} not found` }, { status: 404 });
    }
    if (!targetEng) {
      return NextResponse.json({ error: `Target engagement ${target_id} not found` }, { status: 404 });
    }

    if (sourceEng.partner_id !== targetEng.partner_id) {
      return NextResponse.json(
        { error: "Cannot merge engagements from different partners" },
        { status: 400 }
      );
    }

    if (!targetEng.partner_id) {
      return NextResponse.json(
        { error: "Cannot merge engagements without a partner" },
        { status: 400 }
      );
    }

    const result = await mergeEngagements(sourceEng, targetEng);

    return NextResponse.json({
      status: "merged",
      engagement: result.engagement,
      moved: result.moved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Merge failed:", message);
    return NextResponse.json(
      { error: `Failed to merge: ${message}` },
      { status: 500 }
    );
  }
}
