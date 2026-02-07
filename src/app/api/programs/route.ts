import { NextResponse } from "next/server";
import { getAllProgramsWithCounts } from "@/lib/supabase";

export async function GET() {
  try {
    const programs = await getAllProgramsWithCounts();
    return NextResponse.json({ programs });
  } catch (error) {
    console.error("GET /api/programs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch programs" },
      { status: 500 }
    );
  }
}
