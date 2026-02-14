"use client";

import { useState } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";

// ── Pre-filled example ──────────────────────────────────────────
const DEFAULTS = {
  forwarderName: "Steven Romero",
  forwarderEmail: "sterme@amazon.com",
  fromName: "Tanya Green",
  fromEmail: "tanya.green@qualys.com",
  to: "Steven Romero <sterme@amazon.com>",
  cc: "",
  subject: "AWS Summit New York - EC2 Image Builder Convo",
  date: new Date().toISOString().slice(0, 16), // datetime-local format
  body: `Hi Steven,

I wanted to reach out about our EC2 Image Builder integration discussions. We're interested in attending AWS Summit New York 2026 to continue the conversation with your team.

Can you help me understand what preparation steps we should take from a partner perspective?

Thanks,
Tanya Green
Sr. Cloud Architect, Qualys`,
};

// ── Types for the API responses ─────────────────────────────────
interface EngagementMatch {
  id: string | null;
  name: string;
  confidence: number;
  is_new: boolean;
  partner_name: string | null;
}

interface MatchedEntity {
  id: string;
  name: string;
  relationship: string;
}

interface OpenItem {
  description: string;
  assignee: string | null;
  due_date: string | null;
}

interface Participant {
  name: string;
  email: string | null;
  organization: string | null;
  role: string | null;
}

interface ClassificationResult {
  content_type: string | null;
  engagement_match: EngagementMatch;
  matched_events: MatchedEntity[];
  matched_programs: MatchedEntity[];
  current_state: string | null;
  open_items: OpenItem[];
  suggested_tags: string[];
  participants: Participant[];
}

interface DryRunResponse {
  result: ClassificationResult;
  meta: {
    mode: string;
    contextStats: Record<string, number>;
    processingTimeMs: number;
  };
}

interface LiveResponse {
  result: ClassificationResult | null;
  message: {
    id: string;
    engagement_id: string | null;
    pending_review: boolean;
  };
  engagement: { id: string; name: string; status: string } | null;
  entityLinks: {
    source_type: string;
    target_type: string;
    relationship: string;
  }[];
  meta: { processingTimeMs: number };
}

type ResultData =
  | { mode: "dry-run"; data: DryRunResponse }
  | { mode: "live"; data: LiveResponse };

