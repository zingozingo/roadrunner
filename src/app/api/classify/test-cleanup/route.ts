import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

// Match all rows — Supabase requires a filter on delete
const ALL = ["id", "00000000-0000-0000-0000-000000000000"] as const;

/**
 * DELETE /api/classify/test-cleanup
 * Wipes all application data except events and programs.
 * Intended for clearing test data from the /test page.
 */
export async function DELETE() {
  try {
    const db = getSupabaseClient();
    const counts: Record<string, number> = {};

    // Order matters — respect FK constraints

    // 1. approval_queue (references messages + engagements)
    const { data: aq } = await db.from("approval_queue").delete().gte(...ALL).select("id");
    counts.approval_queue = aq?.length ?? 0;

    // 2. participant_links (polymorphic, no FK cascade)
    const { data: pl } = await db.from("participant_links").delete().gte(...ALL).select("id");
    counts.participant_links = pl?.length ?? 0;

    // 3. entity_links (polymorphic, no FK cascade)
    const { data: el } = await db.from("entity_links").delete().gte(...ALL).select("id");
    counts.entity_links = el?.length ?? 0;

    // 4. notes (FK to engagements)
    const { data: notes } = await db.from("notes").delete().gte(...ALL).select("id");
    counts.notes = notes?.length ?? 0;

    // 5. messages (FK to engagements)
    const { data: msgs } = await db.from("messages").delete().gte(...ALL).select("id");
    counts.messages = msgs?.length ?? 0;

    // 6. engagements
    const { data: engs } = await db.from("engagements").delete().gte(...ALL).select("id");
    counts.engagements = engs?.length ?? 0;

    // 7. participants (no longer linked to anything)
    const { data: parts } = await db.from("participants").delete().gte(...ALL).select("id");
    counts.participants = parts?.length ?? 0;

    return NextResponse.json({ deleted: counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/classify/test-cleanup error:", message);
    return NextResponse.json(
      { error: `Failed to clean up test data: ${message}` },
      { status: 500 }
    );
  }
}
