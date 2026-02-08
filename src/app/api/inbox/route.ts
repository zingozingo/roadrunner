import { NextResponse } from "next/server";
import {
  getUnresolvedReviewsWithMessages,
  getOrphanedMessages,
  getUnresolvedEventApprovals,
} from "@/lib/supabase";

export async function GET() {
  try {
    const [reviews, orphaned, eventApprovals] = await Promise.all([
      getUnresolvedReviewsWithMessages(),
      getOrphanedMessages(),
      getUnresolvedEventApprovals(),
    ]);

    return NextResponse.json({ reviews, orphaned, eventApprovals });
  } catch (error) {
    console.error("GET /api/inbox error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}
