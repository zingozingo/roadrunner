import { NextResponse } from "next/server";
import {
  getUnresolvedApprovals,
  getOrphanedMessages,
} from "@/lib/supabase";

export async function GET() {
  try {
    const [approvals, orphaned] = await Promise.all([
      getUnresolvedApprovals(),
      getOrphanedMessages(),
    ]);

    return NextResponse.json({ approvals, orphaned });
  } catch (error) {
    console.error("GET /api/inbox error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}
