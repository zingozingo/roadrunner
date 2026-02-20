import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseClient,
  resolveApproval,
  createEngagement,
} from "@/lib/supabase";
import { persistClassificationResult } from "@/lib/classifier";
import { ApprovalQueueItem } from "@/lib/types";

interface ResolveRequest {
  review_id: string;
  action: "skip" | "new";
  engagement_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveRequest;
    const { review_id, action, engagement_name } = body;

    if (!review_id || !action) {
      return NextResponse.json(
        { error: "review_id and action are required" },
        { status: 400 }
      );
    }

    // Fetch the approval by ID
    const { data: row, error: fetchError } = await getSupabaseClient()
      .from("approval_queue")
      .select("*")
      .eq("id", review_id)
      .maybeSingle();

    if (fetchError) {
      console.error("Approval fetch error:", fetchError.message, fetchError.code);
      return NextResponse.json(
        { error: `Database error fetching approval: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!row) {
      console.error("No approval found with id:", review_id);
      return NextResponse.json(
        { error: `No approval found with id ${review_id}` },
        { status: 404 }
      );
    }

    const approval = row as ApprovalQueueItem;

    if (approval.resolved) {
      console.warn("Approval already resolved:", review_id, approval.resolution);
      return NextResponse.json(
        { error: "This approval has already been resolved" },
        { status: 409 }
      );
    }

    const classResult = approval.classification_result!;

    // Handle "skip"
    if (action === "skip") {
      await resolveApproval(review_id, "skipped");
      return NextResponse.json({ status: "skipped" });
    }

    // Handle "new" — create engagement with user-provided name
    if (action === "new") {
      const name = engagement_name?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "engagement_name is required for action 'new'" },
          { status: 400 }
        );
      }

      const engagement = await createEngagement({
        name,
        partner_name: classResult.engagement_match.partner_name,
        current_state: classResult.current_state ?? null,
        open_items: (classResult.open_items ?? []).map((i) => ({ ...i, resolved: false })),
        tags: classResult.suggested_tags ?? [],
      });

      await persistClassificationResult(
        classResult,
        engagement.id,
        approval.message_id ? [approval.message_id] : [],
        true
      );

      await resolveApproval(
        review_id,
        `created:${engagement.id}:${engagement.name}`
      );

      return NextResponse.json({
        status: "created",
        engagement: engagement,
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    console.error("Resolve approval failed:", message, stack);
    return NextResponse.json(
      { error: `Failed to resolve approval: ${message}` },
      { status: 500 }
    );
  }
}
