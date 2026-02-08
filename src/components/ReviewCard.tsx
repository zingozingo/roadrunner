"use client";

import { useState } from "react";
import { ApprovalQueueItem, Message, Initiative } from "@/lib/types";
import ConfidenceBar from "./ConfidenceBar";

type ReviewApproval = ApprovalQueueItem & {
  message: Message | null;
  initiative: Initiative | null;
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
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState(
    review.classification_result!.initiative_match.name || ""
  );

  const msg = review.message;
  const match = review.classification_result!.initiative_match;
  const bodyPreview = msg?.body_text?.slice(0, 150) || "";

  async function resolve(
    action: "skip" | "select" | "new",
    option_number?: number,
    initiative_name?: string
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
          option_number,
          initiative_name,
        }),
      });

      if (res.ok) {
        onResolved(review.id);
        return;
      }

      // Non-2xx response — surface the error
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

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Header: sender info */}
      <div className="mb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-foreground">
              {msg?.sender_name || msg?.sender_email || "Unknown sender"}
            </p>
            {msg?.sender_name && msg?.sender_email && (
              <p className="text-sm text-muted">{msg.sender_email}</p>
            )}
          </div>
          <time className="text-xs text-muted">
            {msg?.sent_at
              ? new Date(msg.sent_at).toLocaleDateString()
              : "No date"}
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

      {/* Options */}
      <div className="flex flex-wrap gap-2">
        {review.options_sent?.map((opt) => (
          <button
            key={opt.number}
            disabled={loading}
            onClick={() => resolve("select", opt.number)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {loading ? "..." : `${opt.number}. ${opt.label}`}
          </button>
        ))}

        <button
          disabled={loading}
          onClick={() => setShowNewInput(!showNewInput)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-accent transition-colors hover:border-accent disabled:opacity-50"
        >
          + New Initiative
        </button>

        <button
          disabled={loading}
          onClick={() => resolve("skip")}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted transition-colors hover:border-muted hover:text-foreground disabled:opacity-50"
        >
          {loading ? "..." : "Skip"}
        </button>
      </div>

      {/* New initiative input */}
      {showNewInput && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Initiative name..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            disabled={loading || !newName.trim()}
            onClick={() => resolve("new", undefined, newName.trim())}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? "..." : "Create"}
          </button>
        </div>
      )}

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
