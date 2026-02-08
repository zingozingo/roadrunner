import { NextResponse } from "next/server";
import { getUnresolvedApprovalCount } from "@/lib/supabase";

export async function GET() {
  try {
    const count = await getUnresolvedApprovalCount();
    return NextResponse.json({ count });
  } catch (error) {
    console.error("GET /api/inbox/count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
