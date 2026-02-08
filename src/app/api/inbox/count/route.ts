import { NextResponse } from "next/server";
import {
  getUnresolvedReviewCount,
  getUnresolvedEventApprovalCount,
} from "@/lib/supabase";

export async function GET() {
  try {
    const [reviewCount, eventApprovalCount] = await Promise.all([
      getUnresolvedReviewCount(),
      getUnresolvedEventApprovalCount(),
    ]);

    return NextResponse.json({ count: reviewCount + eventApprovalCount });
  } catch (error) {
    console.error("GET /api/inbox/count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
