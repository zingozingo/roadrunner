import { NextResponse } from "next/server";
import { getRelationshipsWithCounts } from "@/lib/db";

export async function GET() {
  try {
    const relationships = await getRelationshipsWithCounts();
    return NextResponse.json({ relationships });
  } catch (error) {
    console.error("GET /api/relationships error:", error);
    return NextResponse.json(
      { error: "Failed to fetch relationships" },
      { status: 500 }
    );
  }
}
