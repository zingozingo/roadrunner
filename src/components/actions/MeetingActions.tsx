"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Meeting } from "@/lib/types";
import ConfirmDialog from "../shared/ConfirmDialog";
import MeetingEditModal from "./MeetingEditModal";

export default function MeetingActions({
  meeting,
  partnerName,
}: {
  meeting: Meeting;
  partnerName?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
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

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(true)}
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
          <button onClick={() => setError(null)} className="mt-1 text-xs text-red-400/70 hover:text-red-400">Dismiss</button>
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

      {editing && (
        <MeetingEditModal
          meeting={meeting}
          partnerName={partnerName ?? null}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
