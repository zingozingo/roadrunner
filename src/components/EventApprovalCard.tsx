"use client";

import { useState } from "react";
import { ApprovalQueueItem, Message, Initiative } from "@/lib/types";
import ConfidenceBar from "./ConfidenceBar";

type ApprovalWithContext = ApprovalQueueItem & {
  message: Message | null;
  initiative: Initiative | null;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  conference: "Conference",
  summit: "Summit",
  workshop: "Workshop",
  kickoff: "Kickoff",
  trade_show: "Trade Show",
  deadline: "Deadline",
  review_cycle: "Review Cycle",
  training: "Training",
};

export default function EventApprovalCard({
  approval,
  onResolved,
}: {
  approval: ApprovalWithContext;
  onResolved: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const event = approval.entity_data!;

  async function handleAction(action: "approve" | "deny") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: approval.id, action }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      onResolved(approval.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Header: calendar icon + event name */}
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--event-conference)]/20">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--event-conference)"
            strokeWidth="1.5"
          >
            <rect x="2" y="3" width="12" height="11" rx="1.5" />
            <path d="M5 1v3M11 1v3M2 7h12" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">{event.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded bg-[var(--event-conference)]/20 px-1.5 py-0.5 text-xs text-[var(--event-conference)]">
              {EVENT_TYPE_LABELS[event.type] || event.type}
            </span>
            {event.date && (
              <span className="rounded bg-border px-1.5 py-0.5 font-mono text-xs text-muted">
                {event.date}
                {event.date_precision !== "exact" && (
                  <span className="ml-1 text-muted/60">~{event.date_precision}</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="mb-3">
        <ConfidenceBar confidence={event.confidence} />
      </div>

      {/* Source context */}
      <div className="mb-4 space-y-1 text-sm text-muted">
        {approval.message && (
          <p>
            From email:{" "}
            <span className="text-foreground/80">
              {approval.message.subject || "No subject"}
            </span>
            {approval.message.sender_name && (
              <span> by {approval.message.sender_name}</span>
            )}
          </p>
        )}
        {approval.initiative && (
          <p>
            Would link to:{" "}
            <span className="text-foreground/80">{approval.initiative.name}</span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={() => handleAction("approve")}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "..." : "Approve"}
        </button>
        <button
          disabled={loading}
          onClick={() => handleAction("deny")}
          className="rounded-lg border border-border bg-background px-4 py-1.5 text-sm text-muted transition-colors hover:border-muted hover:text-foreground disabled:opacity-50"
        >
          {loading ? "..." : "Deny"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs text-red-400/70 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
