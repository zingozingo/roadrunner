"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { Partner } from "@/lib/types";

const SEGMENT_FILTER_OPTIONS = [
  { label: "Security", value: "security" },
  { label: "SecOps", value: "secops" },
  { label: "DevOps", value: "devops" },
  { label: "CloudOps", value: "cloudops" },
  { label: "Observability", value: "observability" },
  { label: "OT/IoT", value: "ot/iot" },
];

interface PartnerContact {
  name: string | null;
  email: string;
  role: string | null;
  org_type: string | null;
}

interface PartnersClientProps {
  partners: Partner[];
  contactsByPartner: Record<string, PartnerContact[]>;
}

export default function PartnersClient({ partners, contactsByPartner }: PartnersClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Sync failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSegment = p.segment?.toLowerCase().includes(q);
        const matchesFocusArea = p.focus_area.some((a) => a.toLowerCase().includes(q));
        const pc = contactsByPartner[p.id];
        const matchesLead = pc?.find(c => c.role === 'Alliance Lead' && c.org_type === 'partner')?.name?.toLowerCase().includes(q);
        const matchesPsa = pc?.find(c => c.role === 'PSA' && c.org_type === 'internal')?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesSegment && !matchesFocusArea && !matchesLead && !matchesPsa) return false;
      }
      if (activeFilter && p.segment !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [partners, searchQuery, activeFilter]);

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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Partners</h1>
          <p className="mt-1 text-sm text-muted">
            {partners.length} partner{partners.length !== 1 ? "s" : ""} tracked
          </p>
          {syncError && <p className="mt-1 text-xs text-red-400">{syncError}</p>}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Catalogs"}
        </button>
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
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.segment}>
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {group.label}
                    <span className="ml-2 text-sm font-normal text-muted">
                      ({group.partners.length})
                    </span>
                  </h2>
                  {group.partners.map((partner) => (
                    <Link
                      key={partner.id}
                      href={`/partners/${partner.id}`}
                      className="flex items-baseline gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {partner.name}
                      </span>
                      {partner.focus_area[0] && (
                        <span className="shrink-0 text-xs text-muted">
                          {partner.focus_area[0]}
                        </span>
                      )}
                      {partner.segment && (
                        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                          {partner.segment}
                        </span>
                      )}
                    </Link>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
