import { getSupabaseClient } from "./supabase";
import type { Participant, AwsRelationship, Partner } from "./types";

// ============================================================
// Name Resolution — email→name and domain→org lookups
// ============================================================
//
// Three data sources, queried in priority order:
// 1. participants (Claude-extracted from classified emails — best quality)
// 2. aws_relationships (Airtable-sourced name+email pairs)
// 3. partners (alliance_lead_email → name, domain → org)
//
// Personal email domains (gmail.com, outlook.com, etc.) are excluded
// from the domain→org map to avoid false positive org assignments.
// ============================================================

export interface ResolvedName {
  name: string;
  source: "participant" | "aws_relationship" | "partner";
}

export interface NameResolutionMap {
  /** lowercase email → resolved name + source */
  emailToName: Map<string, ResolvedName>;
  /** lowercase domain → organization name */
  domainToOrg: Map<string, string>;
}

/** Domains that should never map to an organization */
const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "yahoo.co.uk",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "gmx.net",
]);

/**
 * Build a resolution map by querying participants, aws_relationships,
 * and partners tables. Earlier sources take priority — a name found
 * in participants won't be overwritten by aws_relationships or partners.
 */
export async function buildNameResolutionMap(): Promise<NameResolutionMap> {
  const db = getSupabaseClient();

  const [participantsResult, relationshipsResult, partnersResult] =
    await Promise.all([
      db.from("participants").select("email, name"),
      db.from("aws_relationships").select(
        "primary_contact_name, primary_contact_email, aws_contact_emails"
      ),
      db.from("partners").select(
        "name, alliance_lead, alliance_lead_email, partner_contact_emails"
      ),
    ]);

  const emailToName = new Map<string, ResolvedName>();
  const domainToOrg = new Map<string, string>();

  // --- Priority 1: Participants (Claude-extracted, highest quality) ---
  for (const row of (participantsResult.data ?? []) as Pick<Participant, "email" | "name">[]) {
    if (!row.email || !row.name) continue;
    const key = row.email.toLowerCase().trim();
    if (!emailToName.has(key)) {
      emailToName.set(key, { name: row.name, source: "participant" });
    }
  }

  // --- Priority 2: AWS Relationships (Airtable-sourced) ---
  for (const row of (relationshipsResult.data ?? []) as Pick<
    AwsRelationship,
    "primary_contact_name" | "primary_contact_email" | "aws_contact_emails"
  >[]) {
    // Primary contact: has both name and email
    if (row.primary_contact_email && row.primary_contact_name) {
      const key = row.primary_contact_email.toLowerCase().trim();
      if (!emailToName.has(key)) {
        emailToName.set(key, {
          name: row.primary_contact_name,
          source: "aws_relationship",
        });
      }
    }
    // aws_contact_emails: emails only, no paired names — skip for name resolution
  }

  // --- Priority 3: Partners (alliance lead + domain→org) ---
  for (const row of (partnersResult.data ?? []) as Pick<
    Partner,
    "name" | "alliance_lead" | "alliance_lead_email" | "partner_contact_emails"
  >[]) {
    // Alliance lead: name + email pair
    if (row.alliance_lead_email && row.alliance_lead) {
      const key = row.alliance_lead_email.toLowerCase().trim();
      if (!emailToName.has(key)) {
        emailToName.set(key, {
          name: row.alliance_lead,
          source: "partner",
        });
      }
    }

    // Build domain→org map from partner contact emails
    const emails = row.partner_contact_emails ?? [];
    for (const email of emails) {
      const domain = extractDomain(email);
      if (domain && !PERSONAL_DOMAINS.has(domain) && !domainToOrg.has(domain)) {
        domainToOrg.set(domain, row.name);
      }
    }

    // Also use alliance lead email domain for org mapping
    if (row.alliance_lead_email) {
      const domain = extractDomain(row.alliance_lead_email);
      if (domain && !PERSONAL_DOMAINS.has(domain) && !domainToOrg.has(domain)) {
        domainToOrg.set(domain, row.name);
      }
    }
  }

  return { emailToName, domainToOrg };
}

/**
 * Look up a resolved name by email address.
 * Returns the name and source, or null if not found.
 */
export function resolveNameByEmail(
  email: string,
  map: NameResolutionMap
): ResolvedName | null {
  if (!email) return null;
  return map.emailToName.get(email.toLowerCase().trim()) ?? null;
}

/**
 * Look up an organization name by email domain.
 * Returns the org name or null if not found / personal domain.
 */
export function resolveOrgByDomain(
  email: string,
  map: NameResolutionMap
): string | null {
  if (!email) return null;
  const domain = extractDomain(email);
  if (!domain) return null;
  return map.domainToOrg.get(domain) ?? null;
}

/** Extract lowercase domain from an email address */
function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.substring(at + 1).toLowerCase().trim();
}
