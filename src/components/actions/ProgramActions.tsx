"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Program, ProgramType } from "@/lib/types";
import ConfirmDialog from "../shared/ConfirmDialog";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";

const TYPE_OPTIONS: (ProgramType | "")[] = [
  "",
  "Competency",
  "Service Ready",
  "SCA",
  "Program",
  "Credit Program",
  "Funding",
  "Channel",
  "Enablement",
];
const LIFECYCLE_OPTIONS: Program["lifecycle_type"][] = ["indefinite", "recurring", "expiring"];

export default function ProgramActions({ program }: { program: Program }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useNavigationGuard(saving || deleting);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState(program.name);
  const [type, setType] = useState<ProgramType | "">(program.type ?? "");
  const [description, setDescription] = useState(program.description ?? "");
  const [requirements, setRequirements] = useState(program.requirements ?? "");

  function startEdit() {
    setName(program.name);
    setType(program.type ?? "");
    setDescription(program.description ?? "");
    setRequirements(program.requirements ?? "");
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
      const res = await fetch(`/api/programs/${program.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: type || null,
          description: description.trim() || null,
          requirements: requirements.trim() || null,
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
      const res = await fetch(`/api/programs/${program.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      router.push("/programs");
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
          {/* Name */}
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Type */}
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProgramType | "")}
              className={inputClass}
            >
              <option value="">No type</option>
              {TYPE_OPTIONS.filter(Boolean).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Program description..."
              className={`${inputClass} resize-y min-h-[100px]`}
            />
          </div>

          {/* Requirements */}
          <div>
            <label className={labelClass}>Requirements</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              placeholder="Program requirements..."
              className={`${inputClass} resize-y min-h-[60px]`}
            />
          </div>

          {/* Lifecycle (read-only display) */}
          <div>
            <label className={labelClass}>Lifecycle</label>
            <div className="flex gap-2">
              {LIFECYCLE_OPTIONS.map((opt) => (
                <span
                  key={opt}
                  className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
                    program.lifecycle_type === opt
                      ? "border-accent/40 bg-accent/5 text-foreground"
                      : "border-border text-muted"
                  }`}
                >
                  {opt}
                </span>
              ))}
            </div>
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
        title="Delete Program"
        message="This will remove the program and unlink all associated engagements. This action cannot be undone."
        confirmLabel="Delete"
        confirmStyle="danger"
      />
    </>
  );
}
