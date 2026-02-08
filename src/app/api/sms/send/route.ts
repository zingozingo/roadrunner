import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { sendClassificationPrompt } from "@/lib/sms";
import { getActiveInitiatives } from "@/lib/supabase";
import type { Message, ApprovalQueueItem } from "@/lib/types";

/**
 * POST /api/sms/send
 * Manually trigger or resend an SMS for a pending approval.
 * Body: { review_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { review_id } = await request.json();

    if (!review_id) {
      return NextResponse.json(
        { error: "review_id is required" },
        { status: 400 }
      );
    }

    const db = getSupabaseClient();

    // Fetch the approval
    const { data: row, error: reviewError } = await db
      .from("approval_queue")
      .select("*")
      .eq("id", review_id)
      .eq("type", "initiative_assignment")
      .single();

    if (reviewError || !row) {
      return NextResponse.json(
        { error: "Pending approval not found" },
        { status: 404 }
      );
    }

    const approval = row as ApprovalQueueItem;

    if (approval.resolved) {
      return NextResponse.json(
        { error: "Approval is already resolved" },
        { status: 400 }
      );
    }

    // Fetch the associated message
    const { data: message, error: msgError } = await db
      .from("messages")
      .select("*")
      .eq("id", approval.message_id!)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { error: "Associated message not found" },
        { status: 404 }
      );
    }

    const initiatives = await getActiveInitiatives();

    const { sid, options } = await sendClassificationPrompt(
      message as Message,
      approval.classification_result!,
      initiatives
    );

    // Update the approval with SMS info
    await db
      .from("approval_queue")
      .update({
        sms_sent: true,
        sms_sent_at: new Date().toISOString(),
        options_sent: options,
      })
      .eq("id", review_id);

    return NextResponse.json({
      message: "SMS sent",
      sid,
      options,
    });
  } catch (error) {
    console.error("SMS send error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
