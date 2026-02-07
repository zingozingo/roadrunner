import { NextResponse } from "next/server";
import { getAllEventsWithCounts } from "@/lib/supabase";

export async function GET() {
  try {
    const events = await getAllEventsWithCounts();
    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
