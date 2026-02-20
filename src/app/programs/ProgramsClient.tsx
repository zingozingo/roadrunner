"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import FilterBar from "@/components/layout/FilterBar";
import { ProgramTypeBadge } from "@/components/shared/TypeBadge";
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

interface ProgramsClientProps {
  programs: ProgramWithCount[];
}

export default function ProgramsClient({ programs }: ProgramsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  function handleFilterToggle(value: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

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
      if (activeFilters.size > 0 && program.type && !activeFilters.has(program.type)) {
        return false;
      }
      if (activeFilters.size > 0 && !program.type) {
        return false;
      }
      return true;
    });
  }, [programs, searchQuery, activeFilters]);

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
            activeFilters={activeFilters}
            onSearchChange={setSearchQuery}
            onFilterToggle={handleFilterToggle}
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
                      <Link
                        key={program.id}
                        href={`/programs/${program.id}`}
                        className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground">
                                {program.name}
                              </h3>
                              <StatusBadge status={program.status} />
                              <ProgramTypeBadge type={program.type} />
                            </div>
                            {program.description && (
                              <p className="mt-1 line-clamp-2 text-sm text-muted">
                                {program.description}
                              </p>
                            )}
                          </div>
                          {program.linked_count > 0 && (
                            <span className="shrink-0 text-xs text-muted">
                              {program.linked_count} link{program.linked_count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {program.eligibility && (
                          <p className="mt-2 line-clamp-1 text-xs text-muted">
                            Requirements: {program.eligibility}
                          </p>
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
