import { NextResponse } from "next/server";
import {
  getUnresolvedReviewsWithMessages,
  getOrphanedMessages,
} from "@/lib/supabase";

export async function GET() {
  try {
    const [reviews, orphaned] = await Promise.all([
      getUnresolvedReviewsWithMessages(),
      getOrphanedMessages(),
    ]);

    return NextResponse.json({ reviews, orphaned });
  } catch (error) {
    console.error("GET /api/inbox error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}
