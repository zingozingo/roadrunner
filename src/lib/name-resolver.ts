import { getSupabaseClient } from "./supabase";
import type { Participant, AwsRelationship, Partner } from "./types";

// ============================================================
// Name Resolution — email→name and domain→org lookups
// ============================================================
//
// Priority chain (first write wins — earlier sources can't be overwritten):
//
//   1. aws_relationships  — Human-curated in Airtable. Primary contacts
//      with verified name+email pairs. Highest trust.
//   2. partners           — Human-curated in Airtable. Alliance lead
//      name+email. Same trust tier as relationships but less specific.
//   3. participants       — AI-extracted by Claude from classified emails.
//      Fills gaps for tertiary contacts the system learns organically.
//      Lowest priority because AI extraction can produce noisy names.
//
// WHY catalog-first: Airtable data is manually maintained by the PDM
// and represents ground truth for core contacts. AI-extracted participant
// names are useful for contacts not in any catalog, but should never
// override a human-curated name. Future contact sources (team roster,
// org directory) slot into this same priority chain.
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
 * Build a resolution map by querying aws_relationships, partners, and
 * participants tables in parallel. Merge order determines priority —
 * first write wins, so catalog sources (human-curated) take precedence
 * over AI-extracted participant names.
 *
 * See priority chain comment at top of file for rationale.
 */
export async function buildNameResolutionMap(): Promise<NameResolutionMap> {
  const db = getSupabaseClient();

  // All three queries fire in parallel — merge order (not query order) sets priority
  const [relationshipsResult, partnersResult, participantsResult] =
    await Promise.all([
      db.from("aws_relationships").select(
        "primary_contact_name, primary_contact_email, aws_contact_emails"
      ),
      db.from("partners").select(
        "name, alliance_lead, alliance_lead_email, partner_contact_emails"
      ),
      db.from("participants").select("email, name"),
    ]);

  const emailToName = new Map<string, ResolvedName>();
  const domainToOrg = new Map<string, string>();

  // --- Priority 1: AWS Relationships (human-curated in Airtable, highest trust) ---
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

  // --- Priority 2: Partners (human-curated in Airtable, alliance lead contacts) ---
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

  // --- Priority 3: Participants (AI-extracted, fills gaps for tertiary contacts) ---
  for (const row of (participantsResult.data ?? []) as Pick<Participant, "email" | "name">[]) {
    if (!row.email || !row.name) continue;
    const key = row.email.toLowerCase().trim();
    if (!emailToName.has(key)) {
      emailToName.set(key, { name: row.name, source: "participant" });
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
