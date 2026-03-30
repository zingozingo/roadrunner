import Link from "next/link";
import type { Meeting } from "@/lib/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const PATTERN_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

type SeriesSibling = Pick<Meeting, "id" | "meeting_date" | "status" | "anchor_day">;

interface SeriesDisplayProps {
  meetingId: string;
  meetingDate: string | null;
  recurrencePattern: string | null;
  recurrenceEnd: string | null;
  siblings: SeriesSibling[];
  /** anchor_day from the series root (resolved server-side) */
  rootAnchorDay: number | null;
  /** meeting_date from the series root */
  rootDate: string | null;
}

/**
 * Unified series display: rhythm info + navigation + shifted indicator.
 * Replaces the old nav bar + sidebar recurrence field.
 */
export default function SeriesDisplay({
  meetingId,
  meetingDate,
  recurrencePattern,
  recurrenceEnd,
  siblings,
  rootAnchorDay,
  rootDate,
}: SeriesDisplayProps) {
  if (siblings.length <= 1 && !recurrencePattern) return null;

  const idx = siblings.findIndex((s) => s.id === meetingId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  // Build rhythm text: "Weekly on Wednesdays"
  const patternLabel = recurrencePattern ? PATTERN_LABELS[recurrencePattern] ?? recurrencePattern : null;
  let rhythmText = patternLabel ?? "";
  if (rootAnchorDay !== null && rootAnchorDay !== undefined) {
    if (recurrencePattern === "weekly" || recurrencePattern === "biweekly") {
      rhythmText += ` on ${DAY_NAMES[rootAnchorDay]}s`;
    } else if (recurrencePattern === "monthly" || recurrencePattern === "quarterly") {
      const suffix = rootAnchorDay === 1 ? "st" : rootAnchorDay === 2 ? "nd" : rootAnchorDay === 3 ? "rd" : "th";
      rhythmText += ` on the ${rootAnchorDay}${suffix}`;
    }
  }

  // "Since Mar 20"
  const sinceText = rootDate
    ? `Since ${new Date(rootDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : null;

  // End date text
  const endText = recurrenceEnd
    ? `Ends ${new Date(recurrenceEnd + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : null;

  // Shifted detection: is this meeting on a different day than the anchor?
  const isShifted = (() => {
    if (rootAnchorDay === null || rootAnchorDay === undefined || !meetingDate) return false;
    if (recurrencePattern !== "weekly" && recurrencePattern !== "biweekly") return false;
    const meetingDow = new Date(meetingDate + "T12:00:00").getDay();
    return meetingDow !== rootAnchorDay;
  })();

  const shiftedDayName = isShifted && meetingDate
    ? DAY_NAMES[new Date(meetingDate + "T12:00:00").getDay()]
    : null;

  return (
    <div className="mb-6 rounded-lg border border-border/20 bg-surface/50 px-4 py-3">
      {/* Line 1: Rhythm info */}
      <div className="flex items-center gap-2 text-sm">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/70 shrink-0">
          <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" />
          <path d="M14 2v4h-4M2 14v-4h4" />
        </svg>
        <span className="text-foreground/80 font-medium">{rhythmText}</span>
        {sinceText && (
          <>
            <span className="text-muted/30">·</span>
            <span className="text-muted/60 text-xs">{sinceText}</span>
          </>
        )}
        {endText && (
          <>
            <span className="text-muted/30">·</span>
            <span className="text-muted/60 text-xs">{endText}</span>
          </>
        )}
        {isShifted && shiftedDayName && (
          <>
            <span className="text-muted/30">·</span>
            <span className="text-xs text-status-blocked/70">Moved to {shiftedDayName}</span>
          </>
        )}
      </div>

      {/* Line 2: Navigation */}
      {siblings.length > 1 && (
        <div className="flex items-center mt-2">
          {prev ? (
            <Link href={`/meetings/${prev.id}`} className="text-xs text-muted hover:text-accent transition-colors">
              &larr; Previous
            </Link>
          ) : (
            <span className="text-xs text-muted/30">&larr; Previous</span>
          )}
          <span className="flex-1" />
          {next ? (
            <Link href={`/meetings/${next.id}`} className="text-xs text-muted hover:text-accent transition-colors">
              Next &rarr;
            </Link>
          ) : (
            <span className="text-xs text-muted/30">Next &rarr;</span>
          )}
        </div>
      )}
    </div>
  );
}
