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
  initialEngagementId: string | null;
  initialEngagementName: string | null;
}

export default function EngagementLinker({
  meetingId,
  partnerId,
  initialEngagementId,
  initialEngagementName,
}: EngagementLinkerProps) {
  const [engagementId, setEngagementId] = useState(initialEngagementId);
  const [engagementName, setEngagementName] = useState(initialEngagementName);
  const [picking, setPicking] = useState(false);
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const cache = useRef<EngagementOption[] | null>(null);

  async function openPicker() {
    if (!partnerId) return;
    setPicking(true);

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

  async function linkEngagement(engId: string, engName: string) {
    setSaving(true);
    try {
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

  async function unlinkEngagement() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagement_id: null }),
      });
      if (res.ok) {
        setEngagementId(null);
        setEngagementName(null);
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

  // Picker open — show engagement list
  if (picking) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">Select engagement</span>
          <button
            onClick={() => setPicking(false)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
        {loading ? (
          <p className="text-xs text-muted">Loading...</p>
        ) : engagements.length === 0 ? (
          <p className="text-xs text-muted">No engagements for this partner</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
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
          </div>
        )}
      </div>
    );
  }

  // Unlinked state — clickable "—" or "Link" button
  if (!partnerId) {
    return <span className="text-sm text-muted">—</span>;
  }

  return (
    <button
      onClick={openPicker}
      className="text-sm text-muted hover:text-accent transition-colors"
    >
      — <span className="text-xs ml-1">Link</span>
    </button>
  );
}
