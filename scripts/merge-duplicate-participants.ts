/**
 * One-time script: merge duplicate participant records.
 *
 * For each pair, moves all FK references from the duplicate to the canonical record,
 * skipping any that would violate unique constraints, then deletes the duplicate.
 *
 * Usage: npx tsx scripts/merge-duplicate-participants.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local (outside Next.js runtime)
const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found — env vars must be set externally */ }

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const db = createClient(url, key);

// Duplicate pairs: [canonical email, duplicate email]
const MERGE_PAIRS = [
  { keepEmail: "j.spiers@cloudaware.com", dropEmail: "jspiers@cloudaware.com", name: "Jordan Spiers" },
  { keepEmail: "ronzeaud@amazon.com", dropEmail: "ronzeaud@amazon.ch", name: "Sebastien Ronzeaud" },
];

const JOIN_TABLES = [
  "partner_participants",
  "engagement_participants",
  "meeting_participants",
  "relationship_participants",
] as const;

async function mergeParticipant(keepEmail: string, dropEmail: string, name: string) {
  console.log(`\n--- Merging ${name} ---`);
  console.log(`  Keep: ${keepEmail}`);
  console.log(`  Drop: ${dropEmail}`);

  // Find both records
  const { data: keepRecord } = await db
    .from("participants")
    .select("id, name, email")
    .eq("email", keepEmail)
    .single();

  const { data: dropRecord } = await db
    .from("participants")
    .select("id, name, email")
    .eq("email", dropEmail)
    .single();

  if (!keepRecord) {
    console.log(`  ERROR: canonical record ${keepEmail} not found`);
    return;
  }
  if (!dropRecord) {
    console.log(`  WARNING: duplicate record ${dropEmail} not found — already merged?`);
    return;
  }

  console.log(`  Keep ID: ${keepRecord.id}`);
  console.log(`  Drop ID: ${dropRecord.id}`);

  // For each join table, move references from drop → keep
  for (const table of JOIN_TABLES) {
    // Find all references from the duplicate
    const { data: refs } = await db
      .from(table)
      .select("*")
      .eq("participant_id", dropRecord.id);

    if (!refs || refs.length === 0) {
      console.log(`  ${table}: no references to move`);
      continue;
    }

    console.log(`  ${table}: ${refs.length} reference(s) to move`);

    for (const ref of refs) {
      // Try to update to the canonical participant
      const { error: updateErr } = await db
        .from(table)
        .update({ participant_id: keepRecord.id })
        .eq("id", ref.id);

      if (updateErr) {
        if (updateErr.code === "23505") {
          // Unique constraint violation — canonical already has this link, just delete the duplicate ref
          console.log(`    Conflict on ${table} id=${ref.id} — deleting duplicate ref`);
          await db.from(table).delete().eq("id", ref.id);
        } else {
          console.log(`    ERROR updating ${table} id=${ref.id}: ${updateErr.message}`);
        }
      } else {
        console.log(`    Moved ${table} id=${ref.id}`);
      }
    }
  }

  // Also check messages table for sender references
  const { data: msgs } = await db
    .from("messages")
    .select("id")
    .eq("sender_email", dropEmail);

  if (msgs && msgs.length > 0) {
    console.log(`  messages: updating ${msgs.length} sender_email reference(s)`);
    await db
      .from("messages")
      .update({ sender_email: keepEmail })
      .eq("sender_email", dropEmail);
  }

  // Delete the duplicate participant
  const { error: deleteErr } = await db
    .from("participants")
    .delete()
    .eq("id", dropRecord.id);

  if (deleteErr) {
    console.log(`  ERROR deleting duplicate: ${deleteErr.message}`);
  } else {
    console.log(`  Deleted duplicate ${dropRecord.id}`);
  }
}

async function main() {
  console.log("=== Duplicate Participant Merge ===\n");

  for (const pair of MERGE_PAIRS) {
    await mergeParticipant(pair.keepEmail, pair.dropEmail, pair.name);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
