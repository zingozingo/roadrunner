import { NextResponse } from "next/server";
import { processUnclassifiedMessages } from "@/lib/classifier";
import { getUnclassifiedMessages } from "@/lib/supabase";

/**
 * POST /api/classify
 * Trigger batch classification of all unclassified messages.
 */
export async function POST() {
  try {
    const result = await processUnclassifiedMessages();

    return NextResponse.json({
      message: "Classification complete",
      ...result,
    });
  } catch (error) {
    console.error("Batch classification error:", error);
    return NextResponse.json(
      {
        error: "Classification failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/classify
 * Return the current classification queue status.
 */
export async function GET() {
  try {
    const unclassified = await getUnclassifiedMessages();

    return NextResponse.json({
      queue_size: unclassified.length,
      messages: unclassified.map((m) => ({
        id: m.id,
        subject: m.subject,
        sender: m.sender_email,
        forwarded_at: m.forwarded_at,
      })),
    });
  } catch (error) {
    console.error("Classification status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue status" },
      { status: 500 }
    );
  }
}
