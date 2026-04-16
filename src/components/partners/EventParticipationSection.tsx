"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUnsavedChanges } from "@/components/shared/UnsavedChangesProvider";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import InlineError from "@/components/shared/InlineError";

interface EventParticipation {
  id: string;
  partner_id: string;
  event_id: string;
  status: string | null;
  sponsoring: boolean;
  notes: string | null;
  event_name?: string;
  event_start_date?: string | null;
}

interface EventOption {
  id: string;
  name: string;
  start_date: string | null;
}

const STATUS_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "invited", label: "Invited" },
  { value: "registered", label: "Registered" },
  { value: "attended", label: "Attended" },
  { value: "declined", label: "Declined" },
];

const STATUS_DISPLAY: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

const STATUS_COLORS: Record<string, string> = {
  interested: "text-status-blocked",
  invited: "text-accent",
  registered: "text-[#06b6d4]",
  attended: "text-status-active",
  declined: "text-muted",
};

function shortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface EventParticipationSectionProps {
  partnerId: string;
  initialParticipations: EventParticipation[];
  events: EventOption[];
}

export default function EventParticipationSection({
  partnerId,
  initialParticipations,
  events,
}: EventParticipationSectionProps) {
  const [participations, setParticipations] = useState(initialParticipations);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useNavigationGuard(submitting);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Form state
  const [formEventId, setFormEventId] = useState("");
  const [formStatus, setFormStatus] = useState("interested");
  const [formSponsoring, setFormSponsoring] = useState(false);
  const [formNotes, setFormNotes] = useState("");
  const { setDirty, clearDirty } = useUnsavedChanges("event-participation-form");

  useEffect(() => {
    if (showModal && formEventId.length > 0) setDirty();
    else clearDirty();
  }, [showModal, formEventId, setDirty, clearDirty]);

  function openModal() {
    setFormEventId("");
    setFormStatus("interested");
    setFormSponsoring(false);
    setFormNotes("");
    setFormError(null);
    setShowModal(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formEventId) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/partners/${partnerId}/event-participations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: formEventId,
          status: formStatus,
          sponsoring: formSponsoring,
          notes: formNotes.trim() || null,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setFormError(data.error);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create");
      }

      const { participation } = await res.json();
      // Enrich with event name for display
      const event = events.find((ev) => ev.id === formEventId);
      const enriched = {
        ...participation,
        event_name: event?.name ?? "Unknown Event",
        event_start_date: event?.start_date ?? null,
      };
      setParticipations((prev) => [...prev, enriched]);
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(participationId: string, newStatus: string) {
    const prev = participations.find((p) => p.id === participationId);
    if (!prev) return;

    setParticipations((list) =>
      list.map((p) => (p.id === participationId ? { ...p, status: newStatus } : p))
    );
    setEditingStatusId(null);

    try {
      const res = await fetch(`/api/partners/${partnerId}/event-participations/${participationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setParticipations((list) =>
        list.map((p) => (p.id === participationId ? { ...p, status: prev.status } : p))
      );
      setInlineError("Failed to update status");
    }
  }

  async function handleSponsoringToggle(participationId: string, newValue: boolean) {
    const prev = participations.find((p) => p.id === participationId);
    if (!prev) return;

    setParticipations((list) =>
      list.map((p) => (p.id === participationId ? { ...p, sponsoring: newValue } : p))
    );

    try {
      const res = await fetch(`/api/partners/${partnerId}/event-participations/${participationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsoring: newValue }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setParticipations((list) =>
        list.map((p) => (p.id === participationId ? { ...p, sponsoring: prev.sponsoring } : p))
      );
      setInlineError("Failed to update sponsoring");
    }
  }

  async function handleDelete(participationId: string) {
    const snapshot = [...participations];
    setParticipations((list) => list.filter((p) => p.id !== participationId));
    setDeletingId(null);

    try {
      const res = await fetch(`/api/partners/${partnerId}/event-participations/${participationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setParticipations(snapshot);
      setInlineError("Failed to delete participation");
    }
  }

  // Filter out events already linked to this partner
  const linkedEventIds = new Set(participations.map((p) => p.event_id));
  const availableEvents = events.filter((ev) => !linkedEventIds.has(ev.id));

  return (
    <>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
            Events
          </h2>
          {participations.length > 0 && (
            <span className="text-xs text-muted/40">{participations.length}</span>
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
        {participations.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted/60">No event participations</div>
        ) : (
          participations.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 last:border-b-0 group">
              {/* Event name */}
              {p.event_id ? (
                <Link href={`/events/${p.event_id}`} className="min-w-0 flex-1 truncate text-sm text-accent hover:underline">
                  {p.event_name ?? "Unknown Event"}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                  {p.event_name ?? "Unknown Event"}
                </span>
              )}

              {/* Sponsoring toggle */}
              <button
                onClick={() => handleSponsoringToggle(p.id, !p.sponsoring)}
                className={`shrink-0 text-[11px] transition-colors ${p.sponsoring ? "text-accent" : "text-muted/20 opacity-0 group-hover:opacity-100"}`}
                title={p.sponsoring ? "Sponsoring (click to remove)" : "Mark as sponsoring"}
              >
                ★
              </button>

              {/* Event date */}
              {p.event_start_date && (
                <span className="shrink-0 text-[11px] text-muted/60">{shortDate(p.event_start_date)}</span>
              )}

              {/* Inline status edit */}
              {editingStatusId === p.id ? (
                <select
                  value={p.status ?? ""}
                  onChange={(ev) => handleStatusChange(p.id, ev.target.value)}
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
                  onClick={() => setEditingStatusId(p.id)}
                  className={`shrink-0 text-[11px] cursor-pointer hover:underline ${STATUS_COLORS[p.status ?? ""] ?? "text-muted"}`}
                  title="Click to change status"
                >
                  {STATUS_DISPLAY[p.status ?? ""] ?? p.status ?? "—"}
                </button>
              )}

              {/* Delete */}
              {deletingId === p.id ? (
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => handleDelete(p.id)}
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
                  onClick={() => setDeletingId(p.id)}
                  className="shrink-0 text-muted/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete participation"
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

            <h2 className="text-lg font-semibold text-foreground mb-4">Add Event Participation</h2>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">
                  Event <span className="text-red-500">*</span>
                </label>
                <select
                  value={formEventId}
                  onChange={(ev) => setFormEventId(ev.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">Select event...</option>
                  {availableEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}{ev.start_date ? ` (${shortDate(ev.start_date)})` : ""}
                    </option>
                  ))}
                </select>
                {availableEvents.length === 0 && events.length > 0 && (
                  <p className="mt-1 text-[10px] text-muted/50">All events are already linked to this partner.</p>
                )}
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

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSponsoring}
                  onChange={(ev) => setFormSponsoring(ev.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground/80">Sponsoring</span>
              </label>

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
                disabled={submitting || !formEventId}
                className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Add Participation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
