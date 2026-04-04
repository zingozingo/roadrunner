"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { ProgramCategoryBadge } from "@/components/shared/TypeBadge";
import { Program, ProgramCategory } from "@/lib/types";

type ProgramWithCount = Program & { linked_count: number };

const CATEGORY_ORDER: ProgramCategory[] = [
  "Specialization",
  "Funding",
  "Agreement",
  "Operational",
  "Enablement",
];

const CATEGORY_FILTER_OPTIONS = CATEGORY_ORDER.map((c) => ({
  label: c,
  value: c,
}));

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString("en-US");
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
        const matchesSubtype = program.subtype?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesSubtype) return false;
      }
      // Category filter
      if (activeFilter && program.category !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [programs, searchQuery, activeFilter]);


  return (
    <PageContainer>
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
            filterOptions={CATEGORY_FILTER_OPTIONS}
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
            <div>
              {filteredPrograms
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((program) => (
                <Link
                  key={program.id}
                  href={`/programs/${program.id}`}
                  className="flex items-center gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {program.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <ProgramCategoryBadge category={program.category} />
                    {program.subtype && (
                      <span className="text-xs text-muted">{program.subtype}</span>
                    )}
                  </div>
                  {program.mdf_value != null && (
                    <span className="shrink-0 text-xs text-muted">
                      {formatCurrency(program.mdf_value)}
                    </span>
                  )}
                  {program.linked_count > 0 && (
                    <span className="shrink-0 text-xs text-muted">
                      {program.linked_count} engagement{program.linked_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
