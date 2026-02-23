"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import TableList from "@/components/shared/TableList";
import { Partner } from "@/lib/types";

const SEGMENT_FILTER_OPTIONS = [
  { label: "Security", value: "security" },
  { label: "SecOps", value: "secops" },
  { label: "DevOps", value: "devops" },
  { label: "CloudOps", value: "cloudops" },
  { label: "Observability", value: "observability" },
  { label: "OT/IoT", value: "ot/iot" },
];

const TABLE_HEADERS = [
  { label: "Partner" },
  { label: "Focus", width: "200px" },
  { label: "Alliance Lead", width: "160px" },
  { label: "PSA", width: "140px" },
];

interface PartnersClientProps {
  partners: Partner[];
}

export default function PartnersClient({ partners }: PartnersClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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
      if (activeFilter && p.segment !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [partners, searchQuery, activeFilter]);

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
      <PageHeader
        title="Partners"
        subtitle={`${partners.length} partner${partners.length !== 1 ? "s" : ""} tracked`}
      />

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
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
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
            <>
              {/* Column headers — shown once at the top */}
              <div className="flex items-center px-4 py-2 mb-2">
                {TABLE_HEADERS.map((header, i) => (
                  <span
                    key={header.label}
                    className="text-xs font-semibold uppercase tracking-wider text-muted"
                    style={
                      header.width
                        ? { width: header.width, flexShrink: 0 }
                        : { flex: i === 0 ? 1 : undefined }
                    }
                  >
                    {header.label}
                  </span>
                ))}
              </div>

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
                    <TableList
                      items={group.partners.map((partner) => ({
                        id: partner.id,
                        href: `/partners/${partner.id}`,
                        columns: [
                          { value: partner.name },
                          { value: partner.focus_area[0] ?? "", width: "200px" },
                          { value: partner.alliance_lead ?? "", width: "160px" },
                          { value: partner.psa ?? "", width: "140px" },
                        ],
                      }))}
                    />
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
