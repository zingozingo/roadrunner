import { useState, useEffect, useRef, useCallback } from "react";
import type {
  DisplayContext,
  MeetingNoteWithTasks,
  Task,
  NoteSummaryResult,
} from "@/lib/types";
import ContextSidebar from "./ContextSidebar";
import PreviousNotes from "./PreviousNotes";
import TaskEditor from "./TaskEditor";

type Phase = "editing" | "review" | "saved";

interface NoteWorkspaceProps {
  noteId: string;
  partnerName: string;
  noteType: "meeting";
  meetingDate: string | null;
  title: string | null;
  context: DisplayContext;
  initialRawNotes?: string;
  initialSummary?: string;
  initialTasks?: Task[];
  initialPhase?: Phase;
  meetingId?: string;
}

const PHASE_LABELS: Record<Phase, string> = {
  editing: "Writing",
  review: "Review",
  saved: "Complete",
};

export default function NoteWorkspace({
  noteId,
  partnerName,
  noteType,
  meetingDate,
  title,
  context,
  initialRawNotes,
  initialSummary,
  initialTasks,
  initialPhase,
  meetingId,
}: NoteWorkspaceProps) {
  const [phase, setPhase] = useState<Phase>(initialPhase ?? "editing");
  const [rawNotes, setRawNotes] = useState(initialRawNotes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  // Review state
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [showRawNotes, setShowRawNotes] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);

  const lastSavedRef = useRef(initialRawNotes ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ---- Auto-resize textarea ---- */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(400, el.scrollHeight) + "px";
    }
  }, []);

  /* ---- Save draft ---- */
  const saveDraft = useCallback(
    async (text: string) => {
      if (text === lastSavedRef.current) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_notes: text }),
        });
        if (res.ok) {
          lastSavedRef.current = text;
          setSaveStatus("saved");
          setTimeout(
            () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
            2000
          );
        }
      } catch {
        /* next interval will retry */
      }
    },
    [noteId]
  );

  /* ---- Auto-save every 30s ---- */
  useEffect(() => {
    if (phase !== "editing") return;
    const interval = setInterval(() => saveDraft(rawNotes), 30000);
    return () => clearInterval(interval);
  }, [rawNotes, phase, saveDraft]);

  /* ---- Save on tab switch ---- */
  useEffect(() => {
    const handler = () => {
      if (document.hidden && phase === "editing") saveDraft(rawNotes);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [rawNotes, phase, saveDraft]);

  /* ---- Navigation safety: warn if unsaved review ---- */
  useEffect(() => {
    if (phase !== "review") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  /* ---- Focus on mount ---- */
  useEffect(() => {
    if (phase === "editing") textareaRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialRawNotes) autoResize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Handlers ---- */

  async function handleSummarize() {
    if (rawNotes.trim().length < 50) return;
    await saveDraft(rawNotes);
    setSummarizing(true);
    setSummarizeError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/summarize`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Summary generation failed");
      const result: NoteSummaryResult = await res.json();
      setSummary(result.summary);

      const noteRes = await fetch(`/api/notes/${noteId}`);
      if (noteRes.ok) {
        const { note } = (await noteRes.json()) as {
          note: MeetingNoteWithTasks;
        };
        setTasks(note.tasks);
      }
      setPhase("review");
    } catch (err) {
      setSummarizeError(
        err instanceof Error ? err.message : "Failed to generate summary"
      );
    } finally {
      setSummarizing(false);
    }
  }

  async function refreshNote() {
    const res = await fetch(`/api/notes/${noteId}`);
    if (res.ok) {
      const { note } = (await res.json()) as { note: MeetingNoteWithTasks };
      setTasks(note.tasks);
      if (note.ai_summary) setSummary(note.ai_summary);
    }
  }

  async function handleSaveSummary() {
    await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_summary: summaryDraft }),
    });
    setSummary(summaryDraft);
    setEditingSummary(false);
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await saveDraft(rawNotes);
      await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" }),
      });
      setFinalized(true);
      setTimeout(() => setFinalized(false), 3000);
      setPhase("saved");
    } finally {
      setFinalizing(false);
    }
  }

  const dateDisplay = meetingDate
    ? new Date(meetingDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  /* ---- Render ---- */

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left column — workspace */}
      <div className="space-y-4">
        {/* Header with phase indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {partnerName}
            </span>
            {dateDisplay && (
              <span className="text-xs text-muted">{dateDisplay}</span>
            )}
            {title && (
              <span className="text-xs text-muted truncate">{title}</span>
            )}
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              phase === "editing"
                ? "bg-accent/10 text-accent"
                : phase === "review"
                  ? "bg-status-blocked/10 text-status-blocked"
                  : "bg-status-active/10 text-status-active"
            }`}
          >
            {PHASE_LABELS[phase]}
          </span>
        </div>

        {/* Previous context */}
        <PreviousNotes notes={context.previousNotes} />

        {/* ═══ EDITING PHASE ═══ */}
        {phase === "editing" && (
          <>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={rawNotes}
                onChange={(e) => {
                  setRawNotes(e.target.value);
                  autoResize();
                }}
                placeholder="Start typing your meeting notes\u2026"
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: "400px" }}
              />
              <div className="absolute bottom-3 right-3">
                {saveStatus === "saving" && (
                  <span className="text-xs text-muted animate-pulse">
                    Saving\u2026
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-xs text-status-active">Saved</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSummarize}
                disabled={summarizing || rawNotes.trim().length < 50}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none"
              >
                {summarizing ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Generating summary\u2026
                  </span>
                ) : (
                  "Generate Summary"
                )}
              </button>
              {summarizeError && (
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <span>{summarizeError}</span>
                  <button
                    onClick={handleSummarize}
                    className="underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ REVIEW PHASE ═══ */}
        {phase === "review" && (
          <>
            <div className="space-y-4">
              {/* Raw Notes — collapsible */}
              <Card>
                <button
                  onClick={() => setShowRawNotes(!showRawNotes)}
                  className="flex w-full items-center justify-between"
                >
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
                    Raw Notes
                  </h2>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={`text-muted transition-transform ${showRawNotes ? "rotate-180" : ""}`}
                  >
                    <path d="M3 5l4 4 4-4" />
                  </svg>
                </button>
                {showRawNotes && (
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                    {rawNotes}
                  </pre>
                )}
              </Card>

              {/* Summary — editable */}
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
                    Summary
                  </h2>
                  {!editingSummary && (
                    <button
                      onClick={() => {
                        setSummaryDraft(summary);
                        setEditingSummary(true);
                      }}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingSummary ? (
                  <div className="space-y-2">
                    <textarea
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      rows={14}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none resize-y"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSummary}
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingSummary(false)}
                        className="rounded-md border border-border/50 bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {summary}
                  </div>
                )}
              </Card>

              {/* Tasks — interactive */}
              <Card>
                <TaskEditor
                  tasks={tasks}
                  noteId={noteId}
                  contacts={context.contacts}
                  onRefresh={refreshNote}
                />
              </Card>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none"
              >
                {finalizing ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Saving\u2026
                  </span>
                ) : (
                  "Save & Lock"
                )}
              </button>
              <button
                onClick={() => setPhase("editing")}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Back to Notes
              </button>
              {finalized && (
                <span className="text-xs text-status-active">
                  Saved successfully
                </span>
              )}
            </div>
          </>
        )}

        {/* ═══ SAVED PHASE ═══ */}
        {phase === "saved" && (
          <>
            <div className="space-y-4">
              <Card>
                <button
                  onClick={() => setShowRawNotes(!showRawNotes)}
                  className="flex w-full items-center justify-between"
                >
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
                    Raw Notes
                  </h2>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={`text-muted transition-transform ${showRawNotes ? "rotate-180" : ""}`}
                  >
                    <path d="M3 5l4 4 4-4" />
                  </svg>
                </button>
                {showRawNotes && (
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                    {rawNotes}
                  </pre>
                )}
              </Card>

              <Card>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted/60">
                  Summary
                </h2>
                <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                  {summary}
                </div>
              </Card>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase("editing")}
                className="rounded-md border border-border/50 bg-surface px-4 py-2 text-sm text-foreground/70 transition-colors hover:text-foreground hover:border-border"
              >
                Edit Notes
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right column — context sidebar */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <ContextSidebar context={context} currentNoteId={noteId} />
      </div>
    </div>
  );
}

/* ---- Shared sub-components ---- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-surface p-4">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
