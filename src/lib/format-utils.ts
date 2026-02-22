/**
 * Extract a compact city display from a full location string.
 *
 * Examples:
 *   "Venetian Expo & Convention Center, Las Vegas, NV" → "Las Vegas, NV"
 *   "Moscone Center, San Francisco, CA" → "San Francisco, CA"
 *   "Excel, Royal Victoria Dock, 1 Western Gateway, London E16 1XL, UK" → "London E16 1XL, UK"
 *   "San Francisco" → "San Francisco"
 *   "" → ""
 */
export function extractCity(location: string | null | undefined): string {
  if (!location) return "";
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length <= 2) return location;
  // Take last 2 segments (city + state/country)
  return parts.slice(-2).join(", ");
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
