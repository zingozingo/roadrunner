import { NextRequest, NextResponse } from "next/server";
import { deleteParticipantLink } from "@/lib/supabase";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteParticipantLink(id);
    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/participant-links/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to remove participant: ${message}` },
      { status: 500 }
    );
  }
}
