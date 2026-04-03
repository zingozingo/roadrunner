"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RecurrencePattern } from "@/lib/types";
import { useUnsavedChanges } from "@/components/shared/UnsavedChangesProvider";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import InlineError from "@/components/shared/InlineError";

const PATTERN_LABELS: Record<RecurrencePattern, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Compute next N occurrence dates for preview. */
function previewDates(startDate: string, pattern: string, anchorDay: number, count: number): string[] {
  const dates: string[] = [];
  let current = startDate;
  for (let i = 0; i < count; i++) {
    const [y, m, d] = current.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    switch (pattern) {
      case "weekly": date.setDate(date.getDate() + 7); break;
      case "biweekly": date.setDate(date.getDate() + 14); break;
      case "monthly": date.setMonth(date.getMonth() + 1); break;
      case "quarterly": date.setMonth(date.getMonth() + 3); break;
    }
    if (pattern === "weekly" || pattern === "biweekly") {
      const dow = date.getDay();
      const diff = anchorDay - dow;
      date.setDate(date.getDate() + diff);
    }
    current = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    dates.push(current);
  }
  return dates;
}

function formatPreviewDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface RecurrenceEditorProps {
  meetingId: string;
  meetingDate?: string | null;
  initialPattern: RecurrencePattern | null;
  initialEnd: string | null;
  initialSeriesId: string | null;
  initialAnchorDay?: number | null;
  /** Called after successful save */
  onSave: () => void;
  /** Called to close the modal (may be intercepted by discard confirmation) */
  onClose: () => void;
}

/**
 * Recurrence pattern editor — renders as a modal dialog.
 * Protected by useUnsavedChanges to prevent accidental data loss.
 */
export default function RecurrenceEditor({
  meetingId,
  meetingDate,
  initialPattern,
  initialEnd,
  initialSeriesId,
  initialAnchorDay,
  onSave,
  onClose,
}: RecurrenceEditorProps) {
  const defaultAnchorDay = initialAnchorDay ?? (meetingDate ? new Date(meetingDate + "T12:00:00").getDay() : 0);

  const [formPattern, setFormPattern] = useState<RecurrencePattern>(initialPattern ?? "weekly");
  const [formEnd, setFormEnd] = useState(initialEnd ?? "");
  const [formAnchorDay, setFormAnchorDay] = useState<number>(defaultAnchorDay);
  const [showEndDate, setShowEndDate] = useState(!!initialEnd);
  const [saving, setSaving] = useState(false);
  useNavigationGuard(saving);
  const [showDiscard, setShowDiscard] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { setDirty, clearDirty } = useUnsavedChanges("recurrence-editor");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Track whether form has changed from initial values
  const isDirty = useCallback(() => {
    if (formPattern !== (initialPattern ?? "weekly")) return true;
    if (formAnchorDay !== defaultAnchorDay) return true;
    if ((formEnd || null) !== (initialEnd || null)) return true;
    return false;
  }, [formPattern, formAnchorDay, formEnd, initialPattern, initialEnd, defaultAnchorDay]);

  useEffect(() => {
    if (isDirty()) setDirty();
    else clearDirty();
  }, [isDirty, setDirty, clearDirty]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearDirty();
  }, [clearDirty]);

  // ESC key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formPattern, formAnchorDay, formEnd]);

  function handleClose() {
    if (isDirty()) {
      setShowDiscard(true);
    } else {
      clearDirty();
      onClose();
    }
  }

  function handleDiscard() {
    clearDirty();
    setShowDiscard(false);
    onClose();
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        recurrence_pattern: formPattern,
        recurrence_end: formEnd || null,
        anchor_day: formAnchorDay,
      };
      if (!initialSeriesId) {
        body.series_id = meetingId;
      } else {
        body.scope = "this_and_future";
      }

      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save recurrence pattern");
      clearDirty();
      onSave();
    } catch (err) {
      console.error("Failed to save recurrence:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save recurrence pattern");
    } finally {
      setSaving(false);
    }
  }

  const previewStartDate = meetingDate ?? new Date().toISOString().slice(0, 10);
  const preview = previewDates(previewStartDate, formPattern, formAnchorDay, 3);

  return (
    <>
      {/* Modal backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div className="absolute inset-0 bg-black/60" />

        {/* Modal content */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Edit recurrence pattern"
          className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Edit Pattern</h2>
            <button
              onClick={handleClose}
              className="text-muted hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3">
            {/* Pattern */}
            <div>
              <label className="block text-[10px] font-medium text-muted/60 mb-1">Pattern</label>
              <select
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value as RecurrencePattern)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              >
                {(Object.entries(PATTERN_LABELS) as [RecurrencePattern, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Day selector */}
            {(formPattern === "weekly" || formPattern === "biweekly") && (
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Day</label>
                <select
                  value={formAnchorDay}
                  onChange={(e) => setFormAnchorDay(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            {(formPattern === "monthly" || formPattern === "quarterly") && (
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Day of month</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formAnchorDay}
                  onChange={(e) => setFormAnchorDay(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                />
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="text-xs text-muted/60">
                Next 3: <span className="text-foreground/60">{preview.map(formatPreviewDate).join(" → ")}</span>
              </div>
            )}

            {/* End date */}
            {showEndDate ? (
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">End date</label>
                <input
                  type="date"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted/50">Recurs indefinitely</span>
                <button
                  onClick={() => setShowEndDate(true)}
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  Add end date
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleClose}
                disabled={saving}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {saveError && <div className="mt-2"><InlineError message={saveError} onDismiss={() => setSaveError(null)} /></div>}
          </div>
        </div>
      </div>

      {/* Discard confirmation — rendered above the editor modal */}
      {showDiscard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => setShowDiscard(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Discard changes"
            className="relative z-10 w-full max-w-xs rounded-xl border border-border bg-surface p-6 shadow-xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-foreground">Discard changes?</h2>
            <p className="mt-2 text-sm text-muted">You have unsaved changes to the recurrence pattern.</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDiscard(false)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-muted"
              >
                Stay
              </button>
              <button
                onClick={handleDiscard}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
