import { NextResponse } from "next/server";
import { getEngagementsWithMessageCounts } from "@/lib/supabase";

export async function GET() {
  try {
    const engagements = await getEngagementsWithMessageCounts();
    return NextResponse.json({ engagements });
  } catch (error) {
    console.error("GET /api/engagements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagements" },
      { status: 500 }
    );
  }
}
