"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

interface SyncResponse {
  programs?: SyncResult;
  events?: SyncResult;
  relationships?: SyncResult;
  engagements?: SyncResult;
  duration_ms: number;
  error?: string;
}

function formatResult(label: string, r: SyncResult): string {
  const parts: string[] = [];
  if (r.inserted > 0) parts.push(`${r.inserted} inserted`);
  if (r.updated > 0) parts.push(`${r.updated} updated`);
  if (r.unchanged > 0) parts.push(`${r.unchanged} unchanged`);
  if (r.errors.length > 0) parts.push(`${r.errors.length} errors`);
  return `${label}: ${parts.join(", ") || "no records"}`;
}

export default function SyncButton({
  entity,
  label,
  compact,
}: {
  entity?: "programs" | "events" | "relationships" | "engagements";
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const url = entity ? `/api/sync?entity=${entity}` : "/api/sync";
      const res = await fetch(url, { method: "POST" });
      const data: SyncResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server returned ${res.status}`);
      }

      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const buttonLabel = label ?? (entity ? "Sync" : "Sync from Airtable");

  return (
    <div className={compact ? "inline-flex flex-col items-end" : ""}>
      <button
        onClick={handleSync}
        disabled={syncing}
        className={
          compact
            ? "rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            : "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        }
      >
        {syncing ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Syncing...
          </span>
        ) : (
          buttonLabel
        )}
      </button>

      {/* Result summary */}
      {result && (
        <div className="mt-2 rounded-lg border border-status-active/30 bg-status-active/10 px-3 py-2 text-xs text-status-active">
          <p className="font-medium">
            Sync complete ({(result.duration_ms / 1000).toFixed(1)}s)
          </p>
          <div className="mt-1 space-y-0.5">
            {result.programs && <p>{formatResult("Programs", result.programs)}</p>}
            {result.events && <p>{formatResult("Events", result.events)}</p>}
            {result.relationships && <p>{formatResult("Relationships", result.relationships)}</p>}
            {result.engagements && <p>{formatResult("Engagements", result.engagements)}</p>}
          </div>
          {[result.programs, result.events, result.relationships, result.engagements]
            .filter(Boolean)
            .some((r) => r!.errors.length > 0) && (
            <details className="mt-1">
              <summary className="cursor-pointer text-yellow-400">View errors</summary>
              <ul className="mt-1 space-y-0.5 text-yellow-400/80">
                {[result.programs, result.events, result.relationships, result.engagements]
                  .filter(Boolean)
                  .flatMap((r) => r!.errors)
                  .map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
              </ul>
            </details>
          )}
          <button
            onClick={() => setResult(null)}
            className="mt-1 text-status-active/60 hover:text-status-active"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs text-red-400/60 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
