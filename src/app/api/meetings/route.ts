import { NextRequest, NextResponse } from "next/server";
import { getMeetingsWithEngagements, createMeeting } from "@/lib/db";

const VALID_STATUSES = new Set([
  "scheduled",
  "completed",
  "cancelled",
  "did_not_occur",
]);

export async function GET() {
  try {
    const meetings = await getMeetingsWithEngagements();
    return NextResponse.json({ meetings });
  } catch (error) {
    console.error("GET /api/meetings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, engagement_id, event_id, program_id, partner_name, status, meeting_date, start_time, end_time, location, attendees, notes } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(", ")}` },
        { status: 400 }
      );
    }

    if (attendees !== undefined && !Array.isArray(attendees)) {
      return NextResponse.json(
        { error: "Attendees must be an array" },
        { status: 400 }
      );
    }

    const meeting = await createMeeting({
      title: title.trim(),
      engagement_id: engagement_id || null,
      event_id: event_id || null,
      program_id: program_id || null,
      partner_name: partner_name?.trim() || null,
      status: status || "scheduled",
      meeting_date: meeting_date || null,
      start_time: start_time?.trim() || null,
      end_time: end_time?.trim() || null,
      location: location?.trim() || null,
      attendees: attendees ?? [],
      notes: notes?.trim() || null,
      source: "manual",
    });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/meetings error:", message);
    return NextResponse.json(
      { error: `Failed to create meeting: ${message}` },
      { status: 500 }
    );
  }
}
