"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TitleSuggestionProps {
  meetingId: string;
  currentTitle: string;
  suggestedTitle: string;
}

/**
 * Shows a subtle suggestion to rename a meeting title to match the convention.
 * Only rendered when the current title differs from the suggested one.
 */
export default function TitleSuggestion({
  meetingId,
  currentTitle,
  suggestedTitle,
}: TitleSuggestionProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (dismissed || currentTitle === suggestedTitle) return null;

  async function acceptRename() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: suggestedTitle }),
      });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error("Failed to rename meeting:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-md bg-accent/5 border border-accent/10 px-3 py-2">
      <span className="text-xs text-muted">
        Rename to <span className="font-medium text-foreground/70">&ldquo;{suggestedTitle}&rdquo;</span>?
      </span>
      <button
        onClick={acceptRename}
        disabled={saving}
        className="text-xs font-medium text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
      >
        {saving ? "Renaming..." : "Accept"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-muted/50 hover:text-muted transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
