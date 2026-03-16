"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import PillarBadge from "@/components/shared/PillarBadge";
import { Engagement } from "@/lib/types";

type EngagementWithCounts = Engagement & { message_count: number; partner_name: string | null };

const STATUS_FILTER_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Planned", value: "planned" },
  { label: "Blocked", value: "blocked" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

const statusOrder: Record<string, number> = {
  active: 0,
  planned: 1,
  blocked: 2,
  completed: 3,
  archived: 4,
};

interface EngagementsClientProps {
  engagements: EngagementWithCounts[];
}

export default function EngagementsClient({ engagements }: EngagementsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredEngagements = useMemo(() => {
    return engagements.filter((eng) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = eng.name.toLowerCase().includes(q);
        const matchesPartner = eng.partner_name?.toLowerCase().includes(q);
        const matchesPillar = eng.pillar?.toLowerCase().includes(q);
        const matchesTopic = eng.topic?.toLowerCase().includes(q);
        const matchesGoal = eng.goal?.toLowerCase().includes(q);
        if (!matchesName && !matchesPartner && !matchesPillar && !matchesTopic && !matchesGoal) return false;
      }
      if (activeFilter && eng.status !== activeFilter) return false;
      return true;
    });
  }, [engagements, searchQuery, activeFilter]);

  const statusGroups = useMemo(() => {
    const grouped = filteredEngagements.reduce(
      (acc, eng) => {
        const status = eng.status;
        if (!acc[status]) acc[status] = [];
        acc[status].push(eng);
        return acc;
      },
      {} as Record<string, EngagementWithCounts[]>
    );

    return Object.entries(grouped).sort(
      ([a], [b]) => (statusOrder[a] ?? 99) - (statusOrder[b] ?? 99)
    );
  }, [filteredEngagements]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Engagements"
        subtitle={`${engagements.length} engagement${engagements.length !== 1 ? "s" : ""} tracked`}
      />

      {engagements.length === 0 ? (
        <EmptyState
          title="No engagements yet"
          description="Engagements will appear here as emails are classified"
        />
      ) : (
        <>
          <FilterBar
            searchPlaceholder="Search engagements..."
            filterOptions={STATUS_FILTER_OPTIONS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filteredEngagements.length}
            totalCount={engagements.length}
            entityName="engagements"
          />

          {filteredEngagements.length === 0 ? (
            <EmptyState
              title="No matching engagements"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-4">
              {statusGroups.map(([status, items]) => {
                const defaultOpen = !!searchQuery || items.length < 10;
                return (
                  <details
                    key={status}
                    open={defaultOpen || undefined}
                    className="group rounded-xl border border-border/40 bg-surface"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 transition-transform group-open:rotate-90">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      {status}
                      <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">{items.length}</span>
                    </summary>
                    <div className="px-4 pb-4">
                      {items.map((eng) => (
                        <Link
                          key={eng.id}
                          href={`/engagements/${eng.id}`}
                          className="flex items-baseline gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {eng.name}
                          </span>
                          {eng.partner_name && (
                            <span className="shrink-0 text-xs text-muted">
                              {eng.partner_name}
                            </span>
                          )}
                          {eng.pillar && (
                            <span className="shrink-0">
                              <PillarBadge pillar={eng.pillar} />
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
