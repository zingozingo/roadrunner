#!/usr/bin/env npx tsx
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

// ── Supabase client ─────────────────────────────────────────────
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

// ── Types for seed JSON ─────────────────────────────────────────
interface SeedEvent {
  name: string;
  type: string;
  start_date?: string | null;
  end_date?: string | null;
  host?: string | null;
  location?: string | null;
  description?: string | null;
}

interface SeedProgram {
  name: string;
  description?: string | null;
  eligibility?: string | null;
  url?: string | null;
  lifecycle_type?: "indefinite" | "recurring" | "expiring";
  lifecycle_duration?: string | null;
}

interface SeedFile {
  events?: SeedEvent[];
  programs?: SeedProgram[];
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run seed -- <path-to-json>");
    process.exit(1);
  }

  const absolutePath = resolve(process.cwd(), filePath);
  let data: SeedFile;
  try {
    data = JSON.parse(readFileSync(absolutePath, "utf-8"));
  } catch (err) {
    console.error(`Failed to read/parse ${absolutePath}:`, err);
    process.exit(1);
  }

  const events = data.events ?? [];
  const programs = data.programs ?? [];

  if (events.length === 0 && programs.length === 0) {
    console.log("Nothing to seed — JSON has no events or programs.");
    return;
  }

  let insertedEvents = 0;
  let insertedPrograms = 0;
  let skipped = 0;

  // ── Seed events ───────────────────────────────────────────────
  if (events.length > 0) {
    console.log(`\nSeeding ${events.length} events...`);

    const { data: existing } = await supabase
      .from("events")
      .select("name");
    const existingNames = new Set(
      (existing ?? []).map((e: { name: string }) => e.name.toLowerCase())
    );

    for (const event of events) {
      if (existingNames.has(event.name.toLowerCase())) {
        console.log(`  Skipped (duplicate): ${event.name}`);
        skipped++;
        continue;
      }

      const { error } = await supabase.from("events").insert({
        name: event.name,
        type: event.type,
        start_date: event.start_date ?? null,
        end_date: event.end_date ?? null,
        host: event.host ?? null,
        location: event.location ?? null,
        description: event.description ?? null,
        source: "seed",
        verified: true,
      });

      if (error) {
        console.error(`  ERROR inserting event "${event.name}": ${error.message}`);
      } else {
        console.log(`  Inserted event: ${event.name}`);
        existingNames.add(event.name.toLowerCase());
        insertedEvents++;
      }
    }
  }

  // ── Seed programs ─────────────────────────────────────────────
  if (programs.length > 0) {
    console.log(`\nSeeding ${programs.length} programs...`);

    const { data: existing } = await supabase
      .from("programs")
      .select("name");
    const existingNames = new Set(
      (existing ?? []).map((p: { name: string }) => p.name.toLowerCase())
    );

    for (const program of programs) {
      if (existingNames.has(program.name.toLowerCase())) {
        console.log(`  Skipped (duplicate): ${program.name}`);
        skipped++;
        continue;
      }

      const { error } = await supabase.from("programs").insert({
        name: program.name,
        description: program.description ?? null,
        eligibility: program.eligibility ?? null,
        url: program.url ?? null,
        status: "active",
        lifecycle_type: program.lifecycle_type ?? "indefinite",
        lifecycle_duration: program.lifecycle_duration ?? null,
      });

      if (error) {
        console.error(`  ERROR inserting program "${program.name}": ${error.message}`);
      } else {
        console.log(`  Inserted program: ${program.name}`);
        existingNames.add(program.name.toLowerCase());
        insertedPrograms++;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log(
    `\nInserted ${insertedEvents} events, ${insertedPrograms} programs. Skipped ${skipped} duplicates.`
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
