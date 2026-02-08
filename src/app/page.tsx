import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import {
  getUnresolvedReviewCount,
  getAllInitiatives,
  getAllEventsWithCounts,
} from "@/lib/supabase";

export default async function DashboardPage() {
  const [reviewCount, initiatives, events] = await Promise.all([
    getUnresolvedReviewCount(),
    getAllInitiatives(),
    getAllEventsWithCounts(),
  ]);

  const activeCount = initiatives.filter((i) => i.status === "active").length;

  // Upcoming events (events with a future start_date)
  const now = new Date().toISOString();
  const upcoming = events
    .filter((e) => e.start_date && e.start_date > now)
    .slice(0, 3);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        subtitle="Relay — AI-powered initiative tracker"
      />

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
          href="/initiatives"
          className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
        >
          <p className="text-sm font-medium text-muted">Active Initiatives</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {activeCount}
          </p>
          <p className="mt-2 text-xs text-muted">
            {initiatives.length} total
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

      {/* Upcoming events detail */}
      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Upcoming Events
          </h2>
          <div className="space-y-2">
            {upcoming.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {event.name}
                  </p>
                  {event.location && (
                    <p className="text-xs text-muted">{event.location}</p>
                  )}
                </div>
                <time className="text-sm text-muted">
                  {event.start_date
                    ? new Date(event.start_date).toLocaleDateString()
                    : "TBD"}
                </time>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent initiatives */}
      {initiatives.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Recent Initiatives
          </h2>
          <div className="space-y-2">
            {initiatives.slice(0, 5).map((init) => (
              <Link
                key={init.id}
                href={`/initiatives/${init.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {init.name}
                  </p>
                  {init.partner_name && (
                    <p className="text-xs text-muted">{init.partner_name}</p>
                  )}
                </div>
                <StatusBadge status={init.status} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
