"use client";

import { useState, useEffect } from "react";

export interface EngagementOption {
  id: string;
  name: string;
  status: string;
  topic: string | null;
  updated_at: string;
}

const statusDotColor: Record<string, string> = {
  active: "bg-emerald-500",
  planned: "bg-blue-400",
  blocked: "bg-amber-500",
  completed: "bg-violet-500",
  archived: "bg-zinc-500",
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

/** 16px inline spinner */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

interface Props {
  partnerId: string;
  partnerName?: string;
  /** Engagement IDs to exclude from the list (e.g., the source engagement) */
  excludeIds?: string[];
  onSelect: (engagement: EngagementOption) => void;
  onCancel: () => void;
  onCreateNew?: () => void;
  disabled?: boolean;
}

export default function EngagementPicker({
  partnerId,
  partnerName,
  excludeIds,
  onSelect,
  onCancel,
  onCreateNew,
  disabled,
}: Props) {
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch_() {
      setLoading(true);
      try {
        const res = await fetch(`/api/engagements?partner_id=${partnerId}`);
        const data = await res.json();
        if (cancelled) return;
        const excludeSet = new Set(excludeIds ?? []);
        setEngagements(
          (data.engagements ?? [])
            .map((e: EngagementOption) => ({
              id: e.id, name: e.name, status: e.status, topic: e.topic, updated_at: e.updated_at,
            }))
            .filter((e: EngagementOption) => !excludeSet.has(e.id))
        );
      } catch (err) {
        console.error("Failed to fetch engagements:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();
    return () => { cancelled = true; };
  }, [partnerId, excludeIds]);

  return (
    <div className="mt-3 pt-3 border-t border-border/20">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted">
          Move to engagement{partnerName ? ` (${partnerName})` : ""}
        </span>
        <button
          onClick={onCancel}
          className="text-sm text-muted hover:text-foreground transition-colors min-h-[32px]"
        >
          Cancel
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Spinner />
          <span className="text-sm text-muted">Loading engagements...</span>
        </div>
      ) : engagements.length === 0 ? (
        <p className="text-xs text-muted">
          No existing engagements.{" "}
          {onCreateNew && (
            <button onClick={onCreateNew} className="text-accent hover:underline">
              Create new?
            </button>
          )}
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {engagements.map((eng) => (
            <button
              key={eng.id}
              onClick={() => onSelect(eng)}
              disabled={disabled}
              className="w-full text-left border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50 disabled:opacity-50"
            >
              <span className="text-sm font-medium text-foreground">{eng.name}</span>
              {eng.topic && (
                <p className="text-xs text-muted/60 mt-0.5 truncate">{eng.topic}</p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotColor[eng.status] ?? "bg-zinc-500"}`} />
                <span className="text-xs text-muted/60 capitalize">{eng.status}</span>
                <span className="text-xs text-muted/40">&middot;</span>
                <span className="text-xs text-muted/40">{relativeTime(eng.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