// ── Component ───────────────────────────────────────────────────
export default function TestClient() {
  // Forwarder (PDM)
  const [forwarderName, setForwarderName] = useState(DEFAULTS.forwarderName);
  const [forwarderEmail, setForwarderEmail] = useState(
    DEFAULTS.forwarderEmail
  );
  const [forwarderOpen, setForwarderOpen] = useState(false);

  // Original email
  const [fromName, setFromName] = useState(DEFAULTS.fromName);
  const [fromEmail, setFromEmail] = useState(DEFAULTS.fromEmail);
  const [to, setTo] = useState(DEFAULTS.to);
  const [cc, setCc] = useState(DEFAULTS.cc);
  const [subject, setSubject] = useState(DEFAULTS.subject);
  const [date, setDate] = useState(DEFAULTS.date);
  const [body, setBody] = useState(DEFAULTS.body);

  // State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cleanup state
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<Record<string, number> | null>(null);

  async function handleClassify(live: boolean) {
    setLoading(true);
    setResult(null);
    setError(null);

    const payload = {
      forwarderName,
      forwarderEmail,
      fromName,
      fromEmail,
      to: to || undefined,
      cc: cc || undefined,
      subject,
      date: date ? new Date(date).toISOString() : undefined,
      ...(live ? { body } : { text: body }),
    };

    try {
      const endpoint = live ? "/api/classify/live-test" : "/api/classify/test";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }

      setResult(live ? { mode: "live", data } : { mode: "dry-run", data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanup() {
    setShowCleanupConfirm(false);
    setCleaning(true);
    setCleanupResult(null);
    setError(null);
    try {
      const res = await fetch("/api/classify/test-cleanup", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setCleanupResult(data.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  }

  const classification: ClassificationResult | null =
    result?.mode === "dry-run"
      ? result.data.result
      : result?.mode === "live"
        ? result.data.result
        : null;

  const processingTime =
    result?.mode === "dry-run"
      ? result.data.meta.processingTimeMs
      : result?.mode === "live"
        ? result.data.meta.processingTimeMs
        : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Classification Test
        </h1>
        <p className="mt-1 text-sm text-muted">
          Test how Claude classifies email content. Dry run has zero side
          effects. Live test stores and processes through the full pipeline.
        </p>
      </div>

      {/* Forwarder section (collapsible) */}
      <div className="rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setForwarderOpen(!forwarderOpen)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              PDM / Forwarder (you)
            </span>
            <span className="text-xs text-muted">
              {forwarderName} &lt;{forwarderEmail}&gt;
            </span>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`text-muted transition-transform ${forwarderOpen ? "rotate-180" : ""}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        {forwarderOpen && (
          <div className="border-t border-border px-5 pb-4 pt-3">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Name"
                value={forwarderName}
                onChange={setForwarderName}
              />
              <Field
                label="Email"
                value={forwarderEmail}
                onChange={setForwarderEmail}
              />
            </div>
          </div>
        )}
      </div>

      {/* Original email section */}
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Original Email
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="From Name" value={fromName} onChange={setFromName} />
          <Field label="From Email" value={fromEmail} onChange={setFromEmail} />
        </div>

        <Field
          label="To"
          value={to}
          onChange={setTo}
          placeholder='e.g. Steven Romero <sterme@amazon.com>, CJ Martinez <cj@amazon.com>'
        />
        <Field
          label="CC"
          value={cc}
          onChange={setCc}
          placeholder="(optional)"
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Subject" value={subject} onChange={setSubject} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Date
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleClassify(false)}
            disabled={loading || !body.trim()}
            className="rounded-lg bg-surface-hover px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border disabled:opacity-40"
          >
            {loading ? "Classifying..." : "Classify Only"}
          </button>
          <button
            onClick={() => handleClassify(true)}
            disabled={loading || !body.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {loading ? "Classifying..." : "Classify & Save"}
          </button>
          {loading && (
            <span className="text-xs text-muted animate-pulse">
              Waiting for Claude...
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && classification && (
        <div className="space-y-4">
          {/* Mode Banner */}
          {result.mode === "dry-run" ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
              DRY RUN — nothing saved
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
              SAVED — message stored and classified through full pipeline
            </div>
          )}

          {/* Processing time */}
          {processingTime != null && (
            <p className="text-xs text-muted">
              Processed in {(processingTime / 1000).toFixed(1)}s
            </p>
          )}

          {/* Engagement Match */}
          <ResultSection title="Engagement Match">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <KV label="Name" value={classification.engagement_match.name} />
              <KV
                label="Confidence"
                value={
                  <ConfidencePill
                    value={classification.engagement_match.confidence}
                  />
                }
              />
              <KV
                label="New?"
                value={classification.engagement_match.is_new ? "Yes" : "No"}
              />
              <KV
                label="Partner"
                value={classification.engagement_match.partner_name}
              />
              <KV
                label="Content Type"
                value={classification.content_type}
              />
            </div>

            {/* Live-test extras */}
            {result.mode === "live" && result.data.engagement && (
              <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                <span className="text-xs text-muted">
                  Engagement:{" "}
                  <span className="text-foreground">
                    {result.data.engagement.name}
                  </span>
                </span>
                <Link
                  href={`/engagements/${result.data.engagement.id}`}
                  className="text-xs font-medium text-accent hover:text-accent-hover"
                >
                  View engagement &rarr;
                </Link>
              </div>
            )}
            {result.mode === "live" && result.data.message.pending_review && (
              <p className="mt-2 text-xs text-amber-400">
                Flagged for review (below confidence threshold)
              </p>
            )}
          </ResultSection>

          {/* Matched Events */}
          {classification.matched_events.length > 0 && (
            <ResultSection title="Matched Events">
              <ul className="space-y-1 text-sm">
                {classification.matched_events.map((e, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-foreground">{e.name}</span>
                    <span className="text-xs text-muted">
                      ({e.relationship})
                    </span>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {/* Matched Programs */}
          {classification.matched_programs.length > 0 && (
            <ResultSection title="Matched Programs">
              <ul className="space-y-1 text-sm">
                {classification.matched_programs.map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-foreground">{p.name}</span>
                    <span className="text-xs text-muted">
                      ({p.relationship})
                    </span>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {/* Current State */}
          {classification.current_state && (
            <ResultSection title="Current State">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {classification.current_state}
              </p>
            </ResultSection>
          )}

          {/* Open Items */}
          {classification.open_items.length > 0 && (
            <ResultSection title="Open Items">
              <ul className="space-y-2">
                {classification.open_items.map((item, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <p className="text-foreground">{item.description}</p>
                    <div className="mt-1 flex gap-4 text-xs text-muted">
                      {item.assignee && (
                        <span>Assignee: {item.assignee}</span>
                      )}
                      {item.due_date && <span>Due: {item.due_date}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {/* Tags */}
          {classification.suggested_tags.length > 0 && (
            <ResultSection title="Suggested Tags">
              <div className="flex flex-wrap gap-2">
                {classification.suggested_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </ResultSection>
          )}

          {/* Participants */}
          {classification.participants.length > 0 && (
            <ResultSection title="Participants">
              <ul className="space-y-2">
                {classification.participants.map((p, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-foreground">{p.name}</span>
                    {p.email && (
                      <span className="ml-2 text-xs text-muted">
                        {p.email}
                      </span>
                    )}
                    {p.organization && (
                      <span className="ml-2 text-xs text-muted">
                        @ {p.organization}
                      </span>
                    )}
                    {p.role && (
                      <span className="ml-2 text-xs text-accent">
                        {p.role}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {/* Live-test persistence summary */}
          {result.mode === "live" && (
            <ResultSection title="Persistence Summary">
              <ul className="space-y-1 text-sm text-muted">
                <li>
                  Message stored:{" "}
                  <code className="text-foreground text-xs">
                    {result.data.message.id}
                  </code>
                </li>
                <li>
                  Engagement:{" "}
                  <span className="text-foreground">
                    {result.data.engagement
                      ? `${result.data.engagement.name} (${result.data.message.pending_review ? "pending review" : "assigned"})`
                      : "none (noise or pending review)"}
                  </span>
                </li>
                <li>
                  Entity links created:{" "}
                  <span className="text-foreground">
                    {result.data.entityLinks.length}
                  </span>
                </li>
              </ul>
            </ResultSection>
          )}
        </div>
      )}

      {/* Clear Test Data */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Data Cleanup
        </h2>
        <p className="mt-2 text-sm text-muted">
          Remove all engagements, messages, and participants. Events and
          programs (seed data) are preserved. This cannot be undone.
        </p>
        <button
          onClick={() => setShowCleanupConfirm(true)}
          disabled={cleaning}
          className="mt-3 rounded-lg border border-red-500/40 bg-background px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
        >
          {cleaning ? "Clearing..." : "Clear All Data"}
        </button>

        {cleanupResult && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-emerald-400">Cleanup complete</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {Object.entries(cleanupResult).map(([table, count]) => (
                <li key={table}>
                  {table}: <span className="text-foreground">{count}</span> deleted
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Cleanup confirmation dialog */}
      <ConfirmDialog
        isOpen={showCleanupConfirm}
        onConfirm={handleCleanup}
        onCancel={() => setShowCleanupConfirm(false)}
        title="Clear All Data"
        message="This will permanently delete all engagements, messages, participants, notes, and approval queue items. Only events and programs (seed data) are preserved. This cannot be undone."
        confirmLabel="Clear Everything"
        confirmStyle="danger"
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

function KV({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | string | null;
}) {
  return (
    <div>
      <span className="text-muted">{label}: </span>
      <span className="text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.85
      ? "text-confidence-high"
      : value >= 0.5
        ? "text-confidence-medium"
        : "text-confidence-low";

  return <span className={`font-mono font-semibold ${color}`}>{pct}%</span>;
}
