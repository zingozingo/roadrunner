"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
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
      <PageHeader
        title="Programs"
        subtitle={`${programs.length} program${programs.length !== 1 ? "s" : ""} synced`}
      />

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
              {grouped.map((group) => {
                const defaultOpen = !!searchQuery || group.programs.length < 10;
                return (
                  <details
                    key={group.type}
                    open={defaultOpen || undefined}
                    className="group"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 pb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted/70 [&::-webkit-details-marker]:hidden">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 transition-transform group-open:rotate-90">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      {pluralizeType(group.type)}
                      <span className="font-normal text-muted/50">{group.programs.length}</span>
                    </summary>
                    <div>
                      {group.programs.map((program) => (
                        <Link
                          key={program.id}
                          href={`/programs/${program.id}`}
                          className="flex items-baseline gap-4 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {isGroupedView ? stripTypeSuffix(program.name, group.type) : program.name}
                          </span>
                          {program.linked_count > 0 && (
                            <span className="shrink-0 text-xs text-muted">
                              {program.linked_count} engagement{program.linked_count !== 1 ? "s" : ""}
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
