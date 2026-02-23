"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import CalendarCard from "@/components/shared/CalendarCard";
import { Event } from "@/lib/types";
import { extractCity } from "@/lib/format-utils";

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

/** Map event type to CSS color value for CalendarCard typeColor */
const typeColorMap: Record<Event["type"], string> = {
  conference: "var(--event-conference)",
  summit: "var(--event-summit)",
  workshop: "var(--event-workshop)",
  kickoff: "var(--event-kickoff)",
  trade_show: "var(--event-trade-show)",
  deadline: "var(--event-deadline)",
  review_cycle: "var(--event-review-cycle)",
  training: "var(--event-training)",
};

function getYear(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getFullYear();
}

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

  // Collect unique years for filter pills
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const e of events) {
      if (e.start_date) years.add(getYear(e.start_date));
    }
    return [...years].sort();
  }, [events]);

  const [yearFilter, setYearFilter] = useState<string | null>(null);

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
      if (typeFilter && event.type !== typeFilter) return false;
      // Year filter
      if (yearFilter) {
        if (!event.start_date) return false;
        if (String(getYear(event.start_date)) !== yearFilter) return false;
      }
      return true;
    });
  }, [events, searchQuery, typeFilter, yearFilter]);

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
      // Reverse month order for past events (most recent first)
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
        <>
          {/* Search + Type filter */}
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

          {/* Year filter chips */}
          {availableYears.length > 1 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted mr-1">Year:</span>
              <button
                onClick={() => setYearFilter(null)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  yearFilter === null
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                All
              </button>
              {availableYears.map((year) => {
                const isActive = yearFilter === String(year);
                return (
                  <button
                    key={year}
                    onClick={() => setYearFilter(isActive ? null : String(year))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
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
                      ({section.monthGroups.reduce((sum, g) => sum + g.events.length, 0)})
                    </span>
                  </h2>

                  <div className="space-y-6">
                    {section.monthGroups.map((group) => (
                      <div key={group.key}>
                        {group.key !== "tbd" && (
                          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                            {group.label}
                          </h3>
                        )}
                        <CalendarCard
                          columns={2}
                          items={group.events.map((event) => ({
                            id: event.id,
                            href: `/events/${event.id}`,
                            name: event.name + (!event.verified ? " *" : ""),
                            startDate: event.start_date ?? "",
                            endDate: event.end_date ?? undefined,
                            location: extractCity(event.location),
                            typeColor: typeColorMap[event.type],
                          }))}
                        />
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
