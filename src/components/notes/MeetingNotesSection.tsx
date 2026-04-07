"use client";

import { useState, useEffect, useRef } from "react";
import type { MeetingNoteWithTasks, DisplayContext } from "@/lib/types";
import NoteWorkspace from "./NoteWorkspace";

// Module-level set survives React strict mode unmount/remount cycles.
// Tracks meeting IDs with an auto-create in flight to prevent double POSTs.
const autoCreateInFlight = new Set<string>();

interface MeetingNotesSectionProps {
  meetingId: string;
  partnerId: string;
  partnerName: string;
  engagementId: string | null;
  meetingDate: string | null;
  meetingTitle: string;
  existingNote: MeetingNoteWithTasks | null;
  context: DisplayContext;
  autoOpen?: boolean;
}

export default function MeetingNotesSection({
  meetingId,
  partnerId,
  partnerName,
  meetingDate,
  meetingTitle,
  existingNote,
  context,
  autoOpen,
}: MeetingNotesSectionProps) {
  const [noteId, setNoteId] = useState<string | null>(existingNote?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const autoOpenHandled = useRef(false);

  // Auto-open: scroll to notes if they exist, or auto-create if they don't
  useEffect(() => {
    if (!autoOpen || autoOpenHandled.current) return;
    autoOpenHandled.current = true;

    if (existingNote) {
      // Notes exist — scroll to them
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (!autoCreateInFlight.has(meetingId)) {
      // No notes and no in-flight create — auto-create
      handleStartNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  async function handleStartNotes() {
    setCreating(true);
    setError(null);
    autoCreateInFlight.add(meetingId);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: partnerId,
          meeting_id: meetingId,
          note_type: "meeting",
          title: meetingTitle,
          meeting_date: meetingDate,
          raw_notes: "",
        }),
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
      autoCreateInFlight.delete(meetingId);
      setCreating(false);
    }
  }

  // Existing note — render workspace immediately
  if (existingNote && noteId) {
    return (
      <div ref={sectionRef}>
      <NoteWorkspace
        noteId={existingNote.id}
        partnerName={partnerName}
        noteType={existingNote.note_type}
        meetingDate={meetingDate}
        title={existingNote.title}
        context={context}
        meetingId={meetingId}
        initialRawNotes={existingNote.raw_notes || ""}
        initialSummary={existingNote.ai_summary || ""}
        initialTasks={existingNote.tasks}
        initialPhase={existingNote.status === "complete" ? "saved" : "editing"}
      />
      </div>
    );
  }

  // New note just created — render workspace blank
  if (noteId) {
    return (
      <div ref={sectionRef}>
      <NoteWorkspace
        noteId={noteId}
        partnerName={partnerName}
        noteType="meeting"
        meetingDate={meetingDate}
        title={meetingTitle}
        context={context}
        meetingId={meetingId}
      />
      </div>
    );
  }

  // No note yet — show start button
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center">
      <p className="mb-3 text-sm text-muted">
        No meeting notes yet. Start capturing notes, action items, and decisions.
      </p>
      <button
        onClick={handleStartNotes}
        disabled={creating}
        className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? "Creating..." : "Start Notes"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
