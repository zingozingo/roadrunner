"use client";

import { useState, useEffect } from "react";
import type { PartnerContextEntry } from "@/lib/types";
import { useUnsavedChanges } from "@/components/shared/UnsavedChangesProvider";

interface PartnerScratchpadProps {
  partnerId: string;
  initialEntries: PartnerContextEntry[];
  /** When true, renders without the card wrapper (border/bg/padding) */
  compact?: boolean;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const COLLAPSED_COUNT = 3;

export default function PartnerScratchpad({
  partnerId,
  initialEntries,
  compact = false,
}: PartnerScratchpadProps) {
  const [scratchEntries, setScratchEntries] = useState<PartnerContextEntry[]>(initialEntries);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { setDirty, clearDirty } = useUnsavedChanges("partner-scratchpad");

  useEffect(() => {
    if (input.trim().length > 0) setDirty();
    else clearDirty();
  }, [input, setDirty, clearDirty]);

  async function handleSubmit() {
    const content = input.trim();
    if (!content || submitting) return;

    setSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: PartnerContextEntry = {
      id: tempId,
      partner_id: partnerId,
      content,
      source: "scratchpad",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setScratchEntries((prev) => [optimistic, ...prev]);
    setInput("");

    try {
      const res = await fetch(`/api/partners/${partnerId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const created: PartnerContextEntry = await res.json();
        setScratchEntries((prev) =>
          prev.map((e) => (e.id === tempId ? created : e))
        );
      } else {
        setScratchEntries((prev) => prev.filter((e) => e.id !== tempId));
      }
    } catch {
      setScratchEntries((prev) => prev.filter((e) => e.id !== tempId));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryId: string) {
    setScratchEntries((prev) => prev.filter((e) => e.id !== entryId));

    try {
      await fetch(`/api/partners/${partnerId}/context`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId: entryId }),
      });
    } catch {
      // Silent — entry already removed from UI
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const visibleEntries = showAll
    ? scratchEntries
    : scratchEntries.slice(0, COLLAPSED_COUNT);
  const hasMore = scratchEntries.length > COLLAPSED_COUNT;

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-surface p-4"}>
      {!compact && (
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Scratchpad
        </h2>
      )}

      {visibleEntries.length > 0 && (
        <div className="mb-3 space-y-2">
          {visibleEntries.map((entry) => {
            const isSeed = entry.source === "seed_dump";
            return (
              <div
                key={entry.id}
                className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-hover"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-relaxed">
                    {entry.content}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{relativeTime(entry.created_at)}</span>
                    {isSeed && (
                      <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                        SEED
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="shrink-0 text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all mt-0.5"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M4 4l6 6M10 4l-6 6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className="mb-3 text-xs text-muted hover:text-foreground transition-colors"
        >
          {showAll ? "Show less" : `Show all ${scratchEntries.length}`}
        </button>
      )}

      {/* Input */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add context about this partner..."
        disabled={submitting}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
