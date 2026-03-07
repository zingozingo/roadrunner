import { NextRequest, NextResponse } from "next/server";
import { buildPartnerContext, formatContextForDisplay } from "@/lib/notes-context";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const { partnerId } = await params;
    const context = await buildPartnerContext(partnerId);
    const display = formatContextForDisplay(context);
    return NextResponse.json(display);
  } catch (error) {
    console.error("GET /api/notes/context/[partnerId] error:", error);
    return NextResponse.json(
      { error: "Failed to load partner context" },
      { status: 500 }
    );
  }
}
