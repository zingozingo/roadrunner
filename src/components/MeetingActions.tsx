"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Meeting, Engagement, MeetingAttendee } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";

const MEETING_TYPES = [
  "Executive Meeting",
  "GTM Meeting",
  "Product Team Relationship",
  "Specialized Meeting",
];

export default function MeetingActions({
  meeting,
  engagements: initialEngagements,
}: {
  meeting: Meeting;
  engagements?: Engagement[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>(initialEngagements ?? []);

  // Edit form state
  const [title, setTitle] = useState(meeting.title);
  const [meetingDate, setMeetingDate] = useState(meeting.meeting_date ?? "");
  const [meetingType, setMeetingType] = useState(meeting.meeting_type ?? "");
  const [engagementId, setEngagementId] = useState(meeting.engagement_id ?? "");
  const [startTime, setStartTime] = useState(meeting.start_time ?? "");
  const [endTime, setEndTime] = useState(meeting.end_time ?? "");
  const [location, setLocation] = useState(meeting.location ?? "");
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [attendeesJson, setAttendeesJson] = useState(() =>
    meeting.attendees.map((a) => `${a.name ?? ""}|${a.email}`).join("\n")
  );

  // Fetch engagements for dropdown if not passed as prop
  useEffect(() => {
    if (initialEngagements) return;
    fetch("/api/engagements")
      .then((res) => res.json())
      .then((data) => setEngagements(data.engagements ?? []))
      .catch(() => {});
  }, [initialEngagements]);

  function startEdit() {
    setTitle(meeting.title);
    setMeetingDate(meeting.meeting_date ?? "");
    setMeetingType(meeting.meeting_type ?? "");
    setEngagementId(meeting.engagement_id ?? "");
    setStartTime(meeting.start_time ?? "");
    setEndTime(meeting.end_time ?? "");
    setLocation(meeting.location ?? "");
    setNotes(meeting.notes ?? "");
    setAttendeesJson(
      meeting.attendees.map((a) => `${a.name ?? ""}|${a.email}`).join("\n")
    );
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function parseAttendees(text: string): MeetingAttendee[] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, email] = line.split("|").map((s) => s.trim());
        return { name: name || null, email: email || name || "" };
      })
      .filter((a) => a.email);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const attendees = parseAttendees(attendeesJson);

      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          meeting_date: meetingDate || null,
          meeting_type: meetingType || null,
          engagement_id: engagementId || null,
          start_time: startTime.trim() || null,
          end_time: endTime.trim() || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
          attendees,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      router.push("/meetings");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
  const labelClass =
    "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted";

  // ── Edit mode ──────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Date */}
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Type */}
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className={inputClass}
              >
                <option value="">No type</option>
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label className={labelClass}>Start Time</label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="e.g. 10:00 AM"
                className={inputClass}
              />
            </div>

            {/* End Time */}
            <div>
              <label className={labelClass}>End Time</label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="e.g. 11:00 AM"
                className={inputClass}
              />
            </div>

            {/* Location */}
            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location or meeting link..."
                className={inputClass}
              />
            </div>

            {/* Engagement */}
            <div>
              <label className={labelClass}>Engagement</label>
              <select
                value={engagementId}
                onChange={(e) => setEngagementId(e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                {engagements
                  .filter((e) => e.status === "active")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.partner_name ? ` (${e.partner_name})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Meeting notes..."
              className={`${inputClass} resize-y min-h-[80px]`}
            />
          </div>

          {/* Attendees */}
          <div>
            <label className={labelClass}>Attendees</label>
            <textarea
              value={attendeesJson}
              onChange={(e) => setAttendeesJson(e.target.value)}
              rows={4}
              placeholder={"Name|email@example.com\nName|email@example.com"}
              className={`${inputClass} resize-y min-h-[80px] font-mono text-xs`}
            />
            <p className="mt-1 text-xs text-muted">One per line: Name|email</p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────
  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={startEdit}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          Edit
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-red-400 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs text-red-400/70 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Meeting"
        message="This will permanently delete this meeting. This action cannot be undone."
        confirmLabel="Delete"
        confirmStyle="danger"
      />
    </>
  );
}
