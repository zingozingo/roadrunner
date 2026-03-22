#!/usr/bin/env npx tsx
/**
 * Backfill partner brains: re-synthesize all partners with the new
 * structured 4-section executive briefing (Phase 5 prompt).
 *
 * Calls saveAndSynthesize for each partner, which:
 * 1. Builds context via buildBrainContext (condensed digests, scratchpad, patterns)
 * 2. Calls Claude for structured briefing
 * 3. Deletes old ai_synthesis entry
 * 4. Inserts new ai_synthesis entry
 *
 * Usage: npx tsx scripts/backfill-brains.ts
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
import { saveAndSynthesize } from "@/lib/brain-synthesizer";

async function main() {
  const db = getSupabaseClient();

  const { data: partners, error } = await db
    .from("partners")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Failed to query partners:", error.message);
    process.exit(1);
  }

  if (!partners || partners.length === 0) {
    console.log("No partners found.");
    return;
  }

  console.log(`Found ${partners.length} partners to synthesize.\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < partners.length; i++) {
    const p = partners[i];
    process.stdout.write(`[${i + 1}/${partners.length}] ${p.name}... `);

    try {
      await saveAndSynthesize(p.id);
      console.log("done");
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
  console.log(`Total: ${partners.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
