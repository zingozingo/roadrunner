import { NextRequest, NextResponse } from "next/server";
import { getMeetingsWithEngagements, createMeeting, resolvePartnerByName } from "@/lib/db";
import { getOverdueRecurringMeetings, spawnNextOccurrence } from "@/lib/meeting-recurrence";
import { VALID_MEETING_STATUSES, VALID_RECURRENCE_PATTERNS, validateEnum } from "@/lib/validation";

export async function GET() {
  try {
    // Best-effort: spawn next occurrences for overdue recurring meetings
    try {
      const overdue = await getOverdueRecurringMeetings();
      await Promise.all(overdue.map((m) => spawnNextOccurrence(m)));
    } catch (err) {
      console.error("Auto-spawn recurring meetings failed:", err);
    }

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
    const { title, engagement_id, partner_id: rawPartnerId, partner_name, meeting_type, status, meeting_date, start_time, end_time, location, attendees, notes, recurrence_pattern, recurrence_end, anchor_day } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (status) {
      const err = validateEnum("status", status, VALID_MEETING_STATUSES);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    if (attendees !== undefined && !Array.isArray(attendees)) {
      return NextResponse.json(
        { error: "Attendees must be an array" },
        { status: 400 }
      );
    }

    if (recurrence_pattern) {
      const err = validateEnum("recurrence_pattern", recurrence_pattern, VALID_RECURRENCE_PATTERNS);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    if (recurrence_end !== undefined && recurrence_end !== null) {
      const parsed = Date.parse(recurrence_end);
      if (isNaN(parsed)) {
        return NextResponse.json(
          { error: "recurrence_end must be a valid date string" },
          { status: 400 }
        );
      }
    }

    // Resolve partner: prefer direct partner_id, fall back to name lookup
    let partner_id: string | null = rawPartnerId || null;
    if (!partner_id && partner_name?.trim()) {
      partner_id = await resolvePartnerByName(partner_name);
    }

    const meeting = await createMeeting({
      title: title.trim(),
      engagement_id: engagement_id || null,
      partner_id,
      status: status || "scheduled",
      meeting_date: meeting_date || null,
      start_time: start_time?.trim() || null,
      end_time: end_time?.trim() || null,
      location: location?.trim() || null,
      attendees: attendees ?? [],
      meeting_type: meeting_type?.trim() || null,
      notes: notes?.trim() || null,
      source: "manual",
      recurrence_pattern: recurrence_pattern || null,
      recurrence_end: recurrence_end || null,
      anchor_day: typeof anchor_day === "number" ? anchor_day : null,
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
