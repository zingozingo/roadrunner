"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const LS_KEY = "relay-last-catalog-sync";

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  };
  return date.toLocaleDateString("en-US", opts);
}

export default function SyncStatus() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLastSync(localStorage.getItem(LS_KEY));
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      const now = new Date().toISOString();
      localStorage.setItem(LS_KEY, now);
      setLastSync(now);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface px-5 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Sync Status
      </h3>
      <div className="flex flex-col gap-1.5">
        {/* Catalogs row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="font-medium">Catalogs</span>
            <span className="text-xs text-muted">
              {lastSync ? formatSyncTime(lastSync) : "Never synced"}
            </span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {/* Activity row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="font-medium">Activity</span>
            <span className="text-xs text-muted">Auto-synced on every update</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-status-active">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-active" />
            Live
          </span>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
