import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DisplayContext, MeetingNoteWithTasks, NoteTask, NoteSummaryResult } from "@/lib/types";
import ContextSidebar from "./ContextSidebar";
import PreviousNotes from "./PreviousNotes";
import TaskEditor from "./TaskEditor";

type Phase = "editing" | "review";
type ReviewTab = "raw" | "summary" | "tasks";

interface NoteWorkspaceProps {
  noteId: string;
  partnerName: string;
  noteType: "meeting" | "seed";
  meetingDate: string | null;
  title: string | null;
  context: DisplayContext;
}

export default function NoteWorkspace({
  noteId,
  partnerName,
  noteType,
  meetingDate,
  title,
  context,
}: NoteWorkspaceProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("editing");
  const [rawNotes, setRawNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);

  // Review state
  const [reviewTab, setReviewTab] = useState<ReviewTab>("summary");
  const [summary, setSummary] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [tasks, setTasks] = useState<NoteTask[]>([]);
  const [flags, setFlags] = useState<Array<{ type: string; description: string }>>([]);

  const lastSavedRef = useRef(rawNotes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(400, el.scrollHeight) + "px";
    }
  }, []);

  // Save draft to server
  const saveDraft = useCallback(async (text: string) => {
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
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
      }
    } catch {
      // Silent fail — next interval will retry
    }
  }, [noteId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (phase !== "editing") return;
    const interval = setInterval(() => saveDraft(rawNotes), 30000);
    return () => clearInterval(interval);
  }, [rawNotes, phase, saveDraft]);

  // Save on visibility change (tab switch)
  useEffect(() => {
    const handler = () => {
      if (document.hidden && phase === "editing") saveDraft(rawNotes);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [rawNotes, phase, saveDraft]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSummarize() {
    if (rawNotes.trim().length < 50) return;
    // Save current notes first
    await saveDraft(rawNotes);
    setSummarizing(true);
    setSummarizeError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/summarize`, { method: "POST" });
      if (!res.ok) throw new Error("Summarization failed");
      const result: NoteSummaryResult = await res.json();
      setSummary(result.summary);
      setFlags(result.flags);

      // Fetch full note to get persisted tasks
      const noteRes = await fetch(`/api/notes/${noteId}`);
      if (noteRes.ok) {
        const { note } = await noteRes.json() as { note: MeetingNoteWithTasks };
        setTasks(note.tasks);
      }

      setPhase("review");
      setReviewTab("summary");
    } catch (err) {
      setSummarizeError(err instanceof Error ? err.message : "Failed to summarize");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleReSummarize() {
    if (!confirm("This will overwrite the current summary and tasks. Continue?")) return;
    await handleSummarize();
  }

  async function refreshNote() {
    const res = await fetch(`/api/notes/${noteId}`);
    if (res.ok) {
      const { note } = await res.json() as { note: MeetingNoteWithTasks };
      setTasks(note.tasks);
      if (note.ai_summary) setSummary(note.ai_summary);
      if (note.ai_flags) setFlags(note.ai_flags as Array<{ type: string; description: string }>);
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
    await saveDraft(rawNotes);
    await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "finalized" }),
    });
    router.push(`/notes/${noteId}`);
  }

  async function handleSaveAsSummarized() {
    await saveDraft(rawNotes);
    await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "summarized" }),
    });
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  const dateDisplay = meetingDate
    ? new Date(meetingDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left column — main workspace */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-foreground">{partnerName}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            noteType === "seed" ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
          }`}>
            {noteType === "seed" ? "SEED" : "Meeting"}
          </span>
          {dateDisplay && <span className="text-xs text-muted">{dateDisplay}</span>}
          {title && <span className="text-xs text-muted truncate">{title}</span>}
        </div>

        {/* Previous context */}
        <PreviousNotes notes={context.previousNotes} />

        {phase === "editing" ? (
          <>
            {/* Main textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={rawNotes}
                onChange={(e) => {
                  setRawNotes(e.target.value);
                  autoResize();
                }}
                placeholder="Start typing your meeting notes... Include action items, decisions, partner intel, anything discussed."
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: "400px" }}
              />
              {/* Save indicator */}
              <div className="absolute bottom-3 right-3">
                {saveStatus === "saving" && (
                  <span className="text-xs text-muted animate-pulse">Saving...</span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-xs text-emerald-400">Saved</span>
                )}
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSummarize}
                disabled={summarizing || rawNotes.trim().length < 50}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {summarizing ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Analyzing notes...
                  </span>
                ) : (
                  "Summarize with AI"
                )}
              </button>
              <button
                onClick={() => saveDraft(rawNotes)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-muted"
              >
                Save Draft
              </button>
              {summarizeError && (
                <span className="text-xs text-red-400">{summarizeError}</span>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Review phase — tab bar */}
            <div className="flex border-b border-border">
              {([
                { key: "raw" as const, label: "Raw Notes" },
                { key: "summary" as const, label: "Summary" },
                { key: "tasks" as const, label: "Tasks & Flags" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setReviewTab(key)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    reviewTab === key
                      ? "border-accent text-accent"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="rounded-xl border border-border bg-surface p-4">
              {reviewTab === "raw" && (
                <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                  {rawNotes}
                </pre>
              )}

              {reviewTab === "summary" && (
                <div>
                  <div className="mb-3 flex items-center justify-end gap-2">
                    {!editingSummary && (
                      <button
                        onClick={() => {
                          setSummaryDraft(summary);
                          setEditingSummary(true);
                        }}
                        className="text-xs text-accent hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={handleReSummarize}
                      disabled={summarizing}
                      className="rounded-lg border border-border bg-background px-3 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
                    >
                      {summarizing ? "Summarizing..." : "Re-summarize"}
                    </button>
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
                        <button onClick={handleSaveSummary} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
                          Save
                        </button>
                        <button onClick={() => setEditingSummary(false)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted hover:text-foreground">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {summary}
                    </div>
                  )}
                </div>
              )}

              {reviewTab === "tasks" && (
                <TaskEditor
                  tasks={tasks}
                  flags={flags}
                  noteId={noteId}
                  onRefresh={refreshNote}
                />
              )}
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleFinalize}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Finalize & Save
              </button>
              <button
                onClick={handleSaveAsSummarized}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-muted"
              >
                Save as Summarized
              </button>
              <button
                onClick={() => setPhase("editing")}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Back to Editing
              </button>
              {saveStatus === "saved" && (
                <span className="ml-auto text-xs text-emerald-400">Saved</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right column — context sidebar */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <ContextSidebar context={context} />
      </div>
    </div>
  );
}
