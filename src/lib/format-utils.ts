/** Postal code patterns: "75017", "E16 1XL", "DK-2300", "560066", "018956", "NSW 2000" */
const POSTAL_CODE_RE = /^[A-Z]{0,3}-?\d{3,6}$/i;
const EMBEDDED_POSTAL_RE = /\b[A-Z]{0,3}-?\d{4,6}\b/i;
const UK_POSTAL_RE = /\b[A-Z]{1,2}\d[\dA-Z]?\s?\d[A-Z]{2}\b/i;

/** Street/venue keywords that indicate a segment is not a city */
const VENUE_KEYWORDS = /\b(expo|convention|center|centre|palais|congress|hotel|resort|stadium|arena|theater|theatre|hall|plaza|pavilion|forum|fairground)\b/i;
const STREET_KEYWORDS = /\b(ave|avenue|street|st|road|rd|blvd|boulevard|drive|dr|lane|ln|way|place|gateway|dock|bayfront)\b/i;

/**
 * Extract a compact city display from a full location string.
 *
 * Examples:
 *   "Venetian Expo & Convention Center, Las Vegas, NV" → "Las Vegas, NV"
 *   "75017 Paris, France" → "Paris, France"
 *   "London E16 1XL, UK" → "London, UK"
 *   "Palais des Congres, 2 Place de la Porte Maillot, 75017 Paris, France" → "Paris, France"
 *   "10 Bayfront Ave, Singapore 018956" → "Singapore"
 *   "Karnataka 560066, India" → "Karnataka, India"
 *   "DK-2300 Copenhagen S, Denmark" → "Copenhagen, Denmark"
 *   "Tel Aviv, Israel" → "Tel Aviv, Israel" (already clean)
 *   "" → ""
 */
export function extractCity(location: string | null | undefined): string {
  if (!location) return "";
  const raw = location.trim();
  if (!raw) return "";

  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);

  // Filter out venue/street/address segments
  const kept = parts.filter((seg) => {
    // Contains venue keywords
    if (VENUE_KEYWORDS.test(seg)) return false;
    // Contains street keywords
    if (STREET_KEYWORDS.test(seg)) return false;
    // Entire segment is a postal code ("75017", "DK-2300")
    if (POSTAL_CODE_RE.test(seg)) return false;
    // Starts with a number AND contains street-like words or is purely an address
    // ("10 Bayfront Ave", "2 Place de la Porte Maillot") but NOT "75017 Paris"
    if (/^\d/.test(seg) && /^\d+\s+\S/.test(seg)) {
      // Check if removing the leading number leaves something city-like (>1 word after number)
      // vs address-like (the rest has street keywords or it's a numbered street address)
      const afterNum = seg.replace(/^\d+\s+/, "");
      // If after removing number it looks like a city name (single word or known city),
      // keep it for cleaning later; if it has "place", "ave" etc, drop it
      if (STREET_KEYWORDS.test(afterNum) || VENUE_KEYWORDS.test(afterNum)) return false;
      // "75017 Paris" → keep, will clean the number later
    }
    return true;
  });

  if (kept.length === 0) return raw; // fallback to original

  // Clean remaining segments: strip embedded postal codes and trailing direction letters
  const cleaned = kept.map((seg) => {
    let s = seg;
    // Strip UK-style postal codes ("London E16 1XL" → "London")
    s = s.replace(UK_POSTAL_RE, "").trim();
    // Strip embedded numeric postal codes ("Singapore 018956" → "Singapore", "Karnataka 560066" → "Karnataka")
    s = s.replace(EMBEDDED_POSTAL_RE, "").trim();
    // Strip leading postal/numeric prefix ("DK-2300 Copenhagen S" → "Copenhagen S", "75017 Paris" → "Paris")
    s = s.replace(/^[A-Z]{0,3}-?\d+\s*/i, "").trim();
    // Strip trailing single direction letter ("Copenhagen S" → "Copenhagen")
    s = s.replace(/\s+[NSEW]$/i, "").trim();
    return s;
  }).filter(Boolean);

  if (cleaned.length === 0) return raw; // fallback

  // Take last 2 segments (city + country/state)
  return cleaned.slice(-2).join(", ");
}

/**
 * Format a date range in compact form for tiles.
 * "2026-03-09" / "2026-03-12" → "Mar 9–12"
 * "2026-03-09" / "2026-04-02" → "Mar 9 – Apr 2"
 * "2026-03-09" / null → "Mar 9"
 */
export function formatCompactDateRange(
  start: string | null,
  end: string | null
): string {
  if (!start) return "TBD";
  const s = new Date(start + "T00:00:00");
  if (!end) {
    return s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const e = new Date(end + "T00:00:00");
  if (s.getTime() === e.getTime()) {
    return s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  // Same month
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    const month = s.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${s.getDate()}–${e.getDate()}`;
  }
  // Different months
  const sf = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const ef = e.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${sf} – ${ef}`;
}

/**
 * Clean email-forwarding and calendar-response prefixes from meeting titles.
 *
 * Strips: "FW:", "Fwd:", "Re:", "RE:", "Accepted:", "Tentative:", "Declined:"
 * Handles multiple layers: "FW: FW: Re: Title" → "Title"
 */
export function cleanMeetingTitle(title: string): string {
  let cleaned = title;
  // Iteratively strip prefixes
  const PREFIX_RE = /^\s*(FW|Fwd|Re|RE|Accepted|Tentative|Declined)\s*:\s*/i;
  while (PREFIX_RE.test(cleaned)) {
    cleaned = cleaned.replace(PREFIX_RE, "");
  }
  return cleaned.trim();
}
