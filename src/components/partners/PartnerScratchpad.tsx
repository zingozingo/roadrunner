"use client";

import { useState } from "react";
import type { PartnerContextEntry } from "@/lib/types";

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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const COLLAPSED_COUNT = 3;

export default function PartnerScratchpad({
  partnerId,
  initialEntries,
  compact = false,
}: PartnerScratchpadProps) {
  // Split entries by source
  const initialSynth = initialEntries.find((e) => e.source === "ai_synthesis") ?? null;
  const initialScratch = initialEntries.filter(
    (e) => e.source === "scratchpad" || e.source === "seed_dump"
  );

  // Synthesis state
  const [synthesis, setSynthesis] = useState<string | null>(initialSynth?.content ?? null);
  const [synthesisDate, setSynthesisDate] = useState<string | null>(initialSynth?.created_at ?? null);
  const [synthesisId, setSynthesisId] = useState<string | null>(initialSynth?.id ?? null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthError, setSynthError] = useState<string | null>(null);

  // Scratchpad state
  const [scratchEntries, setScratchEntries] = useState<PartnerContextEntry[]>(initialScratch);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Check if new context was added since last synthesis
  const hasNewContext =
    synthesisDate &&
    scratchEntries.some((e) => e.created_at > synthesisDate);

  // ---- Synthesis handlers ----

  async function handleSynthesize() {
    setIsSynthesizing(true);
    setSynthError(null);

    try {
      const res = await fetch(`/api/partners/${partnerId}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Synthesis failed (${res.status})`);
      }

      const { synthesis: text, id } = await res.json();
      setSynthesis(text);
      setSynthesisDate(new Date().toISOString());
      setSynthesisId(id);
    } catch (err) {
      setSynthError(err instanceof Error ? err.message : "Failed to synthesize");
    } finally {
      setIsSynthesizing(false);
    }
  }

  // ---- Scratchpad handlers ----

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

  // ---- Derived ----

  const visibleEntries = showAll
    ? scratchEntries
    : scratchEntries.slice(0, COLLAPSED_COUNT);
  const hasMore = scratchEntries.length > COLLAPSED_COUNT;

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-surface p-4"}>
      {!compact && (
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Living Context
        </h2>
      )}

      {/* ---- Brain Synthesis ---- */}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {synthesis ? (
              <>
                <p className="text-sm text-foreground leading-relaxed">
                  {synthesis}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-muted">
                    Last synthesized: {formatShortDate(synthesisDate!)}
                  </span>
                  {hasNewContext && (
                    <span className="text-xs text-amber-400">
                      New context added since last synthesis
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm italic text-muted">
                No synthesis yet. Click Synthesize to generate a 60-second briefing.
              </p>
            )}
            {synthError && (
              <p className="mt-1.5 text-xs text-red-500">{synthError}</p>
            )}
          </div>

          <button
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors text-muted hover:text-foreground disabled:opacity-50"
          >
            {isSynthesizing
              ? "Synthesizing..."
              : synthesis
                ? "\u21BB Re-synthesize"
                : "Synthesize"}
          </button>
        </div>
      </div>

      {/* ---- Divider ---- */}
      <div className="border-t border-border my-4" />

      {/* ---- Scratchpad ---- */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Scratchpad
          {scratchEntries.length > 0 && (
            <span className="ml-1.5 font-normal">
              ({scratchEntries.length} note{scratchEntries.length !== 1 ? "s" : ""})
            </span>
          )}
        </h3>

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
                        <span className="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
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
    </div>
  );
}
