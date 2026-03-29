"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import type { Partner } from "@/lib/types";

const SEGMENT_FILTERS = [
  { label: "Security", value: "security" },
  { label: "SecOps", value: "secops" },
  { label: "DevOps", value: "devops" },
  { label: "CloudOps", value: "cloudops" },
  { label: "Observability", value: "observability" },
  { label: "OT/IoT", value: "ot/iot" },
];

const SEGMENT_ORDER = ["security", "secops", "devops", "cloudops", "observability", "ot/iot"];
const SEGMENT_LABELS: Record<string, string> = {
  security: "Security",
  secops: "SecOps",
  devops: "DevOps",
  cloudops: "CloudOps",
  observability: "Observability",
  "ot/iot": "OT/IoT",
};

interface PartnerContact {
  name: string | null;
  email: string;
  role: string | null;
  org_type: string | null;
}

interface Props {
  partners: Partner[];
  contactsByPartner: Record<string, PartnerContact[]>;
}

export default function PartnersClient({ partners, contactsByPartner }: Props) {
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

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      if (activeFilter && p.segment !== activeFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const pc = contactsByPartner[p.id];
      return (
        p.name.toLowerCase().includes(q) ||
        p.segment?.toLowerCase().includes(q) ||
        p.focus_area.some((a) => a.toLowerCase().includes(q)) ||
        pc?.find((c) => c.role === "Alliance Lead" && c.org_type === "partner")?.name?.toLowerCase().includes(q) ||
        pc?.find((c) => c.role === "PSA" && c.org_type === "internal")?.name?.toLowerCase().includes(q)
      );
    });
  }, [partners, searchQuery, activeFilter, contactsByPartner]);

  const grouped = useMemo(() => {
    const groups: { segment: string; label: string; partners: Partner[] }[] = [];
    for (const seg of SEGMENT_ORDER) {
      const items = filtered
        .filter((p) => p.segment === seg)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (items.length > 0) {
        groups.push({ segment: seg, label: SEGMENT_LABELS[seg] ?? seg, partners: items });
      }
    }
    const other = filtered
      .filter((p) => !p.segment || !SEGMENT_ORDER.includes(p.segment))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (other.length > 0) {
      groups.push({ segment: "other", label: "Other", partners: other });
    }
    return groups;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Partners</h1>
          <p className="mt-1 text-sm text-muted">
            {partners.length} partners tracked
          </p>
          {syncError && (
            <p className="mt-1 text-xs text-red-400">{syncError}</p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md border border-border/50 bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground hover:border-border disabled:opacity-50"
        >
          {syncing ? "Syncing\u2026" : "Sync Catalogs"}
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
            filterOptions={SEGMENT_FILTERS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filtered.length}
            totalCount={partners.length}
            entityName="partners"
          />

          {filtered.length === 0 ? (
            <EmptyState
              title="No matching partners"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => {
                const defaultOpen = !!searchQuery || group.partners.length < 10;
                return (
                  <details
                    key={group.segment}
                    open={defaultOpen || undefined}
                    className="group"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted/60 [&::-webkit-details-marker]:hidden">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="shrink-0 transition-transform group-open:rotate-90"
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      {group.label}
                      <span className="font-normal text-muted/40">
                        {group.partners.length}
                      </span>
                    </summary>

                    <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
                      {group.partners.map((partner, i) => (
                        <PartnerRow
                          key={partner.id}
                          partner={partner}
                          isLast={i === group.partners.length - 1}
                        />
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

/* ------------------------------------------------------------------ */
/*  Partner row with attainment indicator                              */
/* ------------------------------------------------------------------ */

function PartnerRow({
  partner,
  isLast,
}: {
  partner: Partner;
  isLast: boolean;
}) {
  const hasGoal = partner.mp_tcv_goal && partner.mp_tcv_goal > 0;
  const attainment = hasGoal
    ? Math.round(((partner.mp_tcv_ytd ?? 0) / partner.mp_tcv_goal!) * 100)
    : null;

  return (
    <Link
      href={`/partners/${partner.id}`}
      className={`flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-hover ${
        !isLast ? "border-b border-border/30" : ""
      }`}
    >
      {/* Name */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {partner.name}
      </span>

      {/* Focus area */}
      {partner.focus_area[0] && (
        <span className="hidden shrink-0 text-xs text-muted sm:block">
          {partner.focus_area[0]}
        </span>
      )}

      {/* TCV attainment */}
      {attainment !== null && (
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-16 h-1 rounded-full bg-border/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent/60"
              style={{ width: `${Math.min(attainment, 100)}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-xs text-muted">
            {attainment}%
          </span>
        </div>
      )}

      {/* Segment badge */}
      {partner.segment && (
        <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent/70">
          {partner.segment}
        </span>
      )}
    </Link>
  );
}
