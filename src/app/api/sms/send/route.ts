import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { sendClassificationPrompt } from "@/lib/sms";
import { getActiveInitiatives } from "@/lib/supabase";
import type { Message, PendingReview } from "@/lib/types";

/**
 * POST /api/sms/send
 * Manually trigger or resend an SMS for a pending review.
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

    // Fetch the pending review
    const { data: review, error: reviewError } = await db
      .from("pending_reviews")
      .select("*")
      .eq("id", review_id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: "Pending review not found" },
        { status: 404 }
      );
    }

    const pendingReview = review as PendingReview;

    if (pendingReview.resolved) {
      return NextResponse.json(
        { error: "Review is already resolved" },
        { status: 400 }
      );
    }

    // Fetch the associated message
    const { data: message, error: msgError } = await db
      .from("messages")
      .select("*")
      .eq("id", pendingReview.message_id)
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
      pendingReview.classification_result,
      initiatives
    );

    // Update the review with SMS info
    await db
      .from("pending_reviews")
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
