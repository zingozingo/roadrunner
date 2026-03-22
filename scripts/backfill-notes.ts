#!/usr/bin/env npx tsx
/**
 * Backfill meeting notes: re-summarize notes that have ai_summary but no condensed digest.
 * Replicates the logic from /api/notes/[id]/summarize/route.ts.
 *
 * Usage: npx tsx scripts/backfill-notes.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local (outside Next.js runtime) ───────────────────
const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found — env vars must be set externally
}

import { getSupabaseClient } from "@/lib/db/client";
import {
  getMeetingNote,
  updateMeetingNote,
  deleteAiTasksForNote,
  createTask,
} from "@/lib/db";
import { buildMeetingNoteContext } from "@/lib/notes-context";
import { summarizeNotes } from "@/lib/notes-summarizer";

async function main() {
  const db = getSupabaseClient();

  // Find all notes with ai_summary but no condensed digest
  const { data: notes, error } = await db
    .from("meeting_notes")
    .select("id, title, partner_id")
    .not("ai_summary", "is", null)
    .is("condensed", null)
    .order("meeting_date", { ascending: true });

  if (error) {
    console.error("Failed to query meeting notes:", error.message);
    process.exit(1);
  }

  if (!notes || notes.length === 0) {
    console.log("No meeting notes need re-summarization.");
    return;
  }

  console.log(`Found ${notes.length} notes needing re-summarization.\n`);

  let succeeded = 0;
  let failed = 0;

  for (const { id, title } of notes) {
    const label = title || "(no title)";
    process.stdout.write(`[${succeeded + failed + 1}/${notes.length}] ${label}... `);

    try {
      // Fetch the full note with tasks
      const note = await getMeetingNote(id);
      if (!note) {
        console.log("SKIP (not found)");
        failed++;
        continue;
      }

      // Resolve engagement_id: note direct FK → meeting FK → null
      let engagementId: string | null = note.engagement_id ?? null;
      if (!engagementId && note.meeting_id) {
        const { data: meeting } = await db
          .from("meetings")
          .select("engagement_id")
          .eq("id", note.meeting_id)
          .single();
        engagementId =
          (meeting as { engagement_id: string | null } | null)
            ?.engagement_id ?? null;
      }

      // Build scoped context
      const formattedContext = await buildMeetingNoteContext(
        note.partner_id,
        engagementId
      );

      // Call AI summarizer
      const result = await summarizeNotes({
        rawNotes: note.raw_notes,
        partnerContext: formattedContext,
        noteType: note.note_type,
        meetingTitle: note.title ?? undefined,
        meetingDate: note.meeting_date ?? undefined,
        existingTasks: note.tasks?.map((t) => ({
          description: t.description,
          owner: t.owner,
          owner_name: t.owner_name,
        })),
      });

      // Persist results
      await updateMeetingNote(id, {
        ai_summary: result.summary,
        ai_tasks: result.tasks,
        condensed: result.condensed ?? null,
        context_snapshot: null,
        status: "complete",
      });

      // Re-materialize AI tasks (delete old, create new)
      await deleteAiTasksForNote(id);
      for (const task of result.tasks) {
        await createTask({
          meeting_note_id: id,
          partner_id: note.partner_id,
          description: task.description,
          owner: task.owner,
          owner_name: task.owner_name,
          due_date: task.due_date,
          origin: "ai_extracted",
        });
      }

      console.log(`done (${result.tasks.length} tasks)`);
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED: ${msg}`);
      failed++;
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${notes.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
