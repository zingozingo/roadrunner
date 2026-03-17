import { getPartnerContactDomains } from "./db";

/**
 * AWS-owned email domains to skip during partner detection.
 * These are internal — never match to a partner.
 */
export const AWS_DOMAINS = new Set([
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.co.jp",
  "amazon.es",
  "amazon.it",
  "amazonaws.com",
]);

/**
 * Extract all email addresses from a text string.
 * Handles: bare addresses, "Name <addr>" format, comma/semicolon-separated lists.
 */
export function extractEmailAddresses(text: string): string[] {
  if (!text) return [];
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex);
  return matches ? [...new Set(matches.map((e) => e.toLowerCase()))] : [];
}

/**
 * Detect which partner an inbound email belongs to by matching
 * non-AWS email domains against the partner contact registry.
 *
 * Priority: sender → to → cc → body (first match wins).
 */
export async function detectPartnerFromEmail(
  senderEmail: string,
  toHeader: string | null,
  ccHeader: string | null,
  bodyText: string | null
): Promise<{ partnerId: string; partnerName: string } | null> {
  // Collect emails in priority order: sender first, then to, cc, body
  const orderedSources = [senderEmail, toHeader, ccHeader, bodyText];
  const allEmails: string[] = [];
  for (const source of orderedSources) {
    if (source) {
      allEmails.push(...extractEmailAddresses(source));
    }
  }

  if (allEmails.length === 0) return null;

  const domainMap = await getPartnerContactDomains();

  for (const email of allEmails) {
    const domain = email.split("@")[1];
    if (!domain) continue;
    if (AWS_DOMAINS.has(domain)) continue;

    const match = domainMap.get(domain);
    if (match) return match;
  }

  return null;
}
