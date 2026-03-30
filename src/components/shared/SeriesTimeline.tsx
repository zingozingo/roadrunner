import Link from "next/link";
import type { Meeting } from "@/lib/types";
import { cleanMeetingTitle } from "@/lib/format-utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SeriesSibling = Pick<Meeting, "id" | "title" | "meeting_date" | "status" | "anchor_day">;

interface SeriesTimelineProps {
  siblings: SeriesSibling[];
  rootAnchorDay: number | null;
  currentMeetingId?: string;
  recurrencePattern: string | null;
}

function formatTipDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
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

export default function SeriesTimeline({
  siblings,
  rootAnchorDay,
  currentMeetingId,
  recurrencePattern,
}: SeriesTimelineProps) {
  if (siblings.length < 2) return null;

  const today = new Date().toISOString().slice(0, 10);

  // Date label strategy: first, last, and every Nth
  const labelEveryN = siblings.length <= 8 ? 1
    : siblings.length <= 16 ? 2
    : siblings.length <= 24 ? 4
    : 6;

  return (
    <div className="mb-6">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-2">
        <span className="text-[10px] text-muted/40 uppercase tracking-wider">Series</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-status-active" />
            <span className="text-[10px] text-muted/50">Done</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent/50" />
            <span className="text-[10px] text-muted/50">Past</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm border border-accent/40" />
            <span className="text-[10px] text-muted/50">Scheduled</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted/20" />
            <span className="text-[10px] text-muted/50">Skipped</span>
          </span>
        </div>
      </div>

      {/* Timeline strip */}
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
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

          // Block styling
          let blockClass = "";
          if (isCancelled) {
            blockClass = "bg-muted/20";
          } else if (isCompleted) {
            blockClass = "bg-status-active";
          } else if (isFuture) {
            blockClass = "border border-accent/40 bg-transparent";
          } else {
            blockClass = "bg-accent/50";
          }

          // Current meeting ring
          const currentClass = isCurrent ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-background" : "";

          // Shifted border
          const shiftedClass = isShifted ? "border-2 border-status-blocked/60" : "";

          // Tooltip
          const dateStr = s.meeting_date ? formatTipDate(s.meeting_date) : "TBD";
          const statusLabel = isCancelled ? "Skipped"
            : isCompleted ? "Completed"
            : isFuture ? "Scheduled"
            : "Past due";
          const shiftLabel = isShifted && s.meeting_date
            ? ` · Moved to ${DAY_NAMES[new Date(s.meeting_date + "T12:00:00").getDay()]}`
            : "";
          const titleStr = s.title ? cleanMeetingTitle(s.title) : "";
          const tooltip = `${dateStr} — ${statusLabel}${shiftLabel}${titleStr ? `\n${titleStr}` : ""}`;

          // Date label
          const showLabel = i === 0 || i === siblings.length - 1 || i % labelEveryN === 0;

          return (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <Link
                href={`/meetings/${s.id}`}
                title={tooltip}
                className={`block w-4 h-4 rounded-sm shrink-0 transition-all hover:scale-110 hover:brightness-125 ${blockClass} ${currentClass} ${shiftedClass}`}
              />
              {showLabel && s.meeting_date ? (
                <span className="text-[9px] text-muted/40 whitespace-nowrap leading-none">
                  {formatLabelDate(s.meeting_date)}
                </span>
              ) : (
                <span className="text-[9px] leading-none invisible">.</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
