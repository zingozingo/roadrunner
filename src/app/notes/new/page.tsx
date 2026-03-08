"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { DisplayContext } from "@/lib/types";
import NoteWorkspace from "./NoteWorkspace";

interface PartnerOption {
  id: string;
  name: string;
}

export default function NewNotePage() {
  // Phase 1 state
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [noteType, setNoteType] = useState<"meeting" | "seed">("meeting");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");

  // Context & workspace state
  const [context, setContext] = useState<DisplayContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch partners on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/partners");
        if (res.ok) {
          const data = await res.json();
          // partners API returns array directly or { partners: [] }
          const list = Array.isArray(data) ? data : data.partners ?? [];
          setPartners(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      } catch {
        // Silent fail
      }
    })();
  }, []);

  // Fetch context when partner is selected
  useEffect(() => {
    if (!partnerId) {
      setContext(null);
      return;
    }
    setContextLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/notes/context/${partnerId}`);
        if (res.ok) {
          setContext(await res.json());
        }
      } catch {
        // Silent fail
      } finally {
        setContextLoading(false);
      }
    })();
  }, [partnerId]);

  async function handleStart() {
    if (!partnerId) return;
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        partner_id: partnerId,
        note_type: noteType,
        title: title.trim() || null,
        raw_notes: "",
      };
      if (noteType === "meeting") {
        body.meeting_date = meetingDate || null;
      } else {
        body.date_range_start = dateRangeStart || null;
        body.date_range_end = dateRangeEnd || null;
      }

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create note");
      }

      const { note } = await res.json();
      setNoteId(note.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setCreating(false);
    }
  }

  const selectedPartner = partners.find((p) => p.id === partnerId);

  // Phase 2/3 — workspace
  if (noteId && context && selectedPartner) {
    return (
      <div className="p-6 lg:p-8">
        <Link
          href="/notes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 4l-4 4 4 4" />
          </svg>
          Back to Notes
        </Link>

        <NoteWorkspace
          noteId={noteId}
          partnerName={selectedPartner.name}
          noteType={noteType}
          meetingDate={noteType === "meeting" ? meetingDate : null}
          title={title.trim() || null}
          context={context}
        />
      </div>
    );
  }

  // Phase 1 — setup
  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/notes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Notes
      </Link>

      <h1 className="mb-6 text-xl font-bold text-foreground">New Note</h1>

      <div className="mx-auto max-w-lg space-y-6">
        {/* Partner selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Partner</label>
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            <option value="">Select a partner...</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {contextLoading && (
            <p className="mt-1 text-xs text-muted animate-pulse">Loading partner context...</p>
          )}
        </div>

        {/* Note type toggle */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Note Type</label>
          <div className="flex rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => setNoteType("meeting")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                noteType === "meeting"
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Meeting Note
            </button>
            <button
              onClick={() => setNoteType("seed")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                noteType === "seed"
                  ? "bg-purple-500/10 text-purple-400"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Historical Seed
            </button>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Title <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={noteType === "meeting" ? "e.g., Weekly sync with Nozomi" : "e.g., Q4 2025 OneNote dump"}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Date fields */}
        {noteType === "meeting" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Meeting Date <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Start Date <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                End Date <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Context preview */}
        {context && (
          <div className="rounded-lg border border-border/50 bg-surface/50 px-4 py-3">
            <p className="text-xs text-muted">
              Context loaded: {context.activeEngagements.length} active engagement{context.activeEngagements.length !== 1 ? "s" : ""},
              {" "}{context.openTaskCount} open task{context.openTaskCount !== 1 ? "s" : ""},
              {" "}{context.previousNotes.length} previous note{context.previousNotes.length !== 1 ? "s" : ""}
              {context.hasSeedNote && " (includes seed)"}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!partnerId || creating || contextLoading}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "Start Taking Notes"}
        </button>
      </div>
    </div>
  );
}
