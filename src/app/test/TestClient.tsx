"use client";

import { useState } from "react";
import Link from "next/link";

// ── Pre-filled example so you don't start with empty fields ─────
const EXAMPLE = {
  sender: "Jane Smith",
  senderEmail: "jane.smith@example-partner.com",
  subject: "Re: APN Navigate Onboarding — Acme Corp",
  body: `Hi Steven,

Just following up on our call yesterday regarding Acme Corp's APN Navigate enrollment. They've completed the technical review and are ready for the business review stage.

Key updates:
- Technical review: PASSED
- Business review: Scheduled for next Thursday (Feb 20)
- POC: Jane Smith, CTO

Also, are we still planning to attend the AWS Summit in Chicago? Would be great to set up a meeting with their team there.

Can you confirm the review panel availability?

Best,
Jane`,
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
  meta: { mode: string; contextStats: Record<string, number>; processingTimeMs: number };
}

interface LiveResponse {
  result: ClassificationResult | null;
  message: { id: string; engagement_id: string | null; pending_review: boolean };
  engagement: { id: string; name: string; status: string } | null;
  entityLinks: { source_type: string; target_type: string; relationship: string }[];
  meta: { processingTimeMs: number };
}

type ResultData =
  | { mode: "dry-run"; data: DryRunResponse }
  | { mode: "live"; data: LiveResponse };

// ── Component ───────────────────────────────────────────────────
export default function TestClient() {
  const [sender, setSender] = useState(EXAMPLE.sender);
  const [senderEmail, setSenderEmail] = useState(EXAMPLE.senderEmail);
  const [subject, setSubject] = useState(EXAMPLE.subject);
  const [body, setBody] = useState(EXAMPLE.body);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClassify(live: boolean) {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const endpoint = live ? "/api/classify/live-test" : "/api/classify/test";
      const payload = live
        ? { sender, senderEmail, subject, body }
        : { text: body, subject, sender, senderEmail };

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

      {/* Form */}
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sender Name" value={sender} onChange={setSender} />
          <Field
            label="Sender Email"
            value={senderEmail}
            onChange={setSenderEmail}
          />
        </div>
        <Field label="Subject" value={subject} onChange={setSubject} />
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
                      {item.assignee && <span>Assignee: {item.assignee}</span>}
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
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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
