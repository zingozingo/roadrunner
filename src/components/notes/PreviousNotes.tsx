import { useState } from "react";

interface PreviousNote {
  title: string | null;
  meeting_date: string | null;
  ai_summary: string;
  note_type: string;
}

export default function PreviousNotes({ notes }: { notes: PreviousNote[] }) {
  const [open, setOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (notes.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Previous Context ({notes.length})
        </h2>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 5l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {notes.map((n, i) => {
            const label = n.meeting_date
              ? new Date(n.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Note";
            const isExpanded = expandedIdx === i;
            const summary = isExpanded ? n.ai_summary : n.ai_summary.slice(0, 150);

            return (
              <div key={i} className="rounded-lg border border-border/50 bg-background px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted">
                    {label}
                  </span>
                  {n.title && <span className="truncate text-xs text-foreground/80">{n.title}</span>}
                </div>
                <p className="mt-1 text-xs text-foreground/60 leading-relaxed">
                  {summary}
                  {!isExpanded && n.ai_summary.length > 150 && "..."}
                </p>
                {n.ai_summary.length > 150 && (
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    className="mt-1 text-xs text-accent hover:underline"
                  >
                    {isExpanded ? "Less" : "More"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
