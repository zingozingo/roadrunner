import { NextRequest, NextResponse } from "next/server";
import { deleteEngagementParticipant } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteEngagementParticipant(id);
    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/engagement-participants/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to remove participant: ${message}` },
      { status: 500 }
    );
  }
}
