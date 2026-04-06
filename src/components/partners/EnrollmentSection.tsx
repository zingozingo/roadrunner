"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUnsavedChanges } from "@/components/shared/UnsavedChangesProvider";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import InlineError from "@/components/shared/InlineError";

interface Enrollment {
  id: string;
  partner_id: string;
  program_id: string | null;
  program_name: string | null;
  status: string | null;
  date_achieved: string | null;
  notes: string | null;
  program_category: string | null;
  program_mdf_value: number | null;
}

interface ProgramOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "interested", label: "Interested" },
  { value: "denied", label: "Denied" },
  { value: "expired", label: "Expired" },
];

const STATUS_DISPLAY: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

const STATUS_COLORS: Record<string, string> = {
  approved: "text-status-active",
  in_progress: "text-status-blocked",
  submitted: "text-accent",
  interested: "text-accent/70",
  denied: "text-red-400",
  expired: "text-muted",
  not_started: "text-muted",
};

function shortDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d + "T12:00:00");
  const currentYear = new Date().getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== currentYear) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

function getMdfExpiry(e: Enrollment): { label: string; expired: boolean } | null {
  if (
    e.program_category?.toLowerCase() !== "specialization" ||
    !e.program_mdf_value ||
    e.program_mdf_value <= 0 ||
    !e.date_achieved
  ) return null;

  const achievedYear = new Date(e.date_achieved + "T12:00:00").getFullYear();
  const expiryYear = achievedYear + 1;
  const expired = new Date() > new Date(`${expiryYear}-12-31T23:59:59`);
  return {
    label: `MDF ${expired ? "expired" : "through"} Dec ${expiryYear}`,
    expired,
  };
}

interface EnrollmentSectionProps {
  partnerId: string;
  initialEnrollments: Enrollment[];
  programs: ProgramOption[];
}

export default function EnrollmentSection({
  partnerId,
  initialEnrollments,
  programs,
}: EnrollmentSectionProps) {
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useNavigationGuard(submitting);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Form state
  const [formProgramName, setFormProgramName] = useState("");
  const [formStatus, setFormStatus] = useState("not_started");
  const [formDate, setFormDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formProgramId, setFormProgramId] = useState("");
  const { setDirty, clearDirty } = useUnsavedChanges("enrollment-form");

  useEffect(() => {
    if (showModal && formProgramName.trim().length > 0) setDirty();
    else clearDirty();
  }, [showModal, formProgramName, setDirty, clearDirty]);

  function openModal() {
    setFormProgramName("");
    setFormStatus("not_started");
    setFormDate("");
    setFormNotes("");
    setFormProgramId("");
    setFormError(null);
    setShowModal(true);
  }

  function handleProgramSelect(programId: string) {
    setFormProgramId(programId);
    if (programId) {
      const prog = programs.find((p) => p.id === programId);
      if (prog) setFormProgramName(prog.name);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formProgramName.trim()) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/partners/${partnerId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_name: formProgramName.trim(),
          status: formStatus,
          date_achieved: formDate || null,
          notes: formNotes.trim() || null,
          program_id: formProgramId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create enrollment");
      }

      const { enrollment } = await res.json();
      setEnrollments((prev) => [...prev, enrollment]);
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(enrollmentId: string, newStatus: string) {
    const prev = enrollments.find((e) => e.id === enrollmentId);
    if (!prev) return;

    // Optimistic update
    setEnrollments((list) =>
      list.map((e) => (e.id === enrollmentId ? { ...e, status: newStatus } : e))
    );
    setEditingStatusId(null);

    try {
      const res = await fetch(`/api/partners/${partnerId}/enrollments/${enrollmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      setEnrollments((list) =>
        list.map((e) => (e.id === enrollmentId ? { ...e, status: prev.status } : e))
      );
      setInlineError("Failed to update status");
    }
  }

  async function handleDelete(enrollmentId: string) {
    const snapshot = [...enrollments];
    setEnrollments((list) => list.filter((e) => e.id !== enrollmentId));
    setDeletingId(null);

    try {
      const res = await fetch(`/api/partners/${partnerId}/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setEnrollments(snapshot);
      setInlineError("Failed to delete enrollment");
    }
  }

  return (
    <>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
            Program Enrollments
          </h2>
          {enrollments.length > 0 && (
            <span className="text-xs text-muted/40">{enrollments.length}</span>
          )}
        </div>
        <button
          onClick={openModal}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          + Add
        </button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
        {enrollments.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted/60">No program enrollments</div>
        ) : (
          enrollments.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 last:border-b-0 group">
              {/* Program name */}
              {e.program_id ? (
                <Link href={`/programs/${e.program_id}`} className="min-w-0 flex-1 truncate text-sm text-accent hover:underline">
                  {e.program_name ?? "Unknown"}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                  {e.program_name ?? "Unknown"}
                </span>
              )}

              {/* Inline status edit */}
              {editingStatusId === e.id ? (
                <select
                  value={e.status ?? ""}
                  onChange={(ev) => handleStatusChange(e.id, ev.target.value)}
                  onBlur={() => setEditingStatusId(null)}
                  autoFocus
                  className="shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-foreground"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => setEditingStatusId(e.id)}
                  className={`shrink-0 text-[11px] cursor-pointer hover:underline ${STATUS_COLORS[e.status ?? ""] ?? "text-muted"}`}
                  title="Click to change status"
                >
                  {STATUS_DISPLAY[e.status ?? ""] ?? e.status ?? "—"}
                </button>
              )}

              {/* Date + MDF */}
              <div className="shrink-0 flex items-center gap-2">
                {e.date_achieved && (
                  <span className="text-[11px] text-muted/60">{shortDate(e.date_achieved)}</span>
                )}
                {(() => {
                  const mdf = getMdfExpiry(e);
                  if (!mdf) return null;
                  return (
                    <span className={`text-[10px] ${mdf.expired ? "text-muted/40" : "text-accent/60"}`}>
                      {mdf.label}
                    </span>
                  );
                })()}
              </div>

              {/* Delete */}
              {deletingId === e.id ? (
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="text-[10px] font-medium text-red-400 hover:text-red-300"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="text-[10px] text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeletingId(e.id)}
                  className="shrink-0 text-muted/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete enrollment"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {inlineError && <div className="mt-2"><InlineError message={inlineError} onDismiss={() => setInlineError(null)} /></div>}

      {/* Create Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(ev) => { if (ev.target === ev.currentTarget) setShowModal(false); }}
        >
          <div className="relative rounded-xl border border-border bg-surface p-6 max-w-md w-full mx-4">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>

            <h2 className="text-lg font-semibold text-foreground mb-4">Add Enrollment</h2>

            <form onSubmit={handleCreate} className="space-y-3">
              {/* Program catalog link */}
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Program (from catalog)</label>
                <select
                  value={formProgramId}
                  onChange={(ev) => handleProgramSelect(ev.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">Enter name manually...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Program name */}
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">
                  Program Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formProgramName}
                  onChange={(ev) => setFormProgramName(ev.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  placeholder="e.g. Security Competency"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formStatus}
                  onChange={(ev) => setFormStatus(ev.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Date Achieved</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(ev) => setFormDate(ev.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(ev) => setFormNotes(ev.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground resize-none"
                  placeholder="Optional notes..."
                />
              </div>

              {formError && <p className="text-sm text-red-400">{formError}</p>}

              <button
                type="submit"
                disabled={submitting || !formProgramName.trim()}
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Enrollment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
