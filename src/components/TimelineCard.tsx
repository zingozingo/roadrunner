// TODO: Phase 4 — remove this component entirely (timeline_entries eliminated from data model)
interface TimelineEntry {
  date: string;
  precision: "exact" | "week" | "month" | "quarter";
  description: string;
}

function formatDateBadge(entry: TimelineEntry): string {
  const d = new Date(entry.date + "T00:00:00");

  switch (entry.precision) {
    case "quarter": {
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return `Q${q} ${d.getFullYear()}`;
    }
    case "month":
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
    default:
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  }
}

function badgeColor(precision: TimelineEntry["precision"]): string {
  switch (precision) {
    case "exact":
      return "bg-accent/15 text-accent";
    case "month":
      return "bg-status-paused/15 text-status-paused";
    case "quarter":
      return "bg-border text-muted";
    default:
      return "bg-border text-muted";
  }
}

export default function TimelineCard({
  entries,
}: {
  entries: TimelineEntry[];
}) {
  if (entries.length === 0) return null;

  // Sort chronologically
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
        Timeline
      </h2>
      <ul className="space-y-2">
        {sorted.map((entry, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${badgeColor(entry.precision)}`}
            >
              {formatDateBadge(entry)}
            </span>
            <span className="text-foreground/90">{entry.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
