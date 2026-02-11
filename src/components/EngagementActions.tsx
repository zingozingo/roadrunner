"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Engagement } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";

const STATUS_OPTIONS: Engagement["status"][] = ["active", "paused", "closed"];

export default function EngagementActions({
  engagement,
}: {
  engagement: Engagement;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState(engagement.name);
  const [partnerName, setPartnerName] = useState(engagement.partner_name ?? "");
  const [status, setStatus] = useState<Engagement["status"]>(engagement.status);
  const [currentState, setCurrentState] = useState(
    engagement.current_state ?? engagement.summary ?? ""
  );

  function startEdit() {
    setName(engagement.name);
    setPartnerName(engagement.partner_name ?? "");
    setStatus(engagement.status);
    setCurrentState(engagement.current_state ?? engagement.summary ?? "");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagements/${engagement.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          partner_name: partnerName.trim() || null,
          status,
          summary: currentState.trim() || null,
          current_state: currentState.trim() || null,
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
      const res = await fetch(`/api/engagements/${engagement.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      router.push("/engagements");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  // ── Edit mode ──────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Partner */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Partner
            </label>
            <input
              type="text"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Partner name..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Status
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setStatus(opt)}
                  className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors ${
                    status === opt
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Current State */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
              Current State
            </label>
            <textarea
              value={currentState}
              onChange={(e) => setCurrentState(e.target.value)}
              rows={8}
              placeholder="What's happening with this engagement..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
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
        title="Delete Engagement"
        message="This will remove the engagement and unlink all associated messages. Messages will not be deleted. This action cannot be undone."
        confirmLabel="Delete"
        confirmStyle="danger"
      />
    </>
  );
}
