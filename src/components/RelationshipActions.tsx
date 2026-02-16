"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AwsRelationship, RelationshipStrength } from "@/lib/types";

const STRENGTH_OPTIONS: RelationshipStrength[] = ["Strong", "Building", "New", "Deferred"];

export default function RelationshipActions({
  relationship,
}: {
  relationship: AwsRelationship;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [strength, setStrength] = useState<RelationshipStrength | null>(relationship.strength);
  const [notes, setNotes] = useState(relationship.notes ?? "");
  const [primaryContactEmail, setPrimaryContactEmail] = useState(
    relationship.primary_contact_email ?? ""
  );
  const [awsContactEmails, setAwsContactEmails] = useState(
    relationship.aws_contact_emails.join(", ")
  );

  function startEdit() {
    setStrength(relationship.strength);
    setNotes(relationship.notes ?? "");
    setPrimaryContactEmail(relationship.primary_contact_email ?? "");
    setAwsContactEmails(relationship.aws_contact_emails.join(", "));
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const emailArray = awsContactEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch(`/api/relationships/${relationship.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strength,
          notes: notes.trim() || null,
          primary_contact_email: primaryContactEmail.trim() || null,
          aws_contact_emails: emailArray,
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

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
  const labelClass =
    "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted";

  // ── Edit mode ──────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="space-y-4">
          {/* Strength */}
          <div>
            <label className={labelClass}>Strength</label>
            <div className="flex gap-2">
              {STRENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setStrength(strength === opt ? null : opt)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    strength === opt
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Contact Email */}
          <div>
            <label className={labelClass}>Primary Contact Email</label>
            <input
              type="email"
              value={primaryContactEmail}
              onChange={(e) => setPrimaryContactEmail(e.target.value)}
              placeholder="name@amazon.com"
              className={inputClass}
            />
          </div>

          {/* AWS Contact Emails */}
          <div>
            <label className={labelClass}>AWS Contact Emails</label>
            <input
              type="text"
              value={awsContactEmails}
              onChange={(e) => setAwsContactEmails(e.target.value)}
              placeholder="email1@amazon.com, email2@amazon.com"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted">Comma-separated</p>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes about this relationship..."
              className={`${inputClass} resize-y min-h-[80px]`}
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
    </>
  );
}
