export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { MeetingStatusBadge } from "@/components/shared/TypeBadge";
import { cleanMeetingTitle, extractCity, formatCompactDateRange } from "@/lib/format-utils";
import {
  getUnresolvedApprovalCount,
  getAllEngagements,
  getAllEventsWithCounts,
  getUpcomingMeetings,
  getOpenTasks,
} from "@/lib/db";

const OWNER_LABELS: Record<string, { label: string; style: string }> = {
  me: { label: "Me", style: "bg-accent/15 text-accent" },
  partner: { label: "Partner", style: "bg-emerald-500/15 text-emerald-400" },
  aws_internal: { label: "AWS", style: "bg-blue-500/15 text-blue-400" },
};

export default async function PulsePage() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [reviewCount, engagements, events, todayMeetings, weekMeetings, openTasks] =
    await Promise.all([
      getUnresolvedApprovalCount(),
      getAllEngagements(),
      getAllEventsWithCounts(),
      getUpcomingMeetings(0),
      getUpcomingMeetings(7),
      getOpenTasks(),
    ]);

  // Split week meetings: exclude today (already shown above)
  const thisWeekMeetings = weekMeetings.filter((m) => m.meeting_date !== todayStr);

  // Recent engagements: first 5
  const recentEngagements = engagements.slice(0, 5);

  // Upcoming events: future start_date, first 3
  const now = new Date().toISOString();
  const upcomingEvents = events
    .filter((e) => e.start_date && e.start_date > now)
    .slice(0, 3);

  // Group tasks by partner, cap at 10
  const tasksByPartner = new Map<string, typeof openTasks>();
  let taskCount = 0;
  for (const task of openTasks) {
    if (taskCount >= 10) break;
    const list = tasksByPartner.get(task.partner_name) ?? [];
    list.push(task);
    tasksByPartner.set(task.partner_name, list);
    taskCount++;
  }

  const dateDisplay = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="space-y-8">
        <PageHeader title="Pulse" subtitle={dateDisplay} />

        {/* Section 1 — Today's Meetings */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Today&apos;s Meetings
          </h2>
          {todayMeetings.length === 0 ? (
            <p className="text-sm text-muted">No meetings today</p>
          ) : (
            <div>
              {todayMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                >
                  <span className="shrink-0 w-20 text-sm font-medium text-foreground">
                    {m.start_time ?? "TBD"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {cleanMeetingTitle(m.title)}
                  </span>
                  {m.partner_name && (
                    <span className="shrink-0 text-xs text-muted hidden sm:block">
                      {m.partner_name}
                    </span>
                  )}
                  <span className="shrink-0">
                    <MeetingStatusBadge status={m.status} />
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* This Week */}
          {thisWeekMeetings.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                This Week
              </h3>
              <div>
                {thisWeekMeetings.map((m) => {
                  const shortDate = m.meeting_date
                    ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                    : "TBD";
                  return (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                    >
                      <span className="shrink-0 w-28 text-xs text-muted">
                        {shortDate}
                      </span>
                      <span className="shrink-0 w-16 text-xs text-muted hidden sm:block">
                        {m.start_time ?? ""}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {cleanMeetingTitle(m.title)}
                      </span>
                      {m.partner_name && (
                        <span className="shrink-0 text-xs text-muted hidden md:block">
                          {m.partner_name}
                        </span>
                      )}
                      <span className="shrink-0">
                        <MeetingStatusBadge status={m.status} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Section 2 — Open Tasks */}
        {openTasks.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Open Tasks
            </h2>
            <div className="space-y-4">
              {[...tasksByPartner.entries()].map(([partnerName, tasks]) => (
                <div key={partnerName}>
                  <h3 className="mb-1.5 text-sm font-medium text-foreground">{partnerName}</h3>
                  <div>
                    {tasks.map((task) => {
                      const ownerInfo = OWNER_LABELS[task.owner] ?? { label: task.owner, style: "bg-border text-muted" };
                      return (
                        <Link
                          key={task.id}
                          href={`/notes/${task.meeting_note_id}`}
                          className="flex items-center px-4 py-2 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {task.description}
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${ownerInfo.style}`}>
                            {ownerInfo.label}
                          </span>
                          {task.due_date && (
                            <span className="shrink-0 text-xs text-muted">
                              {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {openTasks.length > 10 && (
              <Link href="/notes" className="mt-2 inline-block text-xs text-accent hover:text-accent-hover">
                View all {openTasks.length} tasks →
              </Link>
            )}
          </section>
        )}

        {/* Section 3 — Inbox */}
        {reviewCount > 0 && (
          <section>
            <Link
              href="/inbox"
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:border-accent/40"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {reviewCount} item{reviewCount !== 1 ? "s" : ""} need{reviewCount === 1 ? "s" : ""} your review
                </p>
                <p className="mt-0.5 text-xs text-muted">Emails pending classification review</p>
              </div>
              <span className="text-xs font-medium text-accent">Review →</span>
            </Link>
          </section>
        )}

        {/* Section 4 — Recent Engagements */}
        {recentEngagements.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Recent Engagements
            </h2>
            <div>
              {recentEngagements.map((eng) => (
                <Link
                  key={eng.id}
                  href={`/engagements/${eng.id}`}
                  className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {eng.name}
                  </span>
                  {eng.partner_name && (
                    <span className="shrink-0 text-xs text-muted hidden sm:block">
                      {eng.partner_name}
                    </span>
                  )}
                  <span className="shrink-0">
                    <StatusBadge status={eng.status} />
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/engagements" className="mt-2 inline-block text-xs text-accent hover:text-accent-hover">
              View all engagements →
            </Link>
          </section>
        )}

        {/* Section 5 — Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Upcoming Events
            </h2>
            <div>
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                >
                  <span className="shrink-0 w-24 text-xs text-muted">
                    {formatCompactDateRange(event.start_date, event.end_date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {event.name}
                  </span>
                  {event.location && (
                    <span className="shrink-0 text-xs text-muted hidden sm:block">
                      {extractCity(event.location)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <Link href="/events" className="mt-2 inline-block text-xs text-accent hover:text-accent-hover">
              View all events →
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
