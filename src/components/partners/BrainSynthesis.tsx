"use client";

import { useState } from "react";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";

interface BrainSynthesisProps {
  partnerId: string;
  initialContent: string | null;
  initialDate: string | null;
  scratchpadLastUpdated: string | null;
}

export default function BrainSynthesis({
  partnerId,
  initialContent,
  initialDate,
  scratchpadLastUpdated,
}: BrainSynthesisProps) {
  const [synthesis, setSynthesis] = useState<string | null>(initialContent);
  const [synthesisDate, setSynthesisDate] = useState<string | null>(initialDate);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  useNavigationGuard(isSynthesizing);
  const [synthError, setSynthError] = useState<string | null>(null);

  const hasNewContext =
    synthesisDate &&
    scratchpadLastUpdated &&
    scratchpadLastUpdated > synthesisDate;

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
      const { synthesis: text } = await res.json();
      setSynthesis(text);
      setSynthesisDate(new Date().toISOString());
    } catch (err) {
      setSynthError(err instanceof Error ? err.message : "Failed to synthesize");
    } finally {
      setIsSynthesizing(false);
    }
  }

  return (
    <div>
      {/* Header: title + action */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
          Strategic Posture
        </h2>
        <button
          onClick={handleSynthesize}
          disabled={isSynthesizing}
          className="shrink-0 rounded-md border border-border/50 bg-surface px-3 py-1 text-xs text-muted transition-colors hover:text-foreground hover:border-border disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSynthesizing
            ? "Synthesizing\u2026"
            : synthesis
              ? "Re-synthesize"
              : "Generate Synthesis"}
        </button>
      </div>

      {/* Error */}
      {synthError && (
        <div className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {synthError}
          <button
            onClick={handleSynthesize}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {synthesis ? (
        <div>
          <p className="text-[15px] leading-relaxed text-foreground/85">
            {synthesis}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted/60">
              Synthesized{" "}
              {new Date(synthesisDate!).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {hasNewContext && (
              <span className="text-xs text-status-blocked">
                New context available
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted/60">
          No synthesis yet. Click Generate Synthesis to create an executive
          briefing from engagement data, meeting notes, and scratchpad.
        </p>
      )}
    </div>
  );
}
