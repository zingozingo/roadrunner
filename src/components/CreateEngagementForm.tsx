"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Engagement, Pillar, Priority } from "@/lib/types";

const STATUS_OPTIONS: Engagement["status"][] = ["planned", "active", "paused", "completed", "archived"];
const PILLAR_OPTIONS: Pillar[] = ["Co-Sell", "Co-Market", "Co-Build"];
const PRIORITY_OPTIONS: Priority[] = ["Mandated", "High", "Normal", "Opportunistic"];

export default function CreateEngagementForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [status, setStatus] = useState<Engagement["status"]>("active");
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [currentState, setCurrentState] = useState("");

  function resetForm() {
    setName("");
    setPartnerName("");
    setStatus("active");
    setPillar(null);
    setPriority(null);
    setCurrentState("");
    setError(null);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          partner_name: partnerName.trim() || null,
          status,
          pillar,
          priority,
          current_state: currentState.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      const { engagement } = await res.json();
      setOpen(false);
      router.push(`/engagements/${engagement.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
  const labelClass =
    "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <>
      <button
        onClick={handleOpen}
        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        + New Engagement
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New Engagement"
            className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              New Engagement
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engagement name..."
                  className={inputClass}
                  autoFocus
                />
              </div>

              {/* Partner */}
              <div>
                <label className={labelClass}>Partner</label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Partner name..."
                  className={inputClass}
                />
              </div>

              {/* Status */}
              <div>
                <label className={labelClass}>Status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
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

              {/* Pillar */}
              <div>
                <label className={labelClass}>Pillar</label>
                <div className="flex gap-2">
                  {PILLAR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPillar(pillar === opt ? null : opt)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        pillar === opt
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-background text-muted hover:text-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className={labelClass}>Priority</label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPriority(priority === opt ? null : opt)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        priority === opt
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
                <label className={labelClass}>Current State</label>
                <textarea
                  value={currentState}
                  onChange={(e) => setCurrentState(e.target.value)}
                  rows={4}
                  placeholder="Initial context, notes, or background..."
                  className={inputClass}
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
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Engagement"}
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
      )}
    </>
  );
}
