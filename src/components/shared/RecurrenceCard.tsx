"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Meeting, RecurrencePattern } from "@/lib/types";
import RecurrenceEditor from "./RecurrenceEditor";
import ConfirmDialog from "./ConfirmDialog";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import InlineError from "@/components/shared/InlineError";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const PATTERN_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

type SeriesSibling = Pick<Meeting, "id" | "meeting_date" | "status" | "anchor_day">;

interface RecurrenceCardProps {
  meetingId: string;
  meetingDate: string | null;
  recurrencePattern: string | null;
  recurrenceEnd: string | null;
  seriesId: string | null;
  siblings: SeriesSibling[];
  rootAnchorDay: number | null;
  rootDate: string | null;
}

function formatShortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Unified recurrence section — replaces SeriesDisplay + SeriesTimeline + SeriesActions.
 * One compact card with pattern info, date list, navigation, edit, and overflow actions.
 */
export default function RecurrenceCard({
  meetingId,
  meetingDate,
  recurrencePattern,
  recurrenceEnd,
  seriesId,
  siblings,
  rootAnchorDay,
  rootDate,
}: RecurrenceCardProps) {
  const router = useRouter();
  const [showEditor, setShowEditor] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  useNavigationGuard(saving);
  const [error, setError] = useState<string | null>(null);

  // Don't render if not a recurring series
  if (siblings.length <= 1 && !recurrencePattern) return null;

  const idx = siblings.findIndex((s) => s.id === meetingId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  // Build rhythm text: "Weekly on Wednesdays"
  const patternLabel = recurrencePattern ? PATTERN_LABELS[recurrencePattern] ?? recurrencePattern : null;
  let rhythmText = patternLabel ?? "";
  if (rootAnchorDay !== null && rootAnchorDay !== undefined) {
    if (recurrencePattern === "weekly" || recurrencePattern === "biweekly") {
      rhythmText += ` on ${DAY_NAMES[rootAnchorDay]}s`;
    } else if (recurrencePattern === "monthly" || recurrencePattern === "quarterly") {
      const suffix = rootAnchorDay === 1 ? "st" : rootAnchorDay === 2 ? "nd" : rootAnchorDay === 3 ? "rd" : "th";
      rhythmText += ` on the ${rootAnchorDay}${suffix}`;
    }
  }

  // "Since Mar 20"
  const sinceText = rootDate
    ? `Since ${formatShortDate(rootDate)}`
    : null;

  // Build the date list — show 5 nearest to current meeting
  const today = new Date().toISOString().slice(0, 10);
  const VISIBLE_COUNT = 5;
  const halfWindow = Math.floor(VISIBLE_COUNT / 2);
  let startIdx = Math.max(0, idx - halfWindow);
  let endIdx = startIdx + VISIBLE_COUNT;
  if (endIdx > siblings.length) {
    endIdx = siblings.length;
    startIdx = Math.max(0, endIdx - VISIBLE_COUNT);
  }
  const visibleSiblings = siblings.slice(startIdx, endIdx);
  const hasEllipsisBefore = startIdx > 0;
  const hasEllipsisAfter = endIdx < siblings.length;

  async function skipThisOne() {
    if (!confirm("Skip this meeting? It will be marked cancelled.")) return;
    setSaving(true);
    setShowOverflow(false);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to skip meeting");
      router.refresh();
    } catch (err) {
      console.error("Failed to skip meeting:", err);
      setError(err instanceof Error ? err.message : "Failed to skip meeting");
    } finally {
      setSaving(false);
    }
  }

  async function endSeries() {
    setSaving(true);
    try {
      const targetId = seriesId ?? meetingId;
      const res = await fetch(`/api/meetings/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrence_pattern: null, recurrence_end: null }),
      });
      if (!res.ok) throw new Error("Failed to end series");
      setShowEndConfirm(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to end series:", err);
      setError(err instanceof Error ? err.message : "Failed to end series");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-6 rounded-lg border border-border/20 bg-surface/50 px-4 py-3">
        {/* Line 1: Pattern + nav + edit affordance */}
        <div className="flex items-center gap-2 text-sm">
          {/* Recurrence icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/70 shrink-0">
            <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" />
            <path d="M14 2v4h-4M2 14v-4h4" />
          </svg>

          {/* Prev nav */}
          {prev ? (
            <Link href={`/meetings/${prev.id}`} className="text-xs text-muted/40 hover:text-accent transition-colors" title="Previous in series">
              &larr;
            </Link>
          ) : (
            <span className="text-xs text-muted/15">&larr;</span>
          )}

          {/* Rhythm text */}
          <span className="text-foreground/80 font-medium">{rhythmText}</span>

          {/* Next nav */}
          {next ? (
            <Link href={`/meetings/${next.id}`} className="text-xs text-muted/40 hover:text-accent transition-colors" title="Next in series">
              &rarr;
            </Link>
          ) : (
            <span className="text-xs text-muted/15">&rarr;</span>
          )}

          {sinceText && (
            <>
              <span className="text-muted/30">·</span>
              <span className="text-muted/60 text-xs">{sinceText}</span>
            </>
          )}

          {/* Spacer + actions */}
          <span className="flex-1" />

          {/* Edit pattern link */}
          <button
            onClick={() => setShowEditor(true)}
            className="text-xs text-muted/60 hover:text-accent transition-colors"
          >
            Edit pattern
          </button>

          {/* Overflow menu */}
          <div className="relative">
            <button
              onClick={() => setShowOverflow(!showOverflow)}
              className="text-muted/50 hover:text-foreground transition-colors p-0.5"
              title="More actions"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {showOverflow && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                <div className="absolute right-0 top-6 z-50 w-36 rounded-lg border border-border bg-surface py-1 shadow-lg">
                  <button
                    onClick={skipThisOne}
                    disabled={saving}
                    className="w-full px-3 py-1.5 text-left text-xs text-foreground/70 hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    Skip this one
                  </button>
                  <button
                    onClick={() => { setShowOverflow(false); setShowEndConfirm(true); }}
                    disabled={saving}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-surface-hover transition-colors disabled:opacity-50"
                  >
                    End series
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Line 2: Date list */}
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          {hasEllipsisBefore && <span className="text-muted/30">...</span>}
          {visibleSiblings.map((s) => {
            if (!s.meeting_date) return null;
            const isCurrent = s.id === meetingId;
            const isFuture = s.meeting_date > today;
            const isCancelled = s.status === "cancelled" || s.status === "did_not_occur";

            let cls = "text-muted/40"; // past default
            if (isCancelled) cls = "text-muted/20 line-through";
            else if (isCurrent) cls = "text-accent font-semibold";
            else if (isFuture) cls = "text-foreground/60";

            return (
              <span key={s.id} className="flex items-center gap-1.5">
                {s.id !== visibleSiblings[0]?.id && <span className="text-muted/20">·</span>}
                {isCurrent ? (
                  <span className={cls}>{formatShortDate(s.meeting_date)}</span>
                ) : (
                  <Link href={`/meetings/${s.id}`} className={`${cls} hover:text-accent transition-colors`}>
                    {formatShortDate(s.meeting_date)}
                  </Link>
                )}
              </span>
            );
          })}
          {hasEllipsisAfter && (
            <>
              <span className="text-muted/20">·</span>
              <span className="text-muted/30">...</span>
            </>
          )}
        </div>

        {error && <div className="mt-2"><InlineError message={error} onDismiss={() => setError(null)} /></div>}
      </div>

      {/* Editor modal */}
      {showEditor && (
        <RecurrenceEditor
          meetingId={seriesId ?? meetingId}
          meetingDate={meetingDate}
          initialPattern={recurrencePattern as RecurrencePattern | null}
          initialEnd={recurrenceEnd}
          initialSeriesId={seriesId}
          initialAnchorDay={rootAnchorDay}
          onSave={() => { setShowEditor(false); router.refresh(); }}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* End series confirmation */}
      <ConfirmDialog
        isOpen={showEndConfirm}
        onConfirm={endSeries}
        onCancel={() => setShowEndConfirm(false)}
        title="End Series"
        message="End this recurring series? Future occurrences will stop being created. Existing meetings are not affected."
        confirmLabel={saving ? "Ending..." : "End Series"}
        confirmStyle="danger"
      />
    </>
  );
}
