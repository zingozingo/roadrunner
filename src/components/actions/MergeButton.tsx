"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  engagementId: string;
  engagementName: string;
  partnerId: string;
}

interface EngagementOption {
  id: string;
  name: string;
}

export default function MergeButton({ engagementId, engagementName, partnerId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<EngagementOption | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    if (open) {
      setOpen(false);
      setSelected(null);
      setError(null);
      return;
    }
    setOpen(true);
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch(`/api/engagements?partner_id=${partnerId}`);
      const data = await res.json();
      const all = (data.engagements ?? []) as EngagementOption[];
      setEngagements(all.filter((e) => e.id !== engagementId));
    } catch {
      setError("Failed to load engagements");
    } finally {
      setLoadingList(false);
    }
  }

  async function handleMerge() {
    if (!selected) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/engagements/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: engagementId, target_id: selected.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Merge failed (${res.status})`);
        return;
      }
      router.push(`/engagements/${selected.id}`);
    } catch {
      setError("Network error during merge");
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="text-xs px-3 py-1.5 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        {open ? "Cancel" : "Merge Into\u2026"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 z-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg">
          {/* Confirmation view */}
          {selected ? (
            <div className="p-4 space-y-3">
              <p className="text-sm text-[var(--color-text-primary)]">
                This will permanently merge <strong>{engagementName}</strong> into{" "}
                <strong>{selected.name}</strong>. All messages, meetings, and connections
                will be transferred. This cannot be undone.
              </p>
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setSelected(null); setError(null); }}
                  disabled={merging}
                  className="text-xs px-3 py-1.5 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleMerge}
                  disabled={merging}
                  className="text-xs px-4 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  {merging ? "Merging\u2026" : "Merge"}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                Merge this engagement into:
              </p>
              {loadingList ? (
                <p className="text-xs text-[var(--color-text-tertiary)] py-2">Loading\u2026</p>
              ) : engagements.length === 0 ? (
                <p className="text-xs text-[var(--color-text-tertiary)] py-2">
                  No other engagements for this partner.
                </p>
              ) : (
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {engagements.map((eng) => (
                    <button
                      key={eng.id}
                      onClick={() => setSelected(eng)}
                      className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors"
                    >
                      {eng.name}
                    </button>
                  ))}
                </div>
              )}
              {error && (
                <p className="text-xs text-red-400 mt-2">{error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
