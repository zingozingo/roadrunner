"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { Meeting } from "@/lib/types";
import { cleanMeetingTitle } from "@/lib/format-utils";

type MeetingWithNames = Meeting & { engagement_name: string | null; partner_name: string | null };

const MEETING_TYPE_OPTIONS = [
  { label: "Partner Cadence Call", value: "Partner Cadence Call" },
  { label: "Co-Build Cadence", value: "Co-Build Cadence" },
  { label: "Co-Market Cadence", value: "Co-Market Cadence" },
  { label: "Co-Sell Cadence", value: "Co-Sell Cadence" },
  { label: "Co-Sell Strategy", value: "Co-Sell Strategy" },
  { label: "SCA Review", value: "SCA Review" },
  { label: "QBR", value: "QBR" },
  { label: "Product Team Sync", value: "Product Team Sync" },
  { label: "Executive Meeting", value: "Executive Meeting" },
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
      if (activeFilter && m.meeting_type !== activeFilter) return false;
      return true;
    });
  }, [meetings, searchQuery, activeFilter]);

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

    upcoming.sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!));
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
      <PageHeader
        title="Meetings"
        subtitle={`${meetings.length} meeting${meetings.length !== 1 ? "s" : ""} tracked`}
      />

      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Meetings will appear here as calendar invites are processed"
        />
      ) : (
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
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {section.label}
                    <span className="ml-2 text-sm font-normal text-muted">
                      ({section.meetings.length})
                    </span>
                  </h2>

                  {section.meetings.map((m) => {
                    const shortDate = m.meeting_date
                      ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "TBD";

                    return (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="flex items-baseline gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover"
                      >
                        <span className="w-24 shrink-0 text-xs text-muted">
                          {shortDate}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {cleanMeetingTitle(m.title)}
                        </span>
                        {m.partner_name && (
                          <span className="shrink-0 text-xs text-muted">
                            {m.partner_name}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
