"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface EngagementOption {
  id: string;
  name: string;
}

interface EngagementLinkerProps {
  meetingId: string;
  partnerId: string | null;
  partnerName: string | null;
  meetingTitle: string | null;
  noteCondensed: string | null;
  initialEngagementId: string | null;
  initialEngagementName: string | null;
}

export default function EngagementLinker({
  meetingId,
  partnerId,
  partnerName,
  meetingTitle,
  noteCondensed,
  initialEngagementId,
  initialEngagementName,
}: EngagementLinkerProps) {
  const [engagementId, setEngagementId] = useState(initialEngagementId);
  const [engagementName, setEngagementName] = useState(initialEngagementName);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const cache = useRef<EngagementOption[] | null>(null);

  async function openPicker() {
    if (!partnerId) return;
    setPicking(true);
    setCreating(false);

    if (cache.current) {
      setEngagements(cache.current);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/engagements?partner_id=${partnerId}`);
      const data = await res.json();
      const list: EngagementOption[] = (data.engagements ?? []).map(
        (e: any) => ({ id: e.id, name: e.name })
      );
      cache.current = list;
      setEngagements(list);
    } catch (err) {
      console.error("Failed to fetch engagements:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    const suggestedTitle = partnerName && meetingTitle
      ? `${partnerName} — ${meetingTitle}`
      : partnerName
        ? `${partnerName} — New Engagement`
        : "New Engagement";
    setNewTitle(suggestedTitle);
    setCreating(true);
  }

  async function linkEngagement(engId: string, engName: string) {
    setSaving(true);
    try {
      // PUT sets engagement_id on meeting; cascade runs server-side
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagement_id: engId }),
      });
      if (res.ok) {
        setEngagementId(engId);
        setEngagementName(engName);
        setPicking(false);
      }
    } catch (err) {
      console.error("Failed to link engagement:", err);
    } finally {
      setSaving(false);
    }
  }

  async function createAndLink() {
    if (!newTitle.trim() || !partnerId) return;
    setSaving(true);
    try {
      // 1. Create engagement
      const createRes = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTitle.trim(), partner_id: partnerId }),
      });
      if (!createRes.ok) throw new Error("Failed to create engagement");
      const { engagement } = await createRes.json();

      // 2. Link meeting → engagement (cascade runs server-side)
      const linkRes = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagement_id: engagement.id }),
      });
      if (!linkRes.ok) throw new Error("Failed to link meeting");

      // 3. Seed engagement current_state from note condensed digest
      if (noteCondensed) {
        await fetch(`/api/engagements/${engagement.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_state: noteCondensed,
            condensed: noteCondensed,
          }),
        });
      }

      setEngagementId(engagement.id);
      setEngagementName(engagement.name);
      setPicking(false);
      setCreating(false);
      cache.current = null; // Invalidate cache
    } catch (err) {
      console.error("Failed to create and link engagement:", err);
    } finally {
      setSaving(false);
    }
  }

  async function unlinkEngagement() {
    setSaving(true);
    try {
      // PUT clears engagement_id; cascade runs server-side
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagement_id: null }),
      });
      if (res.ok) {
        setEngagementId(null);
        setEngagementName(null);
        cache.current = null; // Invalidate cache
      }
    } catch (err) {
      console.error("Failed to unlink engagement:", err);
    } finally {
      setSaving(false);
    }
  }

  // Linked state — show name + unlink button
  if (engagementId && engagementName) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/engagements/${engagementId}`}
          className="text-sm font-medium text-accent hover:underline"
        >
          {engagementName}
        </Link>
        <button
          onClick={unlinkEngagement}
          disabled={saving}
          className="text-xs text-muted hover:text-red-400 transition-colors disabled:opacity-50"
          title="Unlink engagement"
        >
          ×
        </button>
      </div>
    );
  }

  // Picker open — show engagement list + create option
  if (picking) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">
            {creating ? "Create engagement" : "Select engagement"}
          </span>
          <button
            onClick={() => { setPicking(false); setCreating(false); }}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>

        {creating ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Engagement title"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") createAndLink(); }}
            />
            <button
              onClick={createAndLink}
              disabled={saving || !newTitle.trim()}
              className="w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create & Link"}
            </button>
          </div>
        ) : loading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {/* Create new option */}
            <button
              onClick={openCreateForm}
              disabled={saving}
              className="w-full text-left flex items-center gap-2 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-accent/5 disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-accent">
                <path d="M8 4v8M4 8h8" />
              </svg>
              <span className="text-sm font-medium text-accent">
                Create new engagement
              </span>
            </button>

            {/* Existing engagements */}
            {engagements.map((eng) => (
              <button
                key={eng.id}
                onClick={() => linkEngagement(eng.id, eng.name)}
                disabled={saving}
                className="w-full text-left flex items-baseline gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-foreground">
                  {eng.name}
                </span>
              </button>
            ))}

            {engagements.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted">No existing engagements</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Unlinked state — clickable button
  if (!partnerId) {
    return <span className="text-sm text-muted">—</span>;
  }

  return (
    <button
      onClick={openPicker}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-accent/40 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/5 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 4v8M4 8h8" />
      </svg>
      Link to engagement
    </button>
  );
}
