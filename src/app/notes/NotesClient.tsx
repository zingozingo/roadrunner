"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import type { MeetingNoteWithTasks } from "@/lib/types";

interface NotesClientProps {
  notes: MeetingNoteWithTasks[];
  partners: { id: string; name: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/20 text-zinc-400",
  complete: "bg-emerald-500/20 text-emerald-400",
};

export default function NotesClient({ notes, partners }: NotesClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title?.toLowerCase().includes(q);
        const matchPartner = n.partner_name?.toLowerCase().includes(q);
        const matchSummary = n.ai_summary?.toLowerCase().includes(q);
        if (!matchTitle && !matchPartner && !matchSummary) return false;
      }
      if (partnerFilter && n.partner_id !== partnerFilter) return false;
      if (typeFilter && n.note_type !== typeFilter) return false;
      if (statusFilter && n.status !== statusFilter) return false;
      return true;
    });
  }, [notes, searchQuery, partnerFilter, typeFilter, statusFilter]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Notes"
          subtitle={`${notes.length} meeting note${notes.length !== 1 ? "s" : ""}`}
        />
        <Link
          href="/notes/new"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          New Note
        </Link>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Create your first meeting note or seed historical context"
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="mb-6 space-y-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Partner dropdown */}
              <select
                value={partnerFilter ?? ""}
                onChange={(e) => setPartnerFilter(e.target.value || null)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">All Partners</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* Type chips */}
              {(["meeting", "seed"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize ${
                    typeFilter === t
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}

              {/* Status chips */}
              {(["draft", "complete"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize ${
                    statusFilter === s
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}

              <span className="ml-auto text-xs text-muted">
                {filtered.length === notes.length
                  ? `${notes.length} notes`
                  : `${filtered.length} of ${notes.length} notes`}
              </span>
            </div>
          </div>

          {/* Notes list */}
          {filtered.length === 0 ? (
            <EmptyState
              title="No matching notes"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div>
              {filtered.map((n) => {
                const openTaskCount = n.tasks.filter((t) => t.status === "open").length;
                const dateDisplay = n.meeting_date
                  ? new Date(n.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : n.date_range_start
                    ? `${new Date(n.date_range_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" })}–${n.date_range_end ? new Date(n.date_range_end + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "present"}`
                    : "—";

                return (
                  <Link
                    key={n.id}
                    href={`/notes/${n.id}`}
                    className={`flex items-center px-4 py-3 border-b transition-colors duration-150 hover:bg-surface gap-3 ${
                      n.note_type === "seed" ? "border-l-2 border-l-purple-500/50 border-b-border/50" : "border-b-border/50"
                    }`}
                  >
                    {/* Date */}
                    <span className="shrink-0 w-20 text-sm font-medium text-foreground">
                      {dateDisplay}
                    </span>

                    {/* Title + preview */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {n.title ?? "Untitled"}
                        </span>
                        {n.note_type === "seed" && (
                          <span className="shrink-0 rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
                            SEED
                          </span>
                        )}
                      </div>
                      {n.ai_summary && (
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {n.ai_summary.slice(0, 120)}
                        </p>
                      )}
                    </div>

                    {/* Partner */}
                    <span className="shrink-0 text-xs text-muted hidden md:block max-w-32 truncate">
                      {n.partner_name ?? "—"}
                    </span>

                    {/* Task count */}
                    {openTaskCount > 0 && (
                      <span className="shrink-0 text-xs text-amber-400 hidden sm:block">
                        {openTaskCount} task{openTaskCount !== 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Status badge */}
                    <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[n.status] ?? STATUS_COLORS.draft}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {n.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
