"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RecurrenceEditor from "./RecurrenceEditor";
import type { RecurrencePattern } from "@/lib/types";

interface SeriesActionsProps {
  meetingId: string;
  meetingDate: string | null;
  seriesId: string | null;
  recurrencePattern: RecurrencePattern | null;
  recurrenceEnd: string | null;
  anchorDay: number | null;
}

export default function SeriesActions({
  meetingId,
  meetingDate,
  seriesId,
  recurrencePattern,
  recurrenceEnd,
  anchorDay,
}: SeriesActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  async function skipThisOne() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error("Failed to skip meeting:", err);
    } finally {
      setSaving(false);
    }
  }

  async function endSeries() {
    setSaving(true);
    try {
      // End on the series root — clear recurrence_pattern so no more spawns
      const targetId = seriesId ?? meetingId;
      const res = await fetch(`/api/meetings/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurrence_pattern: null,
          recurrence_end: null,
        }),
      });
      if (res.ok) {
        setShowEndConfirm(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to end series:", err);
    } finally {
      setSaving(false);
    }
  }

  // Editing mode — show RecurrenceEditor inline
  if (editing) {
    return (
      <div className="mt-3 pt-3 border-t border-border/20">
        <RecurrenceEditor
          meetingId={seriesId ?? meetingId}
          meetingDate={meetingDate}
          initialPattern={recurrencePattern}
          initialEnd={recurrenceEnd}
          initialSeriesId={seriesId}
          initialAnchorDay={anchorDay}
        />
        <button
          onClick={() => setEditing(false)}
          className="mt-2 text-xs text-muted hover:text-foreground transition-colors"
        >
          Cancel editing
        </button>
      </div>
    );
  }

  // End Series confirmation dialog
  if (showEndConfirm) {
    return (
      <>
        {/* Inline confirmation */}
        <div className="mt-3 pt-3 border-t border-border/20">
          <p className="text-sm text-foreground/80 mb-3">
            End this recurring series? Future occurrences will stop being created. Existing meetings are not affected.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={endSeries}
              disabled={saving}
              className="rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {saving ? "Ending..." : "End Series"}
            </button>
            <button
              onClick={() => setShowEndConfirm(false)}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        onClick={() => setEditing(true)}
        disabled={saving}
        className="text-[11px] text-muted/40 hover:text-muted transition-colors disabled:opacity-50"
      >
        Edit Pattern
      </button>
      <span className="text-muted/20">·</span>
      <button
        onClick={skipThisOne}
        disabled={saving}
        className="text-[11px] text-muted/40 hover:text-muted transition-colors disabled:opacity-50"
      >
        {saving ? "..." : "Skip This One"}
      </button>
      <span className="text-muted/20">·</span>
      <button
        onClick={() => setShowEndConfirm(true)}
        disabled={saving}
        className="text-[11px] text-muted/40 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        End Series
      </button>
    </div>
  );
}
