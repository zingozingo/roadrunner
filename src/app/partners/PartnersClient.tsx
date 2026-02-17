"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import FilterBar from "@/components/FilterBar";
import SyncButton from "@/components/SyncButton";
import { Partner } from "@/lib/types";

const CATEGORY_FILTER_OPTIONS = [
  { label: "Infrastructure", value: "infrastructure" },
  { label: "HBA", value: "hba" },
  { label: "Industry Vert", value: "industry_vert" },
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
        const matchesCategory = p.category?.toLowerCase().includes(q);
        const matchesSubCategory = p.sub_category?.toLowerCase().includes(q);
        const matchesLead = p.alliance_lead?.toLowerCase().includes(q);
        const matchesPsa = p.psa?.toLowerCase().includes(q);
        if (!matchesName && !matchesCategory && !matchesSubCategory && !matchesLead && !matchesPsa) return false;
      }
      if (activeFilters.size > 0 && p.category && !activeFilters.has(p.category)) {
        return false;
      }
      if (activeFilters.size > 0 && !p.category) {
        return false;
      }
      return true;
    });
  }, [partners, searchQuery, activeFilters]);

  // Group by category
  const grouped = useMemo(() => {
    const categoryOrder = ["infrastructure", "hba", "industry_vert"];
    const categoryLabels: Record<string, string> = {
      infrastructure: "Infrastructure",
      hba: "HBA",
      industry_vert: "Industry Vert",
    };

    const groups: { category: string; label: string; partners: Partner[] }[] = [];

    for (const cat of categoryOrder) {
      const items = filteredPartners
        .filter((p) => p.category === cat)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (items.length > 0) {
        groups.push({ category: cat, label: categoryLabels[cat] ?? cat, partners: items });
      }
    }

    // Uncategorized
    const uncategorized = filteredPartners
      .filter((p) => !p.category || !categoryOrder.includes(p.category))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      groups.push({ category: "other", label: "Other", partners: uncategorized });
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
            filterOptions={CATEGORY_FILTER_OPTIONS}
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
                <section key={group.category}>
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
                              {partner.category && (
                                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent whitespace-nowrap">
                                  {partner.category.replace("_", " ")}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted">
                              {[partner.sub_category, partner.psa && `PSA: ${partner.psa}`]
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
