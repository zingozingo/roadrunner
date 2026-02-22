export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import SyncButton from "@/components/shared/SyncButton";
import { extractCity } from "@/lib/format-utils";
import {
  getUnresolvedApprovalCount,
  getAllEngagements,
  getAllEventsWithCounts,
} from "@/lib/supabase";

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const [reviewCount, engagements, events] = await Promise.all([
    getUnresolvedApprovalCount(),
    getAllEngagements(),
    getAllEventsWithCounts(),
  ]);

  const activeCount = engagements.filter((i) => i.status === "active").length;

  // Upcoming events (events with a future start_date)
  const now = new Date().toISOString();
  const upcoming = events
    .filter((e) => e.start_date && e.start_date > now)
    .slice(0, 5);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Dashboard"
          subtitle="Relay — AI-powered engagement tracker"
        />
        <SyncButton />
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/inbox"
          className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
        >
          <p className="text-sm font-medium text-muted">Pending Reviews</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {reviewCount}
          </p>
          {reviewCount > 0 && (
            <p className="mt-2 text-xs text-accent">
              Needs attention
            </p>
          )}
        </Link>

        <Link
          href="/engagements"
          className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
        >
          <p className="text-sm font-medium text-muted">Active Engagements</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {activeCount}
          </p>
          <p className="mt-2 text-xs text-muted">
            {engagements.length} total
          </p>
        </Link>

        <Link
          href="/events"
          className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
        >
          <p className="text-sm font-medium text-muted">Upcoming Events</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {upcoming.length}
          </p>
          <p className="mt-2 text-xs text-muted">
            {events.length} total tracked
          </p>
        </Link>
      </div>

      {/* Upcoming events — compact date-first format */}
      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Upcoming Events
          </h2>
          <div>
            {upcoming.map((event) => {
              const city = extractCity(event.location);
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface"
                >
                  <span className="shrink-0 w-16 text-sm font-medium text-foreground">
                    {event.start_date ? formatShortDate(event.start_date) : "TBD"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {event.name}
                  </span>
                  {city && (
                    <span className="shrink-0 ml-3 text-xs text-muted">
                      {city}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent engagements — status right-aligned */}
      {engagements.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Recent Engagements
          </h2>
          <div>
            {engagements.slice(0, 5).map((eng) => (
              <Link
                key={eng.id}
                href={`/engagements/${eng.id}`}
                className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {eng.name}
                  </p>
                  {eng.partner_name && (
                    <p className="text-xs text-muted">{eng.partner_name}</p>
                  )}
                </div>
                <div className="shrink-0 ml-3 flex flex-col items-end gap-0.5">
                  <StatusBadge status={eng.status} />
                  <span className="text-xs text-muted">
                    {new Date(eng.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
