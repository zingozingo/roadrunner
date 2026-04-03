"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import EmptyState from "@/components/layout/EmptyState";
import type { Engagement, Pillar } from "@/lib/types";

type EngagementWithContext = Engagement & {
  partner_name: string | null;
  message_count: number;
};

const STATUS_ORDER: Engagement["status"][] = ["active", "planned", "blocked", "completed", "archived"];
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  planned: "Planned",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};

const PILLAR_STYLES: Record<Pillar, string> = {
  "Co-Sell": "bg-blue-500/15 text-blue-400",
  "Co-Market": "bg-purple-500/15 text-purple-400",
  "Co-Build": "bg-green-500/15 text-green-400",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

interface Props {
  engagements: EngagementWithContext[];
  partnerOptions: { id: string; name: string }[];
}

export default function EngagementsClient({ engagements, partnerOptions }: Props) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!activeFilter) return engagements;
    return engagements.filter((e) => e.partner_id === activeFilter);
  }, [engagements, activeFilter]);

  const grouped = useMemo(() => {
    const groups: { status: string; label: string; engagements: EngagementWithContext[] }[] = [];
    for (const status of STATUS_ORDER) {
      const items = filtered.filter((e) => e.status === status);
      if (items.length > 0) {
        groups.push({ status, label: STATUS_LABELS[status] ?? status, engagements: items });
      }
    }
    return groups;
  }, [filtered]);

  // Partners that actually have engagements — only show those as filter options
  const activePartnerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of engagements) {
      if (e.partner_id) ids.add(e.partner_id);
    }
    return ids;
  }, [engagements]);

  const filterOptions = useMemo(() => {
    return partnerOptions
      .filter((p) => activePartnerIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [partnerOptions, activePartnerIds]);

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Engagements</h1>
          <p className="mt-1 text-sm text-muted">
            {engagements.length} engagement{engagements.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
      </div>

      {engagements.length === 0 ? (
        <EmptyState
          title="No engagements yet"
          description="Engagements are created when emails are routed from the inbox"
        />
      ) : (
        <>
          {/* Partner filter pills */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveFilter(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeFilter === null
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-muted hover:text-foreground"
              }`}
            >
              All
            </button>
            {filterOptions.map((p) => {
              const isActive = activeFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveFilter(isActive ? null : p.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
            <span className="ml-auto text-xs text-muted">
              {filtered.length === engagements.length
                ? `${engagements.length} engagements`
                : `${filtered.length} of ${engagements.length} engagements`}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No matching engagements"
              description="Try selecting a different partner"
            />
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => {
                const defaultOpen = group.status === "active" || group.status === "planned" || group.status === "blocked";
                return (
                  <details
                    key={group.status}
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
                        {group.engagements.length}
                      </span>
                    </summary>

                    <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
                      {group.engagements.map((engagement, i) => (
                        <EngagementRow
                          key={engagement.id}
                          engagement={engagement}
                          isLast={i === group.engagements.length - 1}
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
    </PageContainer>
  );
}

function EngagementRow({
  engagement,
  isLast,
}: {
  engagement: EngagementWithContext;
  isLast: boolean;
}) {
  return (
    <Link
      href={`/engagements/${engagement.id}`}
      className={`block px-4 py-3 transition-colors hover:bg-surface-hover ${
        !isLast ? "border-b border-border/30" : ""
      }`}
    >
      {/* Top line: name + partner + time */}
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {engagement.name}
        </span>
        {engagement.partner_name && (
          <span className="hidden shrink-0 text-xs text-muted sm:block">
            {engagement.partner_name}
          </span>
        )}
        <span className="shrink-0 text-xs text-muted/60">
          {relativeTime(engagement.updated_at)}
        </span>
      </div>

      {/* Bottom line: topic + pillar */}
      {(engagement.topic || engagement.pillar) && (
        <div className="mt-1 flex items-center gap-3">
          {engagement.topic && (
            <span className="min-w-0 flex-1 truncate text-sm text-muted">
              {engagement.topic}
            </span>
          )}
          {engagement.pillar && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                PILLAR_STYLES[engagement.pillar]
              }`}
            >
              {engagement.pillar}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
