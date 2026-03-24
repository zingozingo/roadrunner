"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import PillarBadge from "@/components/shared/PillarBadge";
import { Engagement } from "@/lib/types";
import { formatFooterDate } from "@/lib/format-utils";

type EngagementWithCounts = Engagement & { message_count: number; partner_name: string | null };

const STATUS_FILTER_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Planned", value: "planned" },
  { label: "Blocked", value: "blocked" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

const statusDotColor: Record<string, string> = {
  active: "bg-emerald-500",
  planned: "bg-blue-400",
  blocked: "bg-amber-500",
  completed: "bg-violet-500",
  archived: "bg-zinc-500",
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
        if (!matchesName && !matchesPartner && !matchesPillar && !matchesTopic) return false;
      }
      if (activeFilter && eng.status !== activeFilter) return false;
      return true;
    });
  }, [engagements, searchQuery, activeFilter]);

  const partnerGroups = useMemo(() => {
    const groupMap = new Map<string, EngagementWithCounts[]>();
    for (const eng of filteredEngagements) {
      const key = eng.partner_name ?? "Unassigned";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(eng);
    }
    const entries = [...groupMap.entries()].sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
    // Within each group: active first, then by updated_at desc
    for (const [, items] of entries) {
      items.sort((a, b) => {
        const aActive = a.status === "active" ? 0 : 1;
        const bActive = b.status === "active" ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    }
    return entries;
  }, [filteredEngagements]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
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
            <div className="space-y-8">
              {partnerGroups.map(([partnerName, items]) => (
                <section key={partnerName}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted/70">
                    {partnerName}
                    <span className="ml-1.5 font-normal text-muted/50">{items.length}</span>
                  </h2>
                  <div>
                    {items.map((eng) => {
                      const dotColor = statusDotColor[eng.status] ?? "bg-zinc-500";
                      return (
                        <Link
                          key={eng.id}
                          href={`/engagements/${eng.id}`}
                          className="flex items-center gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {eng.name}
                          </span>
                          {eng.pillar && (
                            <span className="shrink-0">
                              <PillarBadge pillar={eng.pillar} />
                            </span>
                          )}
                          {eng.status !== "active" && (
                            <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} title={eng.status} />
                          )}
                          <span className="shrink-0 text-xs text-muted">
                            {formatFooterDate(eng.updated_at)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
