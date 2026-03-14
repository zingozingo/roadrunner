#!/usr/bin/env npx tsx
/**
 * One-time hydration script: populate the contact registry tables
 * (participants, partner_participants, relationship_participants)
 * from existing JSONB contact data on partners and relationships.
 *
 * Run: npx tsx scripts/hydrate-contact-registry.ts
 * Idempotent — safe to run multiple times (upsert logic).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
const db = createClient(url, key);

// ── Types ───────────────────────────────────────────────────────

interface JsContact {
  name: string | null;
  email: string | null;
  title: string | null;
  role: string;
}

interface Partner {
  id: string;
  name: string;
  aws_team: JsContact[];
  partner_contacts: JsContact[];
}

interface Relationship {
  id: string;
  name: string;
  contacts: JsContact[];
}

// ── Counters ────────────────────────────────────────────────────

let participantsCreated = 0;
let participantsUpdated = 0;
let partnerParticipantsCreated = 0;
let relationshipParticipantsCreated = 0;
const skippedContacts: { name: string | null; reason: string; context: string }[] = [];

// ── Helpers ─────────────────────────────────────────────────────

const PLACEHOLDER_EMAILS = new Set(["—", "-", "–", "", "null", "n/a", "N/A"]);

function isValidEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  if (PLACEHOLDER_EMAILS.has(email)) return false;
  return email.includes("@");
}

function isAmazonEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain === "amazon.com" || domain === "amazon.co.uk" || domain === "amazon.de";
}

/**
 * Upsert a participant by email. Returns the participant id.
 * If the participant already exists, updates org_type and source if they're null.
 */
async function upsertParticipant(
  email: string,
  name: string | null,
  title: string | null,
  organization: string | null,
  orgType: "internal" | "partner" | "third_party",
  source: string
): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if already exists
  const { data: existing } = await db
    .from("participants")
    .select("id, org_type, source, name, title, organization")
    .eq("email", normalizedEmail)
    .limit(1);

  if (existing && existing.length > 0) {
    const row = existing[0];
    const updates: Record<string, string | null> = {};

    // Fill in missing fields — don't overwrite existing data
    if (!row.org_type) updates.org_type = orgType;
    if (!row.source) updates.source = source;
    if (!row.name && name) updates.name = name;
    if (!row.title && title) updates.title = title;
    if (!row.organization && organization) updates.organization = organization;

    // If org_type was already set but different, prefer our hydration value
    // (the 7 legacy participants have null org_type, so this mostly fills blanks)
    if (row.org_type === null && orgType) updates.org_type = orgType;

    if (Object.keys(updates).length > 0) {
      await db.from("participants").update(updates).eq("id", row.id);
      participantsUpdated++;
    }

    return row.id;
  }

  // Insert new
  const { data: inserted, error } = await db
    .from("participants")
    .insert({
      email: normalizedEmail,
      name,
      title,
      organization,
      org_type: orgType,
      source,
    })
    .select("id")
    .single();

  if (error) {
    // Handle race condition on UNIQUE constraint
    if (error.code === "23505") {
      const { data: retry } = await db
        .from("participants")
        .select("id")
        .eq("email", normalizedEmail)
        .single();
      if (retry) return retry.id;
    }
    throw new Error(`Failed to insert participant ${normalizedEmail}: ${error.message}`);
  }

  participantsCreated++;
  return inserted.id;
}

/**
 * Create a partner_participants join row. Skips if already exists (UNIQUE constraint).
 */
async function linkPartnerParticipant(
  partnerId: string,
  participantId: string,
  role: string | null
): Promise<void> {
  const { error } = await db.from("partner_participants").insert({
    partner_id: partnerId,
    participant_id: participantId,
    role,
  });

  if (error) {
    // 23505 = unique_violation — already linked, skip
    if (error.code === "23505") return;
    throw new Error(`Failed to link partner_participant: ${error.message}`);
  }
  partnerParticipantsCreated++;
}

/**
 * Create a relationship_participants join row. Skips if already exists.
 */
async function linkRelationshipParticipant(
  relationshipId: string,
  participantId: string,
  role: string | null
): Promise<void> {
  const { error } = await db.from("relationship_participants").insert({
    relationship_id: relationshipId,
    participant_id: participantId,
    role,
  });

  if (error) {
    if (error.code === "23505") return;
    throw new Error(`Failed to link relationship_participant: ${error.message}`);
  }
  relationshipParticipantsCreated++;
}

// ── Main hydration ──────────────────────────────────────────────

