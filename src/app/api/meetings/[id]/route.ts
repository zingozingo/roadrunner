import { NextRequest, NextResponse } from "next/server";
import {
  getMeeting,
  updateMeeting,
  deleteMeeting,
} from "@/lib/db";

const VALID_STATUSES = new Set([
  "scheduled",
  "completed",
  "cancelled",
  "did_not_occur",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const meeting = await getMeeting(id);

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Resolve engagement name if linked
    let engagementName: string | null = null;
    if (meeting.engagement_id) {
      const { getEngagementById } = await import("@/lib/db");
      const eng = await getEngagementById(meeting.engagement_id);
      engagementName = eng?.name ?? null;
    }

    return NextResponse.json({ meeting, engagementName });
  } catch (error) {
    console.error("GET /api/meetings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, engagement_id, partner_name, status, meeting_date, start_time, end_time, location, notes, recurrence_pattern, recurrence_end, series_id, anchor_day, scope } = body;
    // scope: "this_one" (default) | "this_and_future" — for series-aware editing

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      );
    }

    if (status !== undefined && status !== null && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await getMeeting(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (engagement_id !== undefined) updates.engagement_id = engagement_id || null;
    if (partner_name !== undefined) {
      // Resolve partner_name to partner_id
      if (partner_name?.trim()) {
        const { getSupabaseClient } = await import("@/lib/db");
        const db = getSupabaseClient();
        const { data: partnerRows } = await db
          .from("partners")
          .select("id")
          .ilike("name", partner_name.trim())
          .limit(1);
        updates.partner_id = partnerRows?.[0]?.id ?? null;
      } else {
        updates.partner_id = null;
      }
    }
    if (status !== undefined) updates.status = status;
    if (meeting_date !== undefined) updates.meeting_date = meeting_date || null;
    if (start_time !== undefined) updates.start_time = start_time?.trim() || null;
    if (end_time !== undefined) updates.end_time = end_time?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (recurrence_pattern !== undefined) updates.recurrence_pattern = recurrence_pattern || null;
    if (recurrence_end !== undefined) updates.recurrence_end = recurrence_end || null;
    if (series_id !== undefined) updates.series_id = series_id || null;
    if (anchor_day !== undefined) updates.anchor_day = anchor_day;

    const updated = await updateMeeting(id, updates);

    // Scope-aware propagation: update future meetings in the series
    if (scope === "this_and_future" && existing.series_id) {
      const rootId = existing.series_id;
      const patternChanged = recurrence_pattern !== undefined || anchor_day !== undefined;

      if (patternChanged) {
        try {
          const { getSupabaseClient } = await import("@/lib/db");
          const { calculateNextDate } = await import("@/lib/meeting-recurrence");
          const db = getSupabaseClient();
          const today = new Date().toISOString().slice(0, 10);

          // Update series root with new pattern/anchor
          const rootUpdates: Record<string, unknown> = {};
          if (recurrence_pattern !== undefined) rootUpdates.recurrence_pattern = recurrence_pattern || null;
          if (anchor_day !== undefined) rootUpdates.anchor_day = anchor_day;
          if (recurrence_end !== undefined) rootUpdates.recurrence_end = recurrence_end || null;
          if (id !== rootId) {
            await updateMeeting(rootId, rootUpdates);
          }

          // Find future meetings in the series with no notes taken
          const { data: futureMeetings } = await db
            .from("meetings")
            .select("id, meeting_date")
            .eq("series_id", rootId)
            .gte("meeting_date", today)
            .neq("id", id)
            .order("meeting_date", { ascending: true });

          // Check which have no notes (safe to reschedule)
          if (futureMeetings && futureMeetings.length > 0) {
            const { data: notedMeetingIds } = await db
              .from("meeting_notes")
              .select("meeting_id")
              .in("meeting_id", futureMeetings.map((m) => m.id));
            const notedSet = new Set((notedMeetingIds ?? []).map((n: { meeting_id: string }) => n.meeting_id));

            const newPattern = (recurrence_pattern ?? existing.recurrence_pattern) as import("@/lib/types").RecurrencePattern;
            const newAnchor = anchor_day ?? existing.anchor_day ?? undefined;

            // Recalculate dates for unattended future meetings
            let prevDate = updated.meeting_date ?? existing.meeting_date ?? today;
            for (const fm of futureMeetings) {
              if (notedSet.has(fm.id)) {
                prevDate = fm.meeting_date;
                continue; // Skip meetings with notes
              }
              if (newPattern) {
                const nextDate = calculateNextDate(prevDate, newPattern, newAnchor);
                await updateMeeting(fm.id, {
                  meeting_date: nextDate,
                  recurrence_pattern: newPattern,
                  anchor_day: newAnchor ?? null,
                });
                prevDate = nextDate;
              }
            }
          }
        } catch (err) {
          console.error(`Scope propagation failed for series ${rootId}:`, err);
        }
      }
    }

    // Push meeting to Airtable on every update (status, title, date, etc.)
    try {
      const { pushMeetingToAirtable } = await import("@/lib/sync");
      await pushMeetingToAirtable(id);
    } catch (err) {
      console.error(`Airtable push failed for meeting ${id}:`, err);
    }

    // Engagement-specific side effects: only when engagement link changes
    if (engagement_id !== undefined) {
      // Re-synthesize engagement activity summary when linked (not unlinked)
      if (engagement_id) {
        try {
          const { pushEngagementToAirtable } = await import("@/lib/sync");
          await pushEngagementToAirtable(engagement_id);
          console.log(`Engagement activity summary refreshed for ${engagement_id} after meeting link`);
        } catch (err) {
          console.error(`Engagement sync failed for ${engagement_id}:`, err);
        }
      }

      // Cascade engagement_id to tasks from this meeting's notes
      try {
        const { cascadeEngagementToTasks } = await import("@/lib/db");
        await cascadeEngagementToTasks(id, engagement_id || null, existing.engagement_id);
      } catch (err) {
        console.error(`Task cascade failed for meeting ${id}:`, err);
      }
    }

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/meetings/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update meeting: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getMeeting(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    await deleteMeeting(id);

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/meetings/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete meeting: ${message}` },
      { status: 500 }
    );
  }
}
