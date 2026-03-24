"use client";

import { useState } from "react";

interface BrainSynthesisProps {
  partnerId: string;
  initialContent: string | null;
  initialDate: string | null;
  scratchpadLastUpdated: string | null;
}

function parseBrainSections(text: string): { title: string; content: string }[] {
  // Split on ## headers at start of line
  const parts = text.split(/^## /m).filter(Boolean);

  // No ## markers found — return as single block (legacy data fallback)
  if (parts.length <= 1 && !text.startsWith("## ")) {
    return [{ title: "", content: text.trim() }];
  }

  return parts.map((part) => {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) return { title: part.trim(), content: "" };
    return {
      title: part.slice(0, newlineIdx).trim(),
      content: part.slice(newlineIdx + 1).trim(),
    };
  });
}

function isAttentionSection(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("needs attention") || lower.includes("what needs");
}

function firstSentence(text: string, maxLen = 120): string {
  const match = text.match(/^(.+?)[.\n]/);
  const sentence = match ? match[1].trim() : text.trim();
  return sentence.length > maxLen ? sentence.slice(0, maxLen) + "..." : sentence;
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

  const sections = synthesis ? parseBrainSections(synthesis) : [];

  return (
    <div>
      {/* Header row: label + button */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Brain synthesis
        </h2>
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

      {synthError && (
        <p className="mb-3 text-xs text-red-500">{synthError}</p>
      )}

      {synthesis ? (() => {
        const attentionSection = sections.find((s) => isAttentionSection(s.title));
        const otherSections = sections.filter((s) => s.title && !isAttentionSection(s.title));
        const hasStructuredSections = attentionSection && otherSections.length > 0;

        return (
          <>
            <div className="space-y-4">
              {hasStructuredSections ? (
                <>
                  {/* What Needs Attention — prominent, always visible */}
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400/70">
                      {attentionSection.title}
                    </h3>
                    <div className="border-l-2 border-amber-400/40 pl-4">
                      {attentionSection.content.split("\n").filter(Boolean).map((para, j) => (
                        <p key={j} className="text-[15px] text-foreground/85 leading-relaxed mb-1.5 last:mb-0">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Other sections — collapsed accordion */}
                  {otherSections.map((section, i) => (
                    <details key={i} className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                        <svg
                          width="14" height="14" viewBox="0 0 16 16"
                          fill="none" stroke="currentColor" strokeWidth="1.5"
                          className="shrink-0 text-muted/50 transition-transform group-open:rotate-90"
                        >
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                          {section.title}
                        </span>
                        <span className="ml-1 flex-1 truncate text-sm text-muted/60">
                          {firstSentence(section.content)}
                        </span>
                      </summary>
                      <div className="mt-2 ml-[22px] border-l-2 border-accent/25 pl-4">
                        {section.content.split("\n").filter(Boolean).map((para, j) => (
                          <p key={j} className="text-[15px] text-foreground/85 leading-relaxed mb-1.5 last:mb-0">
                            {para}
                          </p>
                        ))}
                      </div>
                    </details>
                  ))}
                </>
              ) : (
                /* Fallback: legacy/unparsed — all sections visible equally */
                sections.map((section, i) => (
                  <div key={i}>
                    {section.title && (
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                        {section.title}
                      </h3>
                    )}
                    <div className="border-l-2 border-accent/25 pl-4">
                      {section.content.split("\n").filter(Boolean).map((para, j) => (
                        <p key={j} className="text-[15px] text-foreground/85 leading-relaxed mb-1.5 last:mb-0">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer: timestamp + stale indicator */}
            <div className="mt-3 flex items-center gap-2">
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
        );
      })() : (
        <p className="text-[15px] italic text-muted">
          No synthesis yet — click Synthesize to generate an executive briefing from engagement data, meeting notes, and scratchpad context.
        </p>
      )}
    </div>
  );
}
