"use client";

import { useState } from "react";
import type { MeetingNoteWithTasks, DisplayContext } from "@/lib/types";
import NoteWorkspace from "./NoteWorkspace";

interface MeetingNotesSectionProps {
  meetingId: string;
  partnerId: string;
  partnerName: string;
  engagementId: string | null;
  meetingDate: string | null;
  meetingTitle: string;
  existingNote: MeetingNoteWithTasks | null;
  context: DisplayContext;
}

export default function MeetingNotesSection({
  meetingId,
  partnerId,
  partnerName,
  meetingDate,
  meetingTitle,
  existingNote,
  context,
}: MeetingNotesSectionProps) {
  const [noteId, setNoteId] = useState<string | null>(existingNote?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartNotes() {
    setCreating(true);
    setError(null);
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
      setCreating(false);
    }
  }

  // Existing note — render workspace immediately
  if (existingNote && noteId) {
    return (
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
    );
  }

  // New note just created — render workspace blank
  if (noteId) {
    return (
      <NoteWorkspace
        noteId={noteId}
        partnerName={partnerName}
        noteType="meeting"
        meetingDate={meetingDate}
        title={meetingTitle}
        context={context}
        meetingId={meetingId}
      />
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
