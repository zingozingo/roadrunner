"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import FilterBar from "@/components/FilterBar";
import { ProgramTypeBadge } from "@/components/TypeBadge";
import { Program, ProgramType } from "@/lib/types";

type TrackWithCount = Program & { linked_count: number };

const TYPE_ORDER: ProgramType[] = [
  "Competency",
  "Service Ready",
  "Program",
  "SCA",
  "Credit Program",
];

const TYPE_FILTER_OPTIONS = TYPE_ORDER.map((t) => ({
  label: t,
  value: t,
}));

interface TracksClientProps {
  tracks: TrackWithCount[];
}

export default function TracksClient({ tracks }: TracksClientProps) {
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

  const filteredTracks = useMemo(() => {
    return tracks.filter((track) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = track.name.toLowerCase().includes(q);
        const matchesDesc = track.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      // Type filter
      if (activeFilters.size > 0 && track.type && !activeFilters.has(track.type)) {
        return false;
      }
      if (activeFilters.size > 0 && !track.type) {
        return false;
      }
      return true;
    });
  }, [tracks, searchQuery, activeFilters]);

  // Group by type
  const grouped = useMemo(() => {
    const groups: { type: ProgramType; tracks: TrackWithCount[] }[] = [];

    for (const type of TYPE_ORDER) {
      const items = filteredTracks
        .filter((t) => t.type === type)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (items.length > 0) {
        groups.push({ type, tracks: items });
      }
    }

    // Uncategorized (null type)
    const uncategorized = filteredTracks
      .filter((t) => !t.type)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      groups.push({ type: "Program" as ProgramType, tracks: uncategorized });
    }

    return groups;
  }, [filteredTracks]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Tracks"
        subtitle={`${tracks.length} track${tracks.length !== 1 ? "s" : ""} tracked`}
      />

      {tracks.length === 0 ? (
        <EmptyState
          title="No tracks yet"
          description="Tracks will appear as they are extracted from emails"
        />
      ) : (
        <>
          <FilterBar
            searchPlaceholder="Search tracks..."
            filterOptions={TYPE_FILTER_OPTIONS}
            activeFilters={activeFilters}
            onSearchChange={setSearchQuery}
            onFilterToggle={handleFilterToggle}
            resultCount={filteredTracks.length}
            totalCount={tracks.length}
            entityName="tracks"
          />

          {filteredTracks.length === 0 ? (
            <EmptyState
              title="No matching tracks"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.type}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                      {group.type === "SCA" ? "SCAs" : `${group.type}s`}
                    </h2>
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                      {group.tracks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.tracks.map((track) => (
                      <Link
                        key={track.id}
                        href={`/tracks/${track.id}`}
                        className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground">
                                {track.name}
                              </h3>
                              <StatusBadge status={track.status} />
                              <ProgramTypeBadge type={track.type} />
                            </div>
                            {track.description && (
                              <p className="mt-1 line-clamp-2 text-sm text-muted">
                                {track.description}
                              </p>
                            )}
                          </div>
                          {track.linked_count > 0 && (
                            <span className="shrink-0 text-xs text-muted">
                              {track.linked_count} link{track.linked_count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {track.eligibility && (
                          <p className="mt-2 line-clamp-1 text-xs text-muted">
                            Requirements: {track.eligibility}
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
