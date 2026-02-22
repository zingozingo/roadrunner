"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import FilterBar from "@/components/layout/FilterBar";
import { ProgramTypeBadge } from "@/components/shared/TypeBadge";
import SyncButton from "@/components/shared/SyncButton";
import CompactRow from "@/components/shared/CompactRow";
import { Program, ProgramType } from "@/lib/types";

type ProgramWithCount = Program & { linked_count: number };

const TYPE_ORDER: ProgramType[] = [
  "Competency",
  "Service Ready",
  "Program",
  "SCA",
  "Credit Program",
  "Funding",
  "Channel",
  "Enablement",
];

const TYPE_FILTER_OPTIONS = TYPE_ORDER.map((t) => ({
  label: t,
  value: t,
}));

interface ProgramsClientProps {
  programs: ProgramWithCount[];
}

export default function ProgramsClient({ programs }: ProgramsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Only show status badges if programs have mixed statuses
  const hasMultipleStatuses = useMemo(() => {
    const statuses = new Set(programs.map((p) => p.status));
    return statuses.size > 1;
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    return programs.filter((program) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = program.name.toLowerCase().includes(q);
        const matchesDesc = program.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      // Type filter
      if (activeFilter && program.type !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [programs, searchQuery, activeFilter]);

  // Group by type
  const grouped = useMemo(() => {
    const groups: { type: ProgramType; programs: ProgramWithCount[] }[] = [];

    for (const type of TYPE_ORDER) {
      const items = filteredPrograms
        .filter((t) => t.type === type)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (items.length > 0) {
        groups.push({ type, programs: items });
      }
    }

    // Uncategorized (null type)
    const uncategorized = filteredPrograms
      .filter((t) => !t.type)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      groups.push({ type: "Program" as ProgramType, programs: uncategorized });
    }

    return groups;
  }, [filteredPrograms]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Programs"
          subtitle={`${programs.length} program${programs.length !== 1 ? "s" : ""} synced`}
        />
        <SyncButton entity="programs" label="Sync Programs" compact />
      </div>

      {programs.length === 0 ? (
        <EmptyState
          title="No programs yet"
          description="Programs will appear after syncing from Airtable"
        />
      ) : (
        <>
          <FilterBar
            searchPlaceholder="Search programs..."
            filterOptions={TYPE_FILTER_OPTIONS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filteredPrograms.length}
            totalCount={programs.length}
            entityName="programs"
          />

          {filteredPrograms.length === 0 ? (
            <EmptyState
              title="No matching programs"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.type}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                      {group.type === "Competency" ? "Competencies" : group.type === "SCA" ? "SCAs" : `${group.type}s`}
                    </h2>
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                      {group.programs.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.programs.map((program) => (
                      <CompactRow
                        key={program.id}
                        href={`/programs/${program.id}`}
                        primary={program.name}
                        badges={
                          <>
                            {hasMultipleStatuses && <StatusBadge status={program.status} />}
                            <ProgramTypeBadge type={program.type} />
                          </>
                        }
                        meta={
                          program.linked_count > 0 ? (
                            <span>{program.linked_count} link{program.linked_count !== 1 ? "s" : ""}</span>
                          ) : undefined
                        }
                      />
                    ))}
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
