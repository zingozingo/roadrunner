"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Participant } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";

type ParticipantWithLink = Participant & { role: string | null; linkId: string };

// ── Inline edit field ──────────────────────────────────────────
function EditField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none"
      />
    </div>
  );
}

// ── Single participant row ─────────────────────────────────────
function ParticipantRow({
  participant,
  initiativeId,
}: {
  participant: ParticipantWithLink;
  initiativeId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const [name, setName] = useState(participant.name ?? "");
  const [email, setEmail] = useState(participant.email ?? "");
  const [title, setTitle] = useState(participant.title ?? "");
  const [organization, setOrganization] = useState(participant.organization ?? "");

  const isForwarder = participant.role === "forwarder";

  function startEdit() {
    setName(participant.name ?? "");
    setEmail(participant.email ?? "");
    setTitle(participant.title ?? "");
    setOrganization(participant.organization ?? "");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/participants/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim() || null,
          title: title.trim() || null,
          organization: organization.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditing(false);
      router.refresh();
    } catch {
      // Stay in edit mode on error
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setShowRemoveConfirm(false);
    setRemoving(true);
    try {
      const res = await fetch(`/api/participant-links/${participant.linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Remove failed");
      router.refresh();
    } catch {
      setRemoving(false);
    }
  }

  // ── Edit mode ──
  if (editing) {
    return (
      <li className="rounded-lg border border-border bg-background p-2 space-y-1.5">
        <EditField label="Name" value={name} onChange={setName} placeholder="Full name" />
        <EditField label="Email" value={email} onChange={setEmail} placeholder="email@example.com" />
        <EditField label="Title" value={title} onChange={setTitle} placeholder="Job title" />
        <EditField label="Organization" value={organization} onChange={setOrganization} placeholder="Company" />
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  // ── View mode ──
  return (
    <li className="group flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          {participant.name || participant.email || "Unknown"}
        </p>
        {participant.organization && (
          <p className="text-xs text-muted">{participant.organization}</p>
        )}
        {participant.title && !isForwarder && (
          <p className="text-xs text-accent">{participant.title}</p>
        )}
        {participant.role && participant.role !== "forwarder" && !participant.title && (
          <p className="text-xs text-accent">{participant.role}</p>
        )}
        {isForwarder && (
          <p className="text-xs text-muted italic">You</p>
        )}
        {!participant.email && (
          <p className="text-xs text-muted/50">No email</p>
        )}
      </div>
      {!isForwarder && (
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={startEdit}
            className="rounded p-0.5 text-muted hover:text-accent"
            title="Edit participant"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M11.5 2.5l2 2M2 11l-0.5 3.5L5 14l9-9-2-2-10 10z" />
            </svg>
          </button>
          <button
            onClick={() => setShowRemoveConfirm(true)}
            disabled={removing}
            className="rounded p-0.5 text-muted hover:text-red-400 disabled:opacity-50"
            title="Remove from initiative"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        onConfirm={handleRemove}
        onCancel={() => setShowRemoveConfirm(false)}
        title="Remove Participant"
        message={`Remove ${participant.name || "this participant"} from this initiative? They won't be deleted — just unlinked.`}
        confirmLabel="Remove"
        confirmStyle="danger"
      />
    </li>
  );
}

// ── Add participant form ───────────────────────────────────────
function AddParticipantForm({
  initiativeId,
  onDone,
}: {
  initiativeId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/initiatives/${initiativeId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          title: title.trim() || null,
          organization: organization.trim() || null,
          role: role.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Add failed");
      onDone();
      router.refresh();
    } catch {
      // Stay open on error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-2 space-y-1.5">
      <EditField label="Name *" value={name} onChange={setName} placeholder="Full name" />
      <EditField label="Email" value={email} onChange={setEmail} placeholder="email@example.com" />
      <EditField label="Title" value={title} onChange={setTitle} placeholder="Job title" />
      <EditField label="Organization" value={organization} onChange={setOrganization} placeholder="Company" />
      <EditField label="Role" value={role} onChange={setRole} placeholder="e.g. Technical Lead" />
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "..." : "Add"}
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="rounded border border-border px-2 py-0.5 text-[11px] text-muted hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function ParticipantList({
  participants,
  initiativeId,
}: {
  participants: ParticipantWithLink[];
  initiativeId: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Participants ({participants.length})
      </h2>
      {participants.length === 0 && !adding ? (
        <p className="text-sm text-muted">None yet</p>
      ) : (
        <ul className="space-y-2">
          {participants.map((p) => (
            <ParticipantRow
              key={p.linkId}
              participant={p}
              initiativeId={initiativeId}
            />
          ))}
        </ul>
      )}
      {adding ? (
        <div className={participants.length > 0 ? "mt-2" : ""}>
          <AddParticipantForm
            initiativeId={initiativeId}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add participant
        </button>
      )}
    </div>
  );
}
