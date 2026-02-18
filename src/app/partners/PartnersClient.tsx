"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import SyncButton from "@/components/shared/SyncButton";
import { Partner } from "@/lib/types";

const SEGMENT_FILTER_OPTIONS = [
  { label: "Security", value: "security" },
  { label: "SecOps", value: "secops" },
  { label: "DevOps", value: "devops" },
  { label: "CloudOps", value: "cloudops" },
  { label: "Observability", value: "observability" },
  { label: "OT/IoT", value: "ot/iot" },
];

interface PartnersClientProps {
  partners: Partner[];
}

export default function PartnersClient({ partners }: PartnersClientProps) {
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

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSegment = p.segment?.toLowerCase().includes(q);
        const matchesFocusArea = p.focus_area.some((a) => a.toLowerCase().includes(q));
        const matchesLead = p.alliance_lead?.toLowerCase().includes(q);
        const matchesPsa = p.psa?.toLowerCase().includes(q);
        if (!matchesName && !matchesSegment && !matchesFocusArea && !matchesLead && !matchesPsa) return false;
      }
      if (activeFilters.size > 0 && p.segment && !activeFilters.has(p.segment)) {
        return false;
      }
      if (activeFilters.size > 0 && !p.segment) {
        return false;
      }
      return true;
    });
  }, [partners, searchQuery, activeFilters]);

  // Group by segment
  const grouped = useMemo(() => {
    const segmentOrder = ["security", "secops", "devops", "cloudops", "observability", "ot/iot"];
    const segmentLabels: Record<string, string> = {
      security: "Security",
      secops: "SecOps",
      devops: "DevOps",
      cloudops: "CloudOps",
      observability: "Observability",
      "ot/iot": "OT/IoT",
    };

    const groups: { segment: string; label: string; partners: Partner[] }[] = [];

    for (const seg of segmentOrder) {
      const items = filteredPartners
        .filter((p) => p.segment === seg)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (items.length > 0) {
        groups.push({ segment: seg, label: segmentLabels[seg] ?? seg, partners: items });
      }
    }

    // Unsegmented
    const unsegmented = filteredPartners
      .filter((p) => !p.segment || !segmentOrder.includes(p.segment))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (unsegmented.length > 0) {
      groups.push({ segment: "other", label: "Other", partners: unsegmented });
    }

    return groups;
  }, [filteredPartners]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Partners"
          subtitle={`${partners.length} partner${partners.length !== 1 ? "s" : ""} tracked`}
        />
        <SyncButton entity="partners" label="Sync Partners" compact />
      </div>

      {partners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          description="Partners will appear when synced from Airtable"
        />
      ) : (
        <>
          <FilterBar
            searchPlaceholder="Search partners..."
            filterOptions={SEGMENT_FILTER_OPTIONS}
            activeFilters={activeFilters}
            onSearchChange={setSearchQuery}
            onFilterToggle={handleFilterToggle}
            resultCount={filteredPartners.length}
            totalCount={partners.length}
            entityName="partners"
          />

          {filteredPartners.length === 0 ? (
            <EmptyState
              title="No matching partners"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.segment}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                      {group.label}
                    </h2>
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                      {group.partners.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.partners.map((partner) => (
                      <Link
                        key={partner.id}
                        href={`/partners/${partner.id}`}
                        className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground">
                                {partner.name}
                              </h3>
                              {partner.segment && (
                                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent whitespace-nowrap capitalize">
                                  {partner.segment}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted">
                              {[partner.focus_area.join(", "), partner.psa && `PSA: ${partner.psa}`]
                                .filter(Boolean)
                                .join(" · ") || "\u00A0"}
                            </p>
                          </div>
                          {partner.alliance_lead && (
                            <span className="shrink-0 text-xs text-muted">
                              {partner.alliance_lead}
                            </span>
                          )}
                        </div>
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
