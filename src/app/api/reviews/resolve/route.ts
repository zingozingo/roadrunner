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
  action: "skip" | "select" | "new";
  option_number?: number;
  engagement_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveRequest;
    const { review_id, action, option_number, engagement_name } = body;

    console.log("=== RESOLVE START ===");
    console.log("Request body:", JSON.stringify(body));

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

    console.log("Found approval:", {
      id: approval.id,
      message_id: approval.message_id,
      resolved: approval.resolved,
      options_count: approval.options_sent?.length ?? 0,
      options: approval.options_sent,
    });

    // Handle "skip"
    if (action === "skip") {
      await resolveApproval(review_id, "skipped");
      console.log("Approval skipped:", review_id);
      return NextResponse.json({ status: "skipped" });
    }

    // Handle "select" — pick a numbered option
    if (action === "select" && option_number != null) {
      const option = approval.options_sent?.find(
        (o) => o.number === option_number
      );
      if (!option) {
        console.error("Invalid option:", {
          option_number,
          available: approval.options_sent?.map((o) => o.number),
        });
        return NextResponse.json(
          { error: `Invalid option number ${option_number}. Available: ${approval.options_sent?.map((o) => o.number).join(", ") ?? "none"}` },
          { status: 400 }
        );
      }

      console.log("Selected option:", JSON.stringify(option));

      if (option.is_new) {
        // Create new engagement from the AI suggestion
        const engagement = await createEngagement({
          name: option.label,
          partner_name: classResult.engagement_match.partner_name,
          summary: classResult.current_state,
          current_state: classResult.current_state ?? null,
          open_items: (classResult.open_items ?? []).map((i) => ({ ...i, resolved: false })),
          tags: classResult.suggested_tags ?? [],
        });
        console.log("Created engagement:", engagement.id, engagement.name);

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

        console.log("=== RESOLVE DONE (created) ===");
        return NextResponse.json({
          status: "created",
          engagement: engagement,
        });
      }

      if (option.engagement_id) {
        // Assign to existing engagement
        await persistClassificationResult(
          classResult,
          option.engagement_id,
          approval.message_id ? [approval.message_id] : [],
          false
        );

        await resolveApproval(
          review_id,
          `assigned:${option.engagement_id}:${option.label}`
        );

        console.log("=== RESOLVE DONE (assigned) ===");
        return NextResponse.json({
          status: "assigned",
          engagement_id: option.engagement_id,
        });
      }

      // Edge case: option exists but is_new=false and engagement_id=null
      console.error("Option has no engagement_id and is not new:", option);
      return NextResponse.json(
        { error: "Option has no target engagement" },
        { status: 400 }
      );
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
        summary: classResult.current_state,
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

      console.log("=== RESOLVE DONE (new) ===");
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
    console.error("=== RESOLVE FAILED ===", message, stack);
    return NextResponse.json(
      { error: `Failed to resolve approval: ${message}` },
      { status: 500 }
    );
  }
}
