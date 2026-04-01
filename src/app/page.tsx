import Link from "next/link";
import {
  getUpcomingMeetings,
  getOpenTasks,
  getInboxGroupCount,
  getSupabaseClient,
} from "@/lib/db";
import { cleanMeetingTitle } from "@/lib/format-utils";
import { MEETING_TYPE_DISPLAY } from "@/lib/sync/field-maps";
import PageContainer from "@/components/layout/PageContainer";
import TodayTasks from "./TodayTasks";
import type { Meeting } from "@/lib/types";

export const dynamic = "force-dynamic";

type EnrichedMeeting = Meeting & {
  engagement_name: string | null;
  partner_name: string | null;
};

export default async function TodayPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [allMeetings, allTasks, inboxCount] = await Promise.all([
    getUpcomingMeetings(7),
    getOpenTasks(),
    getInboxGroupCount(),
  ]);

  const todaysMeetings = allMeetings.filter(
    (m) => m.meeting_date === today
  );
  const upcomingMeetings = allMeetings.filter(
    (m) => m.meeting_date && m.meeting_date > today
  );
  const myTasks = allTasks.filter((t) => t.owner === "me");

  /* Sort tasks: overdue first → due soonest → no due date last */
  myTasks.sort((a, b) => {
    const aOver = a.due_date && a.due_date < today ? 1 : 0;
    const bOver = b.due_date && b.due_date < today ? 1 : 0;
    if (aOver !== bOver) return bOver - aOver; // overdue first
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  /* Build root anchor_day map for shifted-occurrence detection */
  const rootAnchorDays = new Map<string, number>();
  // First pass: get roots from the existing dataset
  for (const m of allMeetings) {
    if (m.id === m.series_id && m.anchor_day !== null && m.anchor_day !== undefined) {
      rootAnchorDays.set(m.id, m.anchor_day);
    }
  }
  // Second pass: batch-fetch any missing roots (root might be outside the 7-day window)
  const missingRootIds = [...new Set(
    allMeetings
      .filter((m) => m.series_id && !rootAnchorDays.has(m.series_id))
      .map((m) => m.series_id!)
  )];
  if (missingRootIds.length > 0) {
    const db = getSupabaseClient();
    const { data: roots } = await db
      .from("meetings")
      .select("id, anchor_day")
      .in("id", missingRootIds);
    for (const r of (roots ?? []) as { id: string; anchor_day: number | null }[]) {
      if (r.anchor_day !== null) rootAnchorDays.set(r.id, r.anchor_day);
    }
  }
  function isMeetingShifted(m: EnrichedMeeting): boolean {
    if (!m.series_id || !m.meeting_date) return false;
    const rootAnchor = rootAnchorDays.get(m.series_id);
    if (rootAnchor === undefined) return false;
    const pattern = m.recurrence_pattern;
    if (pattern !== "weekly" && pattern !== "biweekly") return false;
    return new Date(m.meeting_date + "T12:00:00").getDay() !== rootAnchor;
  }

  /* Group upcoming meetings by date */
  const upcomingByDate: [string, EnrichedMeeting[]][] = [];
  for (const m of upcomingMeetings) {
    const d = m.meeting_date ?? "";
    const last = upcomingByDate[upcomingByDate.length - 1];
    if (last && last[0] === d) {
      last[1].push(m);
    } else {
      upcomingByDate.push([d, [m]]);
    }
  }

  const hasContent =
    todaysMeetings.length > 0 ||
    myTasks.length > 0 ||
    inboxCount > 0 ||
    upcomingMeetings.length > 0;

  return (
    <PageContainer>
      {/* ---- Header ---- */}
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-foreground">Today</h1>
        <span className="text-sm text-muted">{dateLabel}</span>
      </div>

      {!hasContent && (
        <p className="text-sm text-muted/60 mt-16 text-center">
          All clear for today.
        </p>
      )}

      {hasContent && (
        <div className="grid grid-cols-1 lg:grid-cols-[11fr_9fr] gap-6">

          {/* ─── LEFT COLUMN: Schedule ─── */}
          <div className="min-w-0">
            {/* Today's Meetings */}
            {todaysMeetings.length > 0 && (
              <section className="mb-8">
                <SectionHeader label="Today's Meetings" count={todaysMeetings.length} />
                <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
                  {todaysMeetings.map((m, i) => (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className={`flex items-center px-4 py-3 transition-colors hover:bg-surface-hover ${
                        i < todaysMeetings.length - 1 ? "border-b border-border/30" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {m.partner_name ?? "Unknown"}
                        </span>
                        <span className="text-sm text-muted truncate">
                          {cleanMeetingTitle(m.title)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {(m.recurrence_pattern || m.series_id) && (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/70">
                            <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" />
                            <path d="M14 2v4h-4M2 14v-4h4" />
                          </svg>
                        )}
                        {m.meeting_type && (
                          <span className="text-[11px] font-medium rounded-full bg-accent/10 px-2 py-0.5 text-accent/70">
                            {MEETING_TYPE_DISPLAY[m.meeting_type] ?? m.meeting_type.replace(/_/g, " ")}
                          </span>
                        )}
                        <span className="text-xs font-medium text-accent">
                          Open Notes
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Meetings */}
            {upcomingMeetings.length > 0 && (
              <section>
                <SectionHeader label="Upcoming" count={upcomingMeetings.length} />
                <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
                  {upcomingByDate.map(([date, meetings], gi) =>
                    meetings.map((m, i) => (
                      <MeetingRow
                        key={m.id}
                        meeting={m}
                        showDate={i === 0}
                        dateLabel={formatDateShort(date)}
                        shifted={isMeetingShifted(m)}
                        isLast={
                          gi === upcomingByDate.length - 1 &&
                          i === meetings.length - 1
                        }
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {/* No meetings at all — gentle empty state in left column */}
            {todaysMeetings.length === 0 && upcomingMeetings.length === 0 && (
              <p className="text-sm text-muted/60 py-4">
                No meetings scheduled this week.
              </p>
            )}
          </div>

          {/* ─── RIGHT COLUMN: Tasks + Inbox ─── */}
          <div className="min-w-0 lg:border-l lg:border-border/20 lg:pl-6">
            {/* My Tasks */}
            {myTasks.length > 0 && (
              <section className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <SectionHeader label="My Tasks" count={myTasks.length} inline />
                  <Link
                    href="/tasks"
                    className="text-xs text-muted hover:text-foreground transition-colors"
                  >
                    View all
                  </Link>
                </div>
                <TodayTasks tasks={myTasks.slice(0, 12)} today={today} />
                {myTasks.length > 12 && (
                  <Link
                    href="/tasks"
                    className="mt-2 block text-center text-xs text-muted hover:text-foreground transition-colors"
                  >
                    +{myTasks.length - 12} more tasks
                  </Link>
                )}
              </section>
            )}

            {/* Inbox Signal */}
            {inboxCount > 0 && (
              <section>
                <SectionHeader label="Inbox" />
                <Link
                  href="/inbox"
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-surface px-4 py-3 transition-colors hover:bg-surface-hover group"
                >
                  <span className="text-sm text-foreground/70">
                    <span className="font-medium text-foreground">{inboxCount}</span>{" "}
                    {inboxCount === 1 ? "item" : "items"} waiting for triage
                  </span>
                  <span className="text-xs text-accent opacity-70 group-hover:opacity-100 transition-opacity">
                    Go to Inbox
                  </span>
                </Link>
              </section>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  label,
  count,
  inline,
}: {
  label: string;
  count?: number;
  inline?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${inline ? "" : "mb-3"}`}>
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
        {label}
      </h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted/40">{count}</span>
      )}
    </div>
  );
}

function MeetingRow({
  meeting,
  showDate,
  dateLabel,
  shifted,
  isLast,
}: {
  meeting: EnrichedMeeting;
  showDate: boolean;
  dateLabel?: string;
  shifted?: boolean;
  isLast: boolean;
}) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className={`flex items-center px-4 py-3 transition-colors hover:bg-surface-hover ${
        !isLast ? "border-b border-border/30" : ""
      }`}
    >
      {/* Date column (for upcoming) */}
      {dateLabel !== undefined && (
        <span className={`w-24 shrink-0 text-xs ${shifted ? "text-status-blocked/70" : "text-muted"}`} title={shifted ? "Rescheduled from regular day" : undefined}>
          {showDate ? dateLabel : ""}
        </span>
      )}

      {/* Partner + title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground truncate">
          {meeting.partner_name ?? "Unknown"}
        </span>
        <span className="text-sm text-muted truncate">
          {cleanMeetingTitle(meeting.title)}
        </span>
      </div>

      {/* Recurrence indicator + type badge + action */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {(meeting.recurrence_pattern || meeting.series_id) && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/70">
            <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" />
            <path d="M14 2v4h-4M2 14v-4h4" />
          </svg>
        )}
        {meeting.meeting_type && (
          <span className="text-[11px] font-medium rounded-full bg-accent/10 px-2 py-0.5 text-accent/70">
            {MEETING_TYPE_DISPLAY[meeting.meeting_type] ?? meeting.meeting_type.replace(/_/g, " ")}
          </span>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted/40"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
      </div>
    </Link>
  );
}

function formatDateShort(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
