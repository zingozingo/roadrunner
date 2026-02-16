"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import FilterBar from "@/components/FilterBar";
import { EventTypeBadge } from "@/components/TypeBadge";
import SyncButton from "@/components/SyncButton";
import { Event } from "@/lib/types";

type EventWithCount = Event & { linked_count: number };

const TYPE_FILTER_OPTIONS = [
  { label: "Conference", value: "conference" },
  { label: "Summit", value: "summit" },
  { label: "Workshop", value: "workshop" },
  { label: "Training", value: "training" },
  { label: "Trade Show", value: "trade_show" },
  { label: "Kickoff", value: "kickoff" },
  { label: "Deadline", value: "deadline" },
  { label: "Review Cycle", value: "review_cycle" },
];

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Date TBD";
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return s === e ? s : `${s} — ${e}`;
}

function getYear(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getFullYear();
}

interface YearGroup {
  year: number;
  events: EventWithCount[];
}

interface TimeSection {
  label: string;
  yearGroups: YearGroup[];
}

export default function EventsClient({ events }: { events: EventWithCount[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());

  // Collect unique years for filter pills
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const e of events) {
      if (e.start_date) years.add(getYear(e.start_date));
    }
    return [...years].sort();
  }, [events]);

  const [yearFilters, setYearFilters] = useState<Set<string>>(new Set());

  function handleTypeToggle(value: string) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleYearToggle(value: string) {
    setYearFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = event.name.toLowerCase().includes(q);
        const matchesHost = event.host?.toLowerCase().includes(q);
        const matchesLocation = event.location?.toLowerCase().includes(q);
        const matchesDesc = event.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesHost && !matchesLocation && !matchesDesc) return false;
      }
      // Type filter
      if (typeFilters.size > 0 && !typeFilters.has(event.type)) return false;
      // Year filter
      if (yearFilters.size > 0) {
        if (!event.start_date) return false;
        if (!yearFilters.has(String(getYear(event.start_date)))) return false;
      }
      return true;
    });
  }, [events, searchQuery, typeFilters, yearFilters]);

  // Organize into Upcoming / Past / Date TBD
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

    // Sort upcoming by date ascending
    upcoming.sort((a, b) => a.start_date!.localeCompare(b.start_date!));
    // Sort past by date descending
    past.sort((a, b) => b.start_date!.localeCompare(a.start_date!));
    // Sort TBD alphabetically
    tbd.sort((a, b) => a.name.localeCompare(b.name));

    function groupByYear(items: EventWithCount[]): YearGroup[] {
      const yearMap = new Map<number, EventWithCount[]>();
      for (const item of items) {
        const year = getYear(item.start_date!);
        if (!yearMap.has(year)) yearMap.set(year, []);
        yearMap.get(year)!.push(item);
      }
      return [...yearMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, evts]) => ({ year, events: evts }));
    }

    const result: TimeSection[] = [];

    if (upcoming.length > 0) {
      result.push({ label: "Upcoming", yearGroups: groupByYear(upcoming) });
    }
    if (past.length > 0) {
      // Reverse year order for past events (most recent year first)
      const pastGroups = groupByYear(past);
      pastGroups.reverse();
      result.push({ label: "Past", yearGroups: pastGroups });
    }
    if (tbd.length > 0) {
      result.push({
        label: "Date TBD",
        yearGroups: [{ year: 0, events: tbd }],
      });
    }

    return result;
  }, [filteredEvents]);

  const allYearFiltersActive = yearFilters.size === 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Events"
          subtitle={`${events.length} event${events.length !== 1 ? "s" : ""} tracked`}
        />
        <SyncButton entity="events" label="Sync Events" compact />
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Events will appear as they are extracted from emails"
        />
      ) : (
        <>
          {/* Search + Type filter */}
          <FilterBar
            searchPlaceholder="Search events..."
            filterOptions={TYPE_FILTER_OPTIONS}
            activeFilters={typeFilters}
            onSearchChange={setSearchQuery}
            onFilterToggle={handleTypeToggle}
            resultCount={filteredEvents.length}
            totalCount={events.length}
            entityName="events"
          />

          {/* Year filter pills */}
          {availableYears.length > 1 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted mr-1">Year:</span>
              <button
                onClick={() => {
                  for (const y of yearFilters) handleYearToggle(y);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  allYearFiltersActive
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                All
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => handleYearToggle(String(year))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    yearFilters.has(String(year))
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          {filteredEvents.length === 0 ? (
            <EmptyState
              title="No matching events"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.label}>
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {section.label}
                    <span className="ml-2 text-sm font-normal text-muted">
                      ({section.yearGroups.reduce((sum, g) => sum + g.events.length, 0)})
                    </span>
                  </h2>

                  <div className="space-y-6">
                    {section.yearGroups.map((group) => (
                      <div key={group.year}>
                        {group.year > 0 && (
                          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                            {group.year}
                          </h3>
                        )}
                        <div className="space-y-2">
                          {group.events.map((event) => (
                            <Link
                              key={event.id}
                              href={`/events/${event.id}`}
                              className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-medium text-foreground">
                                      {event.name}
                                    </h3>
                                    <EventTypeBadge type={event.type} />
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
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
