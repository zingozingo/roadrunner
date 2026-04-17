import { NextRequest, NextResponse } from "next/server";
import { getMeeting, endMeetingSeries } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Resolve the series ID: if this is a child, use its series_id; if root, use its own id
    const seriesId = meeting.series_id ?? id;

    const today = new Date().toISOString().slice(0, 10);
    const updatedCount = await endMeetingSeries(seriesId, today);

    return NextResponse.json({ updated_count: updatedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/meetings/[id]/end-series error:", message);
    return NextResponse.json(
      { error: `Failed to end series: ${message}` },
      { status: 500 }
    );
  }
}
