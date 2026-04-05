"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { Event } from "@/lib/types";
import { extractCity, formatCompactDateRange } from "@/lib/format-utils";

type EventWithCount = Event & { linked_count: number };

const TYPE_FILTER_OPTIONS = [
  { label: "Conference", value: "conference" },
  { label: "Summit", value: "summit" },
  { label: "Workshop", value: "workshop" },
  { label: "Training", value: "training" },
  { label: "Trade Show", value: "trade_show" },
  { label: "Webinar", value: "webinar" },
  { label: "Roundtable", value: "roundtable" },
];

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
}

function formatMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface MonthGroup {
  key: string;
  label: string;
  events: EventWithCount[];
}

interface TimeSection {
  label: string;
  monthGroups: MonthGroup[];
}

export default function EventsClient({ events }: { events: EventWithCount[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const [showArchived, setShowArchived] = useState(false);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!showArchived && event.archived) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = event.name.toLowerCase().includes(q);
        const matchesHost = event.host?.toLowerCase().includes(q);
        const matchesLocation = event.location?.toLowerCase().includes(q);
        const matchesDesc = event.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesHost && !matchesLocation && !matchesDesc) return false;
      }
      if (typeFilter && event.type !== typeFilter) return false;
      return true;
    });
  }, [events, searchQuery, typeFilter, showArchived]);

  const archivedCount = useMemo(() => events.filter((e) => e.archived).length, [events]);

  const sections = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming: EventWithCount[] = [];
    const past: EventWithCount[] = [];
    const tbd: EventWithCount[] = [];

    for (const event of filteredEvents) {
      if (!event.start_date) {
        tbd.push(event);
      } else {
        const eventDate = new Date(event.start_date + "T00:00:00");
        if (eventDate >= now) {
          upcoming.push(event);
        } else {
          past.push(event);
        }
      }
    }

    upcoming.sort((a, b) => a.start_date!.localeCompare(b.start_date!));
    past.sort((a, b) => b.start_date!.localeCompare(a.start_date!));
    tbd.sort((a, b) => a.name.localeCompare(b.name));

    function groupByMonth(items: EventWithCount[]): MonthGroup[] {
      const monthMap = new Map<string, { label: string; events: EventWithCount[] }>();
      for (const item of items) {
        const key = getMonthKey(item.start_date!);
        if (!monthMap.has(key)) {
          monthMap.set(key, { label: formatMonthLabel(item.start_date!), events: [] });
        }
        monthMap.get(key)!.events.push(item);
      }
      return [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, { label, events: evts }]) => ({ key, label, events: evts }));
    }

    const result: TimeSection[] = [];

    if (upcoming.length > 0) {
      result.push({ label: "Upcoming", monthGroups: groupByMonth(upcoming) });
    }
    if (past.length > 0) {
      const pastGroups = groupByMonth(past);
      pastGroups.reverse();
      result.push({ label: "Past", monthGroups: pastGroups });
    }
    if (tbd.length > 0) {
      result.push({
        label: "Date TBD",
        monthGroups: [{ key: "tbd", label: "Date TBD", events: tbd }],
      });
    }

    return result;
  }, [filteredEvents]);

  return (
    <PageContainer>
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
        <>
          <FilterBar
            searchPlaceholder="Search events..."
            filterOptions={TYPE_FILTER_OPTIONS}
            activeFilter={typeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setTypeFilter}
            resultCount={filteredEvents.length}
            totalCount={events.length}
            entityName="events"
          />

          {archivedCount > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`text-xs transition-colors ${showArchived ? "text-accent" : "text-muted/60 hover:text-muted"}`}
              >
                {showArchived ? "Hide" : "Show"} {archivedCount} archived
              </button>
            </div>
          )}

          {filteredEvents.length === 0 ? (
            <EmptyState
              title="No matching events"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {sections.map((section) => {
                const isUpcoming = section.label === "Upcoming";
                const isTbd = section.label === "Date TBD";
                const sectionCount = section.monthGroups.reduce((sum, g) => sum + g.events.length, 0);

                return (
                  <div key={section.label}>
                    <h2 className="mb-4 text-lg font-semibold text-foreground">
                      {section.label}
                      <span className="ml-2 text-sm font-normal text-muted">
                        ({sectionCount})
                      </span>
                    </h2>

                    <div className="space-y-6">
                      {section.monthGroups.map((group) => {
                        const monthDefaultOpen = isUpcoming || isTbd || !!searchQuery;
                        return (
                          <details
                            key={group.key}
                            open={monthDefaultOpen || undefined}
                            className="group"
                          >
                            <summary className="flex cursor-pointer list-none items-center gap-2 pb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted/70 [&::-webkit-details-marker]:hidden">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 transition-transform group-open:rotate-90">
                                <path d="M6 4l4 4-4 4" />
                              </svg>
                              {group.label}
                              <span className="font-normal text-muted/50">{group.events.length}</span>
                            </summary>
                            <div>
                              {group.events.map((event) => (
                                <Link
                                  key={event.id}
                                  href={`/events/${event.id}`}
                                  className={`flex items-baseline gap-4 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50 ${event.archived ? "opacity-50" : ""}`}
                                >
                                  <span className="w-24 shrink-0 text-xs text-muted">
                                    {formatCompactDateRange(event.start_date ?? "", event.end_date ?? null)}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                    {event.name}
                                    {event.archived && (
                                      <span className="ml-2 text-[10px] font-normal text-muted/50">archived</span>
                                    )}
                                  </span>
                                  {extractCity(event.location) && (
                                    <span className="shrink-0 text-xs text-muted">
                                      {extractCity(event.location)}
                                    </span>
                                  )}
                                </Link>
                              ))}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
