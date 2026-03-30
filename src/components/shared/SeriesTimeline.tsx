import Link from "next/link";
import type { Meeting } from "@/lib/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SeriesSibling = Pick<Meeting, "id" | "meeting_date" | "status" | "anchor_day">;

interface SeriesTimelineProps {
  siblings: SeriesSibling[];
  /** anchor_day from the series root */
  rootAnchorDay: number | null;
  /** The currently viewed meeting ID (highlighted) */
  currentMeetingId?: string;
  /** Recurrence pattern — needed for shifted detection */
  recurrencePattern: string | null;
}

function formatTipDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatLabelDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Compact horizontal dot strip visualizing a meeting series history.
 * Each dot represents one occurrence, color-coded by status.
 */
export default function SeriesTimeline({
  siblings,
  rootAnchorDay,
  currentMeetingId,
  recurrencePattern,
}: SeriesTimelineProps) {
  if (siblings.length < 2) return null;

  const today = new Date().toISOString().slice(0, 10);

  // Determine which date labels to show (avoid crowding)
  // Show first, last, and every Nth based on count
  const labelEveryN = siblings.length <= 6 ? 1
    : siblings.length <= 12 ? 2
    : siblings.length <= 20 ? 4
    : 6;

  return (
    <div className="mb-6">
      <div className="flex items-end gap-1.5 overflow-x-auto pb-4">
        {siblings.map((s, i) => {
          const isShifted = (() => {
            if (rootAnchorDay === null || rootAnchorDay === undefined || !s.meeting_date) return false;
            if (recurrencePattern !== "weekly" && recurrencePattern !== "biweekly") return false;
            return new Date(s.meeting_date + "T12:00:00").getDay() !== rootAnchorDay;
          })();

          const isFuture = s.meeting_date ? s.meeting_date > today : false;
          const isCurrent = s.id === currentMeetingId;
          const isCancelled = s.status === "cancelled" || s.status === "did_not_occur";
          const isCompleted = s.status === "completed";

          // Dot color
          let dotClass = "";
          if (isCancelled) {
            dotClass = "bg-muted/30";
          } else if (isCompleted) {
            dotClass = "bg-status-active";
          } else if (isFuture) {
            dotClass = "border border-accent/40 bg-transparent";
          } else {
            // Past but not completed/cancelled — scheduled but past due
            dotClass = "bg-accent/60";
          }

          // Shifted ring
          const shiftedRing = isShifted ? "ring-2 ring-status-blocked/40" : "";

          // Current meeting highlight
          const currentRing = isCurrent ? "ring-2 ring-foreground/50" : "";

          // Tooltip text
          const dateStr = s.meeting_date ? formatTipDate(s.meeting_date) : "TBD";
          const statusLabel = isCancelled ? "Skipped"
            : isCompleted ? "Completed"
            : isFuture ? "Scheduled"
            : "Past";
          const shiftLabel = isShifted && s.meeting_date
            ? ` · Moved to ${DAY_NAMES[new Date(s.meeting_date + "T12:00:00").getDay()]}`
            : "";
          const tooltip = `${dateStr} — ${statusLabel}${shiftLabel}`;

          // Show date label?
          const showLabel = i === 0 || i === siblings.length - 1 || i % labelEveryN === 0;

          return (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <Link
                href={`/meetings/${s.id}`}
                title={tooltip}
                className={`block w-3 h-3 rounded-full shrink-0 transition-transform hover:scale-125 ${dotClass} ${shiftedRing} ${currentRing}`}
              >
                {isCancelled && (
                  <span className="block w-full h-px bg-muted/60 mt-[5px]" />
                )}
              </Link>
              {showLabel && s.meeting_date && (
                <span className="text-[9px] text-muted/40 whitespace-nowrap">
                  {formatLabelDate(s.meeting_date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
