import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { getAllEventsWithCounts } from "@/lib/supabase";
import { Event } from "@/lib/types";

const typeColors: Record<Event["type"], string> = {
  conference: "bg-[#8b5cf6]/20 text-[#8b5cf6]",
  summit: "bg-[#6366f1]/20 text-[#6366f1]",
  deadline: "bg-[#ef4444]/20 text-[#ef4444]",
  review_cycle: "bg-[#f59e0b]/20 text-[#f59e0b]",
  meeting_series: "bg-[#06b6d4]/20 text-[#06b6d4]",
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "No date set";
  const s = new Date(start).toLocaleDateString();
  if (!end) return s;
  const e = new Date(end).toLocaleDateString();
  return s === e ? s : `${s} — ${e}`;
}

export default async function EventsPage() {
  const events = await getAllEventsWithCounts();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Events"
        subtitle={`${events.length} event${events.length !== 1 ? "s" : ""} tracked`}
      />

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Events will appear as they are extracted from emails"
        />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">
                      {event.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        typeColors[event.type] ?? "bg-border text-muted"
                      }`}
                    >
                      {event.type.replace("_", " ")}
                    </span>
                    {!event.verified && (
                      <StatusBadge status="unverified" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDateRange(event.start_date, event.end_date)}
                    {event.location && ` · ${event.location}`}
                  </p>
                </div>
                {event.linked_count > 0 && (
                  <span className="shrink-0 text-xs text-muted">
                    {event.linked_count} link{event.linked_count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {event.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
