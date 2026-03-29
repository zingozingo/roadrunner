"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RecurrencePattern } from "@/lib/types";

const PATTERN_LABELS: Record<RecurrencePattern, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface RecurrenceEditorProps {
  meetingId: string;
  initialPattern: RecurrencePattern | null;
  initialEnd: string | null;
  initialSeriesId: string | null;
  initialAnchorDay?: number | null;
}

export default function RecurrenceEditor({
  meetingId,
  initialPattern,
  initialEnd,
  initialSeriesId,
  initialAnchorDay,
}: RecurrenceEditorProps) {
  const router = useRouter();
  const [pattern, setPattern] = useState<RecurrencePattern | null>(initialPattern);
  const [endDate, setEndDate] = useState<string | null>(initialEnd);
  const [seriesId, setSeriesId] = useState<string | null>(initialSeriesId);
  const [anchorDay, setAnchorDay] = useState<number | null>(initialAnchorDay ?? null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for editing
  const [formPattern, setFormPattern] = useState<RecurrencePattern>("weekly");
  const [formEnd, setFormEnd] = useState("");
  const [formAnchorDay, setFormAnchorDay] = useState<number>(0);

  function openEditor() {
    setFormPattern(pattern ?? "weekly");
    setFormEnd(endDate ?? "");
    setFormAnchorDay(anchorDay ?? 0);
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
      }
    } catch (err) {
      console.error("Failed to save recurrence:", err);
    } finally {
      setSaving(false);
    }
  }

  async function skipThisOne() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to skip meeting:", err);
    } finally {
      setSaving(false);
    }
  }

  async function stopRecurrence() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurrence_pattern: null,
          recurrence_end: null,
        }),
      });

      if (res.ok) {
        setPattern(null);
        setEndDate(null);
        setEditing(false);
      }
    } catch (err) {
      console.error("Failed to stop recurrence:", err);
    } finally {
      setSaving(false);
    }
  }

  // Editing mode — inline form
  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Set recurrence</span>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
        <select
          value={formPattern}
          onChange={(e) => setFormPattern(e.target.value as RecurrencePattern)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        >
          {(Object.entries(PATTERN_LABELS) as [RecurrencePattern, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {(formPattern === "weekly" || formPattern === "biweekly") && (
          <select
            value={formAnchorDay}
            onChange={(e) => setFormAnchorDay(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          >
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={formEnd}
          onChange={(e) => setFormEnd(e.target.value)}
          placeholder="End date (optional)"
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <p className="text-[10px] text-muted/60">End date is optional</p>
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

  // Display mode — recurring
  if (pattern) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/70 shrink-0">
            <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" />
            <path d="M14 2v4h-4M2 14v-4h4" />
          </svg>
          <span className="text-sm text-foreground">
            {PATTERN_LABELS[pattern]}
            {anchorDay !== null && (pattern === "weekly" || pattern === "biweekly") ? ` on ${DAY_NAMES[anchorDay]}s` : ""}
          </span>
          <button
            onClick={openEditor}
            className="text-xs text-muted hover:text-accent transition-colors ml-1"
            title="Edit series"
          >
            Edit Series
          </button>
        </div>
        <p className="text-xs text-muted/60 pl-5">
          {endDate
            ? `Until ${new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : "No end date"}
        </p>
        <div className="flex items-center gap-3 pl-5">
          <button
            onClick={skipThisOne}
            disabled={saving}
            className="text-xs text-muted hover:text-status-blocked transition-colors disabled:opacity-50"
          >
            {saving ? "..." : "Skip This One"}
          </button>
          <button
            onClick={stopRecurrence}
            disabled={saving}
            className="text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {saving ? "..." : "End Series"}
          </button>
        </div>
      </div>
    );
  }

  // Display mode — not recurring
  return (
    <button
      onClick={openEditor}
      className="text-sm text-muted hover:text-accent transition-colors"
    >
      Make recurring
    </button>
  );
}
