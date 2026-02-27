"use client";

import { useState } from "react";
import { ApprovalQueueItem, Message, Engagement } from "@/lib/types";
import ConfidenceBar from "./ConfidenceBar";
import { displayName, formatFooterDate } from "@/lib/format-utils";

type ReviewApproval = ApprovalQueueItem & {
  message: Message | null;
  engagement: Engagement | null;
};

export default function ReviewCard({
  review,
  onResolved,
}: {
  review: ReviewApproval;
  onResolved: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [fetchingEngagements, setFetchingEngagements] = useState(false);

  const msg = review.message;
  const match = review.classification_result!.engagement_match;
  const bodyPreview = msg?.body_text?.slice(0, 150) || "";

  async function resolve(
    action: "confirm" | "discard" | "assign_existing",
    engagementId?: string
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: review.id,
          action,
          ...(engagementId && { engagement_id: engagementId }),
        }),
      });

      if (res.ok) {
        onResolved(review.id);
        return;
      }

      let detail = `Server returned ${res.status}`;
      try {
        const body = await res.json();
        if (body.error) detail = body.error;
      } catch {
        // response wasn't JSON
      }
      console.error("Resolve API error:", res.status, detail);
      setError(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      console.error("Resolve fetch failed:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function openPicker() {
    if (engagements.length > 0) {
      setShowPicker(!showPicker);
      return;
    }

    setFetchingEngagements(true);
    try {
      const res = await fetch("/api/engagements");
      if (!res.ok) throw new Error("Failed to fetch engagements");
      const { engagements: all } = await res.json();
      const active = (all as Engagement[])
        .filter((e) => e.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name));
      setEngagements(active);
      setShowPicker(true);
    } catch (err) {
      console.error("Failed to load engagements:", err);
      setError("Failed to load engagements");
    } finally {
      setFetchingEngagements(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Header: sender info */}
      <div className="mb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-foreground">
              {displayName(msg?.sender_name, msg?.sender_email)}
            </p>
            {msg?.sender_name && msg?.sender_email && (
              <p className="text-sm text-muted">{msg.sender_email}</p>
            )}
          </div>
          <time className="text-xs text-muted">
            {msg?.sent_at ? formatFooterDate(msg.sent_at) : "No date"}
          </time>
        </div>
        {msg?.subject && (
          <p className="mt-1 text-sm font-medium text-foreground/80">
            {msg.subject}
          </p>
        )}
        {bodyPreview && (
          <p className="mt-1 text-sm text-muted">
            {bodyPreview}
            {(msg?.body_text?.length ?? 0) > 150 ? "..." : ""}
          </p>
        )}
      </div>

      {/* AI suggestion */}
      <div className="mb-4 rounded-lg bg-background p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            AI Suggestion
          </span>
          {match.is_new && (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent">
              New
            </span>
          )}
        </div>
        <p className="mb-2 text-sm font-medium text-foreground">
          {match.name}
        </p>
        <ConfidenceBar confidence={match.confidence} />
      </div>

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={loading}
          onClick={() => resolve("confirm")}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>

        <button
          disabled={loading}
          onClick={() => resolve("discard")}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted transition-colors hover:border-muted hover:text-foreground disabled:opacity-50"
        >
          {loading ? "..." : "Discard"}
        </button>
      </div>

      {/* Secondary action: assign to different engagement */}
      <div className="mt-2">
        <button
          disabled={loading || fetchingEngagements}
          onClick={openPicker}
          className="text-xs text-muted transition-colors hover:text-accent disabled:opacity-50"
        >
          {fetchingEngagements
            ? "Loading..."
            : showPicker
              ? "Cancel"
              : "Assign to a different engagement"}
        </button>

        {showPicker && engagements.length > 0 && (
          <select
            disabled={loading}
            onChange={(e) => {
              if (e.target.value) resolve("assign_existing", e.target.value);
            }}
            defaultValue=""
            className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="" disabled>
              Select an engagement...
            </option>
            {engagements.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </select>
        )}

        {showPicker && engagements.length === 0 && !fetchingEngagements && (
          <p className="mt-2 text-xs text-muted">No active engagements found</p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <p className="mt-2 text-xs text-muted">Resolving...</p>
      )}

      {/* Error display */}
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
