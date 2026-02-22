"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import FilterBar from "@/components/layout/FilterBar";
import SyncButton from "@/components/shared/SyncButton";
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

/** Plural form of a program type for group headers */
function pluralizeType(type: ProgramType): string {
  if (type === "Competency") return "Competencies";
  if (type === "SCA") return "SCAs";
  return `${type}s`;
}

/** Strip trailing type word from program name when it matches the group type */
function stripTypeSuffix(name: string, groupType: ProgramType): string {
  // Only strip single-word type names that appear as trailing word
  const typeLower = groupType.toLowerCase();
  const nameLower = name.toLowerCase();
  if (nameLower.endsWith(` ${typeLower}`)) {
    return name.slice(0, -(groupType.length + 1)).trim();
  }
  return name;
}

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

  const isGroupedView = !searchQuery;

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

    // Merge uncategorized (null type) into the "Program" group
    const uncategorized = filteredPrograms
      .filter((t) => !t.type)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      const programGroup = groups.find((g) => g.type === "Program");
      if (programGroup) {
        programGroup.programs = [...programGroup.programs, ...uncategorized]
          .sort((a, b) => a.name.localeCompare(b.name));
      } else {
        groups.push({ type: "Program" as ProgramType, programs: uncategorized });
      }
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
                      {pluralizeType(group.type)}
                    </h2>
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                      {group.programs.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.programs.map((program) => (
                      <Link
                        key={program.id}
                        href={`/programs/${program.id}`}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-accent/40 hover:bg-surface-hover"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {isGroupedView
                            ? stripTypeSuffix(program.name, group.type)
                            : program.name}
                        </span>
                        {hasMultipleStatuses && (
                          <StatusBadge status={program.status} />
                        )}
                        {program.linked_count > 0 && (
                          <span className="shrink-0 text-xs text-muted">
                            {program.linked_count}
                          </span>
                        )}
                      </Link>
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
