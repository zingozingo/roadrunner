import { NextResponse } from "next/server";
import { getAwsRelationshipsWithCounts } from "@/lib/db";

export async function GET() {
  try {
    const relationships = await getAwsRelationshipsWithCounts();
    return NextResponse.json({ relationships });
  } catch (error) {
    console.error("GET /api/relationships error:", error);
    return NextResponse.json(
      { error: "Failed to fetch relationships" },
      { status: 500 }
    );
  }
}
