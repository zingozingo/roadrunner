"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RecurrencePattern } from "@/lib/types";
import { useUnsavedChanges } from "@/components/shared/UnsavedChangesProvider";

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
    // Snap to anchor day for weekly/biweekly
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
  /** Start with the editor form open (used by SeriesActions "Edit Pattern") */
  startEditing?: boolean;
  /** Called when the user cancels editing (lets parent handle collapse) */
  onCancel?: () => void;
}

export default function RecurrenceEditor({
  meetingId,
  meetingDate,
  initialPattern,
  initialEnd,
  initialSeriesId,
  initialAnchorDay,
  startEditing = false,
  onCancel,
}: RecurrenceEditorProps) {
  const router = useRouter();
  const [pattern, setPattern] = useState<RecurrencePattern | null>(initialPattern);
  const [endDate, setEndDate] = useState<string | null>(initialEnd);
  const [seriesId, setSeriesId] = useState<string | null>(initialSeriesId);
  const [anchorDay, setAnchorDay] = useState<number | null>(initialAnchorDay ?? null);
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);

  // Form state for editing — initialize from props when startEditing is true
  const [formPattern, setFormPattern] = useState<RecurrencePattern>(startEditing ? (initialPattern ?? "weekly") : "weekly");
  const [formEnd, setFormEnd] = useState(startEditing ? (initialEnd ?? "") : "");
  const [formAnchorDay, setFormAnchorDay] = useState<number>(
    startEditing
      ? (initialAnchorDay ?? (meetingDate ? new Date(meetingDate + "T12:00:00").getDay() : 0))
      : 0
  );
  const [showEndDate, setShowEndDate] = useState(startEditing ? !!initialEnd : false);
  const { setDirty, clearDirty } = useUnsavedChanges("recurrence-editor");

  useEffect(() => {
    if (editing) setDirty();
    else clearDirty();
  }, [editing, setDirty, clearDirty]);

  function openEditor() {
    setFormPattern(pattern ?? "weekly");
    setFormEnd(endDate ?? "");
    setShowEndDate(!!endDate);
    // Auto-populate anchor day: from existing value, or from meeting date
    if (anchorDay !== null && anchorDay !== undefined) {
      setFormAnchorDay(anchorDay);
    } else if (meetingDate) {
      setFormAnchorDay(new Date(meetingDate + "T12:00:00").getDay());
    } else {
      setFormAnchorDay(0);
    }
    setEditing(true);
  }

  async function saveRecurrence() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        recurrence_pattern: formPattern,
        recurrence_end: formEnd || null,
        anchor_day: formAnchorDay,
      };
      // If no series_id yet, set it to the meeting's own id (first in series)
      if (!seriesId) {
        body.series_id = meetingId;
      } else {
        // Existing series: propagate pattern changes to future meetings
        body.scope = "this_and_future";
      }

      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setPattern(formPattern);
        setEndDate(formEnd || null);
        setAnchorDay(formAnchorDay);
        if (!seriesId) setSeriesId(meetingId);
        setEditing(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to save recurrence:", err);
    } finally {
      setSaving(false);
    }
  }

  // Preview dates for the editor
  const previewStartDate = meetingDate ?? new Date().toISOString().slice(0, 10);
  const preview = editing
    ? previewDates(previewStartDate, formPattern, formAnchorDay, 3)
    : [];

  // Editing mode
  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground/70">Set recurrence</span>
          <button
            onClick={() => { setEditing(false); onCancel?.(); }}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>

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

        {/* Day selector — day-of-week for weekly/biweekly, day-of-month for monthly/quarterly */}
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

        {/* End date — hidden by default */}
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

        <button
          onClick={saveRecurrence}
          disabled={saving}
          className="w-full rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    );
  }

  // Display mode — not recurring (standalone meeting)
  return (
    <button
      onClick={openEditor}
      className="text-sm text-muted hover:text-accent transition-colors"
    >
      Make recurring
    </button>
  );
}
