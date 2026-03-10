"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { MeetingStatusBadge } from "@/components/shared/TypeBadge";
import { Meeting } from "@/lib/types";
import { cleanMeetingTitle } from "@/lib/format-utils";

type MeetingWithNames = Meeting & { engagement_name: string | null; partner_name: string | null };

const MEETING_TYPE_OPTIONS = [
  { label: "Executive", value: "Executive Meeting" },
  { label: "GTM", value: "GTM Meeting" },
  { label: "Product Team", value: "Product Team Relationship" },
  { label: "Specialized", value: "Specialized Meeting" },
];

interface MeetingsClientProps {
  meetings: MeetingWithNames[];
}

export default function MeetingsClient({ meetings }: MeetingsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesLocation = m.location?.toLowerCase().includes(q);
        const matchesNotes = m.notes?.toLowerCase().includes(q);
        const matchesEngagement = m.engagement_name?.toLowerCase().includes(q);
        const matchesPartner = m.partner_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLocation && !matchesNotes && !matchesEngagement && !matchesPartner) return false;
      }
      if (activeFilter && m.status !== activeFilter) return false;
      return true;
    });
  }, [meetings, searchQuery, activeFilter]);

  // Group into upcoming vs past
  const sections = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming: MeetingWithNames[] = [];
    const past: MeetingWithNames[] = [];
    const tbd: MeetingWithNames[] = [];

    for (const m of filteredMeetings) {
      if (!m.meeting_date) {
        tbd.push(m);
      } else {
        const mDate = new Date(m.meeting_date + "T00:00:00");
        if (mDate >= now) upcoming.push(m);
        else past.push(m);
      }
    }

    // Upcoming: nearest first
    upcoming.sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!));
    // Past: most recent first
    past.sort((a, b) => b.meeting_date!.localeCompare(a.meeting_date!));
    tbd.sort((a, b) => a.title.localeCompare(b.title));

    const result: { label: string; meetings: MeetingWithNames[] }[] = [];
    if (upcoming.length > 0) result.push({ label: "Upcoming", meetings: upcoming });
    if (past.length > 0) result.push({ label: "Past", meetings: past });
    if (tbd.length > 0) result.push({ label: "Date TBD", meetings: tbd });
    return result;
  }, [filteredMeetings]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title="Meetings"
          subtitle={`${meetings.length} meeting${meetings.length !== 1 ? "s" : ""} tracked`}
        />
      </div>

      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Meetings will appear here as calendar invites are processed"
        />
      ) : meetings.length > 0 && (
        <>
          <FilterBar
            searchPlaceholder="Search meetings..."
            filterOptions={MEETING_TYPE_OPTIONS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filteredMeetings.length}
            totalCount={meetings.length}
            entityName="meetings"
          />

          {filteredMeetings.length === 0 ? (
            <EmptyState
              title="No matching meetings"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.label}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                    {section.label} ({section.meetings.length})
                  </h2>
                  <div>
                    {section.meetings.map((m) => {
                      const shortDate = m.meeting_date
                        ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "TBD";
                      const timeStr = m.start_time
                        ? m.end_time ? `${m.start_time} – ${m.end_time}` : m.start_time
                        : "";

                      return (
                        <a
                          key={m.id}
                          href={`/meetings/${m.id}`}
                          className="flex items-center px-4 py-2.5 border-b border-border/50 transition-colors duration-150 hover:bg-surface gap-3"
                        >
                          <span className="shrink-0 w-16 text-sm font-medium text-foreground">
                            {shortDate}
                          </span>
                          <span className="shrink-0 w-24 text-xs text-muted hidden sm:block">
                            {timeStr}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {cleanMeetingTitle(m.title)}
                          </span>
                          {m.partner_name && (
                            <span className="shrink-0 text-xs text-muted hidden md:block">
                              {m.partner_name}
                            </span>
                          )}
                          <span className="shrink-0 ml-auto">
                            <MeetingStatusBadge status={m.status} />
                          </span>
                        </a>
                      );
                    })}
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
