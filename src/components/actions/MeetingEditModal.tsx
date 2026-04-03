"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Meeting, MeetingStatus, MeetingType, Engagement } from "@/lib/types";
import { useUnsavedChanges } from "@/components/shared/UnsavedChangesProvider";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";

const MEETING_STATUSES: MeetingStatus[] = ["scheduled", "completed", "cancelled", "did_not_occur"];

const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: "partner_cadence", label: "Partner Cadence" },
  { value: "sca_review", label: "SCA Review" },
  { value: "qbr", label: "QBR" },
  { value: "executive", label: "Executive" },
  { value: "event", label: "Event" },
  { value: "internal", label: "Internal" },
  { value: "support", label: "Support" },
  { value: "demo", label: "Demo" },
  { value: "enablement", label: "Enablement" },
  { value: "ad_hoc", label: "Ad Hoc" },
];

function formatDisplayDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface MeetingEditModalProps {
  meeting: Meeting;
  partnerName: string | null;
  onClose: () => void;
}

export default function MeetingEditModal({ meeting, partnerName, onClose }: MeetingEditModalProps) {
  const router = useRouter();
  const isRecurring = !!(meeting.series_id || meeting.recurrence_pattern);
  const isSeriesChild = !!(meeting.series_id && meeting.series_id !== meeting.id);

  // Form state
  const [title, setTitle] = useState(meeting.title);
  const [meetingDate, setMeetingDate] = useState(meeting.meeting_date ?? "");
  const [status, setStatus] = useState<string>(meeting.status);
  const [meetingType, setMeetingType] = useState<string>(meeting.meeting_type ?? "");
  const [startTime, setStartTime] = useState(meeting.start_time ?? "");
  const [endTime, setEndTime] = useState(meeting.end_time ?? "");
  const [location, setLocation] = useState(meeting.location ?? "");
  const [engagementId, setEngagementId] = useState(meeting.engagement_id ?? "");
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [saving, setSaving] = useState(false);
  useNavigationGuard(saving);
  const [error, setError] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

  // Reschedule state (for recurring meetings)
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleScope, setRescheduleScope] = useState<"this_one" | "this_and_future">("this_one");

  const { setDirty, clearDirty } = useUnsavedChanges("meeting-edit");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fetch engagements for dropdown
  useEffect(() => {
    fetch("/api/engagements")
      .then((res) => res.json())
      .then((data) => setEngagements(data.engagements ?? []))
      .catch(() => {});
  }, []);

  // Track dirty state
  const isDirty = useCallback(() => {
    if (title !== meeting.title) return true;
    if (meetingDate !== (meeting.meeting_date ?? "")) return true;
    if (status !== meeting.status) return true;
    if (meetingType !== (meeting.meeting_type ?? "")) return true;
    if (startTime !== (meeting.start_time ?? "")) return true;
    if (endTime !== (meeting.end_time ?? "")) return true;
    if (location !== (meeting.location ?? "")) return true;
    if (engagementId !== (meeting.engagement_id ?? "")) return true;
    if (notes !== (meeting.notes ?? "")) return true;
    return false;
  }, [title, meetingDate, status, meetingType, startTime, endTime, location, engagementId, notes, meeting]);

  useEffect(() => {
    if (isDirty()) setDirty();
    else clearDirty();
  }, [isDirty, setDirty, clearDirty]);

  useEffect(() => {
    return () => clearDirty();
  }, [clearDirty]);

  // ESC handler
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
  }, [title, meetingDate, status, meetingType, startTime, endTime, location, engagementId, notes]);

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
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        status: status || "scheduled",
        start_time: startTime.trim() || null,
        end_time: endTime.trim() || null,
        location: location.trim() || null,
        engagement_id: engagementId || null,
        notes: notes.trim() || null,
        meeting_type: meetingType || null,
      };

      // Date handling
      const dateChanged = meetingDate !== (meeting.meeting_date ?? "");
      if (dateChanged) {
        body.meeting_date = meetingDate || null;

        if (isRecurring && meetingDate) {
          // Series root: always propagate (the root IS the series anchor)
          // Series child with "this and future": propagate to future meetings
          const isRoot = !isSeriesChild;
          if (isRoot || rescheduleScope === "this_and_future") {
            const newDow = new Date(meetingDate + "T12:00:00").getDay();
            body.anchor_day = newDow;
            body.scope = "this_and_future";
          }
        }
      }

      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      clearDirty();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none";
  const labelClass =
    "block text-[10px] font-medium text-muted/60 mb-1";

  return (
    <>
      {/* Modal backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Edit meeting"
          className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl mx-4 max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Edit Meeting</h2>
            <button
              onClick={handleClose}
              className="text-muted hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            {/* Title */}
            <div>
              <label className={labelClass}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Date section */}
              {isRecurring ? (
                <div className="col-span-2">
                  <label className={labelClass}>Date</label>
                  {showReschedule ? (
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        className={inputClass}
                      />
                      {isSeriesChild && (
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="reschedule-scope"
                              value="this_one"
                              checked={rescheduleScope === "this_one"}
                              onChange={() => setRescheduleScope("this_one")}
                              className="accent-accent"
                            />
                            <span className="text-xs text-foreground/80">Just this meeting</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="reschedule-scope"
                              value="this_and_future"
                              checked={rescheduleScope === "this_and_future"}
                              onChange={() => setRescheduleScope("this_and_future")}
                              className="accent-accent"
                            />
                            <span className="text-xs text-foreground/80">This and all future</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground/80">
                        {meeting.meeting_date ? formatDisplayDate(meeting.meeting_date) : "No date"}
                      </span>
                      <button
                        onClick={() => setShowReschedule(true)}
                        className="text-xs text-accent hover:text-accent-hover transition-colors"
                      >
                        Reschedule
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Date</label>
                  <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className={inputClass} />
                </div>
              )}

              {/* Status */}
              <div>
                <label className={labelClass}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                  {MEETING_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Meeting Type */}
              <div>
                <label className={labelClass}>Type</label>
                <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {MEETING_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Start Time */}
              <div>
                <label className={labelClass}>Start Time</label>
                <input type="text" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="e.g. 10:00 AM" className={inputClass} />
              </div>

              {/* End Time */}
              <div>
                <label className={labelClass}>End Time</label>
                <input type="text" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="e.g. 11:00 AM" className={inputClass} />
              </div>

              {/* Location */}
              <div>
                <label className={labelClass}>Location</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location or link" className={inputClass} />
              </div>

              {/* Engagement */}
              <div>
                <label className={labelClass}>Engagement</label>
                <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {engagements
                    .filter((e) => e.status === "active")
                    .map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>Calendar Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${inputClass} resize-y`}
                placeholder="Meeting notes..."
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
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
          </div>
        </div>
      </div>

      {/* Discard confirmation */}
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
            <p className="mt-2 text-sm text-muted">You have unsaved changes to this meeting.</p>
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
