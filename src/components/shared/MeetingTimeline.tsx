/**
 * MeetingTimeline — Vertical timeline for meetings on non-meeting pages.
 *
 * Renders meetings chronologically with visual distinction between
 * upcoming (accent border, brighter) and past (muted) meetings.
 * Filters to upcoming + last 90 days only.
 *
 * Reusable on partner, event, engagement, and program detail pages.
 */

import Link from "next/link";
import { MeetingStatusBadge } from "@/components/shared/TypeBadge";
import type { Meeting } from "@/lib/types";

interface MeetingTimelineProps {
  meetings: Meeting[];
  /** Map of engagement_id → engagement name for inline display */
  engagementNames?: Map<string, string>;
}

export default function MeetingTimeline({
  meetings,
  engagementNames,
}: MeetingTimelineProps) {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Split into upcoming and past, filtering out old meetings
  const upcoming: Meeting[] = [];
  const past: Meeting[] = [];

  for (const mtg of meetings) {
    if (!mtg.meeting_date) {
      // No date — treat as upcoming (still being scheduled)
      upcoming.push(mtg);
      continue;
    }
    const date = new Date(mtg.meeting_date + "T23:59:59");
    if (date >= now) {
      upcoming.push(mtg);
    } else if (date >= ninetyDaysAgo) {
      past.push(mtg);
    }
    // Older than 90 days: filtered out
  }

  // Upcoming: soonest first (nulls at end)
  upcoming.sort((a, b) => {
    if (!a.meeting_date) return 1;
    if (!b.meeting_date) return -1;
    return a.meeting_date.localeCompare(b.meeting_date);
  });

  // Past: most recent first
  past.sort((a, b) => {
    if (!a.meeting_date || !b.meeting_date) return 0;
    return b.meeting_date.localeCompare(a.meeting_date);
  });

  const filtered = [...upcoming, ...past];

  if (filtered.length === 0) {
    return <p className="text-sm text-muted">No meetings scheduled</p>;
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

      {filtered.map((mtg, i) => {
        const isUpcoming =
          !mtg.meeting_date ||
          new Date(mtg.meeting_date + "T23:59:59") >= now;
        const engName =
          mtg.engagement_id && engagementNames
            ? engagementNames.get(mtg.engagement_id)
            : null;

        return (
          <Link
            key={mtg.id}
            href={`/meetings/${mtg.id}`}
            className="group relative flex gap-3 py-2 pl-6 transition-colors hover:bg-surface-hover/50 rounded-lg"
          >
            {/* Timeline dot */}
            <div
              className={`absolute left-0.5 top-[18px] h-3 w-3 rounded-full border-2 ${
                isUpcoming
                  ? "border-accent bg-accent/30"
                  : "border-border bg-surface"
              }`}
            />

            <div className="min-w-0 flex-1">
              {/* Date line */}
              <div
                className={`text-xs font-medium ${
                  isUpcoming ? "text-accent" : "text-muted"
                }`}
              >
                {mtg.meeting_date
                  ? new Date(mtg.meeting_date + "T00:00:00").toLocaleDateString(
                      undefined,
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    )
                  : "Date TBD"}
                {mtg.start_time && (
                  <span className="ml-1.5 text-muted font-normal">
                    {mtg.start_time}
                  </span>
                )}
              </div>

              {/* Title + badges */}
              <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${
                    isUpcoming ? "text-foreground" : "text-muted"
                  } group-hover:text-foreground`}
                >
                  {mtg.title}
                </span>
                {mtg.meeting_type && (
                  <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                    {mtg.meeting_type}
                  </span>
                )}
                <MeetingStatusBadge status={mtg.status} />
              </div>

              {/* Engagement link */}
              {engName && (
                <p className="mt-0.5 text-xs text-muted">
                  {engName}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