async function hydratePartners(): Promise<void> {
  const { data: partners, error } = await db
    .from("partners")
    .select("id, name, aws_team, partner_contacts");

  if (error) throw new Error(`Failed to fetch partners: ${error.message}`);
  if (!partners || partners.length === 0) {
    console.log("No partners found.");
    return;
  }

  console.log(`\nProcessing ${partners.length} partners...`);

  for (const partner of partners as Partner[]) {
    // Process aws_team (internal AWS contacts)
    for (const contact of partner.aws_team ?? []) {
      if (!isValidEmail(contact.email)) {
        skippedContacts.push({
          name: contact.name,
          reason: contact.email ? `invalid email: "${contact.email}"` : "no email",
          context: `${partner.name} → aws_team (${contact.role})`,
        });
        continue;
      }

      const participantId = await upsertParticipant(
        contact.email!,
        contact.name,
        contact.title,
        "Amazon Web Services",
        "internal",
        "airtable_sync"
      );
      await linkPartnerParticipant(partner.id, participantId, contact.role);
    }

    // Process partner_contacts (partner-side contacts)
    for (const contact of partner.partner_contacts ?? []) {
      if (!isValidEmail(contact.email)) {
        skippedContacts.push({
          name: contact.name,
          reason: contact.email ? `invalid email: "${contact.email}"` : "no email",
          context: `${partner.name} → partner_contacts (${contact.role})`,
        });
        continue;
      }

      // Determine organization: use partner name for partner-side contacts
      const organization = partner.name;
      const orgType = isAmazonEmail(contact.email!) ? "internal" as const : "partner" as const;

      const participantId = await upsertParticipant(
        contact.email!,
        contact.name,
        contact.title,
        organization,
        orgType,
        "airtable_sync"
      );
      await linkPartnerParticipant(partner.id, participantId, contact.role);
    }
  }
}

async function hydrateRelationships(): Promise<void> {
  const { data: relationships, error } = await db
    .from("relationships")
    .select("id, name, contacts");

  if (error) throw new Error(`Failed to fetch relationships: ${error.message}`);
  if (!relationships || relationships.length === 0) {
    console.log("No relationships found.");
    return;
  }

  console.log(`Processing ${relationships.length} relationships...`);

  for (const rel of relationships as Relationship[]) {
    for (const contact of rel.contacts ?? []) {
      if (!isValidEmail(contact.email)) {
        skippedContacts.push({
          name: contact.name,
          reason: contact.email ? `invalid email: "${contact.email}"` : "no email",
          context: `${rel.name} → contacts (${contact.role})`,
        });
        continue;
      }

      // All current relationships are internal AWS teams
      const orgType = isAmazonEmail(contact.email!) ? "internal" as const : "third_party" as const;

      const participantId = await upsertParticipant(
        contact.email!,
        contact.name,
        contact.title,
        null, // organization not reliably known from relationship contacts
        orgType,
        "airtable_sync"
      );
      await linkRelationshipParticipant(rel.id, participantId, contact.role);
    }
  }
}

async function backfillLegacyParticipants(): Promise<void> {
  console.log("Backfilling legacy participants (org_type + source)...");

  // Fetch participants with null org_type
  const { data: participants, error } = await db
    .from("participants")
    .select("id, email, org_type, source")
    .is("org_type", null);

  if (error) throw new Error(`Failed to fetch participants: ${error.message}`);
  if (!participants || participants.length === 0) {
    console.log("  No participants need backfill.");
    return;
  }

  for (const p of participants) {
    if (!p.email) continue;

    const orgType = isAmazonEmail(p.email) ? "internal" : "partner";
    const updates: Record<string, string> = { org_type: orgType };
    if (!p.source) updates.source = "classifier";

    await db.from("participants").update(updates).eq("id", p.id);
    participantsUpdated++;
    console.log(`  Backfilled: ${p.email} → org_type=${orgType}`);
  }
}

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Contact Registry Hydration");
  console.log("═══════════════════════════════════════════════════");

  await hydratePartners();
  await hydrateRelationships();
  await backfillLegacyParticipants();

  // Print summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Participants created:              ${participantsCreated}`);
  console.log(`  Participants updated:              ${participantsUpdated}`);
  console.log(`  Partner_participants rows created:  ${partnerParticipantsCreated}`);
  console.log(`  Relationship_participants created:  ${relationshipParticipantsCreated}`);

  if (skippedContacts.length > 0) {
    console.log(`\n  Skipped contacts (${skippedContacts.length}):`);
    for (const s of skippedContacts) {
      console.log(`    - ${s.name ?? "(no name)"} — ${s.reason} [${s.context}]`);
    }
  }

  // Verification counts
  const [{ count: pCount }, { count: ppCount }, { count: rpCount }] = await Promise.all([
    db.from("participants").select("id", { count: "exact", head: true }),
    db.from("partner_participants").select("id", { count: "exact", head: true }),
    db.from("relationship_participants").select("id", { count: "exact", head: true }),
  ]);

  console.log("\n  Final table counts:");
  console.log(`    participants:                ${pCount}`);
  console.log(`    partner_participants:        ${ppCount}`);
  console.log(`    relationship_participants:   ${rpCount}`);

  // Spot check: CJ Sturgess
  const { data: cj } = await db
    .from("participants")
    .select("id, email, org_type")
    .eq("email", "sturgeci@amazon.com")
    .maybeSingle();

  if (cj) {
    const { count: cjLinks } = await db
      .from("partner_participants")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", cj.id);

    console.log(`\n  Spot check — CJ Sturgess (sturgeci@amazon.com):`);
    console.log(`    participant row: 1, org_type=${cj.org_type}`);
    console.log(`    partner_participants links: ${cjLinks}`);
  }

  // Org type distribution
  const { data: orgDist } = await db
    .from("participants")
    .select("org_type");

  if (orgDist) {
    const dist: Record<string, number> = {};
    for (const row of orgDist) {
      const key = row.org_type ?? "null";
      dist[key] = (dist[key] ?? 0) + 1;
    }
    console.log("\n  Org type distribution:");
    for (const [k, v] of Object.entries(dist).sort()) {
      console.log(`    ${k}: ${v}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Done!");
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Hydration failed:", err);
  process.exit(1);
});
