#!/usr/bin/env npx tsx
/**
 * Backfill engagements: replay messages through synthesizeIntoEngagement
 * to produce current_state + condensed + pillar for all engagements.
 *
 * Groups messages by forwarded_at (5s window) and replays oldest-first.
 * Each pass evolves the current_state anchor, so the final pass produces
 * the complete state + condensed digest.
 *
 * Usage: npx tsx scripts/backfill-engagements.ts
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
  synthesizeIntoEngagement,
  persistClassificationResult,
  buildSyntheticPhase1Result,
} from "@/lib/classifier";
import type { Message } from "@/lib/types";

// ── Group messages by forwarded_at (5s window) ──────────────────
// Same logic as classifier.ts groupByForwardedAt (not exported)
function groupByForwardedAt(messages: Message[]): Message[][] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort(
    (a, b) =>
      new Date(a.forwarded_at).getTime() - new Date(b.forwarded_at).getTime()
  );

  const groups: Message[][] = [];
  let currentGroup: Message[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].forwarded_at).getTime();
    const currTime = new Date(sorted[i].forwarded_at).getTime();

    if (Math.abs(currTime - prevTime) <= 5000) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  groups.push(currentGroup);

  return groups;
}

async function main() {
  const db = getSupabaseClient();

  // Find all engagements missing condensed
  const { data: engagements, error } = await db
    .from("engagements")
    .select("id, name, partner_id, status")
    .is("condensed", null)
    .order("name");

  if (error) {
    console.error("Failed to query engagements:", error.message);
    process.exit(1);
  }

  if (!engagements || engagements.length === 0) {
    console.log("No engagements need backfill.");
    return;
  }

  console.log(`Found ${engagements.length} engagements needing backfill.\n`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let totalApiCalls = 0;

  for (let i = 0; i < engagements.length; i++) {
    const eng = engagements[i];
    const label = `[${i + 1}/${engagements.length}] ${eng.name}`;

    try {
      // Get partner name
      const { data: partner } = await db
        .from("partners")
        .select("name")
        .eq("id", eng.partner_id)
        .single();
      const partnerName = partner?.name ?? "Unknown Partner";

      // Fetch all messages for this engagement, ordered oldest first
      const { data: messages, error: msgErr } = await db
        .from("messages")
        .select("*")
        .eq("engagement_id", eng.id)
        .order("forwarded_at", { ascending: true });

      if (msgErr) throw new Error(`Message fetch failed: ${msgErr.message}`);

      if (!messages || messages.length === 0) {
        console.log(`${label} — SKIP (no messages)`);
        skipped++;
        continue;
      }

      // Group by forwarded_at (5s window)
      const groups = groupByForwardedAt(messages as Message[]);
      process.stdout.write(
        `${label} — replaying ${messages.length} msgs in ${groups.length} groups... `
      );

      // Replay each group sequentially (each evolves the current_state)
      for (let g = 0; g < groups.length; g++) {
        const group = groups[g];
        const messageIds = group.map((m) => m.id);
        const forwarderNote = group[0]?.forwarder_note ?? null;

        // Build synthetic Phase1Result for this replay
        const phase1 = buildSyntheticPhase1Result(
          eng.id,
          eng.partner_id,
          partnerName,
          false, // engagement exists
          eng.name
        );

        // Synthesize (reads current engagement state, evolves it)
        const result = await synthesizeIntoEngagement(
          group,
          phase1,
          forwarderNote
        );
        totalApiCalls++;

        // Persist (writes updated state back to engagement + messages)
        await persistClassificationResult(
          result,
          eng.id,
          messageIds,
          false
        );
      }

      console.log("done");
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${label} — FAILED: ${msg}`);
      failed++;
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped (no messages): ${skipped}`);
  console.log(`Total API calls: ${totalApiCalls}`);
  console.log(`Total engagements: ${engagements.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
