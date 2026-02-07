import { NextResponse } from "next/server";
import { getInitiativesWithMessageCounts } from "@/lib/supabase";

export async function GET() {
  try {
    const initiatives = await getInitiativesWithMessageCounts();
    return NextResponse.json({ initiatives });
  } catch (error) {
    console.error("GET /api/initiatives error:", error);
    return NextResponse.json(
      { error: "Failed to fetch initiatives" },
      { status: 500 }
    );
  }
}
