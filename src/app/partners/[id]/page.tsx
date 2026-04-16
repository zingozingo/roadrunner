export const dynamic = "force-dynamic";

import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PillarBadge from "@/components/shared/PillarBadge";
import BrainSynthesis from "@/components/partners/BrainSynthesis";
import EnrollmentSection from "@/components/partners/EnrollmentSection";
import EventParticipationSection from "@/components/partners/EventParticipationSection";
import PartnerScratchpad from "@/components/partners/PartnerScratchpad";
import { cleanMeetingTitle, stripPartnerPrefix } from "@/lib/format-utils";
import {
  getPartner,
  getEngagementsByPartner,
  getMeetingsByPartner,
  getMeetingTitlesById,
  getEngagementNamesById,
  getMeetingNotesByPartner,
  getTasksByPartner,
  getPartnerContext,
  getContactsByPartner,
  getPartnerGoals,
  getPartnerProgramEnrollments,
  getPartnerEventParticipations,
  getPartnerMpoppFunding,
  getPartnerMdfFunding,
  getActivePrograms,
  getActiveEvents,
} from "@/lib/db";
import { getEngagementContributors } from "@/lib/db/participants";
import type { Engagement, Meeting } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "\u2014";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${Math.round(val / 1_000)}k`;
  return `$${Math.round(val)}`;
}

function shortDate(d: string | null): string {
  if (!d) return "\u2014";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await getPartner(id);
  if (!partner) notFound();

  const contacts = await getContactsByPartner(id);

  const [linkedEngagements, linkedMeetings] = await Promise.all([
    getEngagementsByPartner(id),
    getMeetingsByPartner(id),
  ]);

  const [
    partnerNotes,
    openTasks,
    partnerContextEntries,
    partnerGoals,
    programEnrollments,
    eventParticipations,
    mpoppFunding,
    mdfFunding,
    engagementContributors,
    allPrograms,
    allEvents,
  ] = await Promise.all([
    getMeetingNotesByPartner(id),
    getTasksByPartner(id, { status: "open" }),
    getPartnerContext(id),
    getPartnerGoals(id),
    getPartnerProgramEnrollments(id),
    getPartnerEventParticipations(id),
    getPartnerMpoppFunding(id),
    getPartnerMdfFunding(id),
    getEngagementContributors(id),
    getActivePrograms(),
    getActiveEvents(),
  ]);

  /* Condensed digests for meeting rows */
  const condensedByMeetingId = new Map<string, string>();
  for (const note of partnerNotes) {
    if (note.meeting_id && note.condensed) {
      condensedByMeetingId.set(note.meeting_id, note.condensed);
    }
  }

  /* Task context resolution */
  const noteMeetingMap = new Map<string, string | null>();
  for (const note of partnerNotes) {
    noteMeetingMap.set(note.id, note.meeting_id ?? null);
  }

  const taskMeetingIds = new Set<string>();
  for (const t of openTasks) {
    if (t.meeting_note_id) {
      const mid = noteMeetingMap.get(t.meeting_note_id);
      if (mid) taskMeetingIds.add(mid);
    }
  }
  const meetingTitleMap = taskMeetingIds.size > 0
    ? await getMeetingTitlesById([...taskMeetingIds])
    : new Map<string, string>();
  const taskEngIds = [
    ...new Set(
      openTasks
        .map((t) => t.engagement_id)
        .filter((x): x is string => x !== null)
    ),
  ];
  const engNameMap = await getEngagementNamesById(taskEngIds);
  const tasksWithContext = openTasks.map((t) => {
    const meetingId = t.meeting_note_id
      ? (noteMeetingMap.get(t.meeting_note_id) ?? null)
      : null;
    return {
      ...t,
      meeting_title: meetingId
        ? (meetingTitleMap.get(meetingId) ?? null)
        : null,
      engagement_name: t.engagement_id
        ? (engNameMap.get(t.engagement_id) ?? null)
        : null,
    };
  });

  /* Partner context split */
  const brainEntry =
    partnerContextEntries.find((e) => e.source === "ai_synthesis") ?? null;
  const scratchpadEntries = partnerContextEntries.filter(
    (e) => e.source === "scratchpad" || e.source === "seed_dump"
  );
  const scratchpadLastUpdated =
    scratchpadEntries.length > 0
      ? scratchpadEntries.reduce(
          (latest, e) => (e.created_at > latest ? e.created_at : latest),
          scratchpadEntries[0].created_at
        )
      : null;

  /* Root anchor_day map for shifted-occurrence detection in meeting rows */
  const rootAnchorDays = new Map<string, number>();
  for (const m of linkedMeetings) {
    if (m.id === m.series_id && m.anchor_day !== null && m.anchor_day !== undefined) {
      rootAnchorDays.set(m.id, m.anchor_day);
    }
  }
  function isMeetingShifted(m: Meeting): boolean {
    if (!m.series_id || !m.meeting_date) return false;
    const rootAnchor = rootAnchorDays.get(m.series_id);
    if (rootAnchor === undefined) return false;
    if (m.recurrence_pattern !== "weekly" && m.recurrence_pattern !== "biweekly") return false;
    return new Date(m.meeting_date + "T12:00:00").getDay() !== rootAnchor;
  }

  /* Recent meetings — last 90 days */
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentMeetings = linkedMeetings
    .filter(
      (m) => m.meeting_date && new Date(m.meeting_date + "T00:00:00") >= cutoff
    )
    .slice(0, 15);

  /* Financial data */
  const fin = {
    mp_tcv_ytd: partner.mp_tcv_ytd ?? null,
    mp_tcv_goal: partner.mp_tcv_goal ?? null,
    larr_ytd: partner.larr_ytd ?? null,
    larr_goal: partner.larr_goal ?? null,
    mp_tcv_2024: partner.mp_tcv_2024 ?? null,
    larr_2024: partner.larr_2024 ?? null,
    mp_tcv_2025: partner.mp_tcv_2025 ?? null,
    larr_2025: partner.larr_2025 ?? null,
    mp_tcv_target_2025: partner.mp_tcv_target_2025 ?? null,
    mp_tcv_projected_annual: partner.mp_tcv_projected_annual ?? null,
    larr_projected_annual: partner.larr_projected_annual ?? null,
  };
  const hasFinancials = Object.values(fin).some((v) => v !== null);

  function attPct(
    ytd: number | null,
    goal: number | null
  ): string | null {
    if (ytd === null || goal === null || goal <= 0) return null;
    return `${Math.round((ytd / goal) * 100)}%`;
  }

  /* Contacts grouped */
  const awsTeam = contacts.filter((c) => c.org_type === "internal");
  const partnerTeam = contacts.filter((c) => c.org_type === "partner");
  const thirdParties = contacts.filter((c) => c.org_type === "third_party");
  const hasPeople = awsTeam.length > 0 || partnerTeam.length > 0 || thirdParties.length > 0 || engagementContributors.totalPeople > 0;

  /* Owner label map */
  const ownerLabels: Record<string, { label: string; cls: string }> = {
    me: { label: "Me", cls: "bg-accent/10 text-accent" },
    internal: { label: "Internal", cls: "bg-status-blocked/10 text-status-blocked" },
    partner: { label: "Partner", cls: "bg-status-active/10 text-status-active" },
    third_party: { label: "3rd Party", cls: "bg-status-completed/10 text-status-completed" },
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <PageContainer>
      {/* Back link */}
      <Link
        href="/partners"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Partners
      </Link>

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">{partner.name}</h1>
        {partner.segment && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent/70">
            {partner.segment}
          </span>
        )}
        {partner.spms_id && (
          <span className="text-xs text-muted/60">SPMS {partner.spms_id}</span>
        )}
      </div>

      {/* ═══ SYNTHESIS ═══ */}
      <section className="mb-8">
        <BrainSynthesis
          partnerId={id}
          initialContent={brainEntry?.content ?? null}
          initialDate={brainEntry?.created_at ?? null}
          scratchpadLastUpdated={scratchpadLastUpdated}
        />
      </section>

      {/* ═══ CO-SELL PERFORMANCE ═══ */}
      {hasFinancials && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted/60">
            Co-Sell Performance
          </h2>
          <div className="rounded-lg border border-border/50 bg-surface p-4">
            <div className="grid grid-cols-2 gap-6">
              {/* MP TCV */}
              <div>
                <div className="text-xs text-muted mb-1">MP TCV</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {fmtCurrency(fin.mp_tcv_ytd)}
                  </span>
                  {fin.mp_tcv_goal !== null && (
                    <span className="text-xs text-muted">
                      / {fmtCurrency(fin.mp_tcv_goal)}
                    </span>
                  )}
                  {attPct(fin.mp_tcv_ytd, fin.mp_tcv_goal) && (
                    <span className="font-mono text-xs text-accent">
                      {attPct(fin.mp_tcv_ytd, fin.mp_tcv_goal)}
                    </span>
                  )}
                </div>
              </div>
              {/* LARR */}
              <div>
                <div className="text-xs text-muted mb-1">LARR</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {fmtCurrency(fin.larr_ytd)}
                  </span>
                  {fin.larr_goal !== null && (
                    <span className="text-xs text-muted">
                      / {fmtCurrency(fin.larr_goal)}
                    </span>
                  )}
                  {attPct(fin.larr_ytd, fin.larr_goal) && (
                    <span className="font-mono text-xs text-accent">
                      {attPct(fin.larr_ytd, fin.larr_goal)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Prior year + projections */}
            {(() => {
              const rows: { label: string; mp: number | null; larr: number | null }[] = [
                { label: "2025", mp: fin.mp_tcv_2025, larr: fin.larr_2025 },
                { label: "2024", mp: fin.mp_tcv_2024, larr: fin.larr_2024 },
              ].filter((r) => r.mp !== null || r.larr !== null);
              const hasProj = fin.mp_tcv_projected_annual !== null || fin.larr_projected_annual !== null;
              if (rows.length === 0 && !hasProj) return null;
              return (
                <div className="mt-4 border-t border-border/30 pt-3">
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-x-6 gap-y-1 text-xs">
                    <div className="text-muted/40" />
                    <div className="text-muted/40">MP TCV</div>
                    <div className="text-muted/40">LARR</div>
                    {rows.map((r) => (
                      <Fragment key={r.label}>
                        <div className="text-muted">{r.label}</div>
                        <div className="font-mono text-foreground/70">{fmtCurrency(r.mp)}</div>
                        <div className="font-mono text-foreground/70">{fmtCurrency(r.larr)}</div>
                      </Fragment>
                    ))}
                    {hasProj && (
                      <>
                        <div className="text-muted">Projected</div>
                        <div className="font-mono text-foreground/70">{fmtCurrency(fin.mp_tcv_projected_annual)}</div>
                        <div className="font-mono text-foreground/70">{fmtCurrency(fin.larr_projected_annual)}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ═══ BELOW THE FOLD — Progressive sections ═══ */}
      <div className="space-y-6">
        {/* Active Engagements */}
        {linkedEngagements.length > 0 && (
          <Section title="Engagements" count={linkedEngagements.length}>
            {linkedEngagements.slice(0, 8).map((eng) => {
              const preview = eng.condensed
                ? eng.condensed.split("\n").filter(Boolean).slice(0, 2).join(" \u00b7 ")
                : eng.topic ?? null;
              return (
                <Link
                  key={eng.id}
                  href={`/engagements/${eng.id}`}
                  className="flex items-start gap-3 border-b border-border/30 px-4 py-3 transition-colors hover:bg-surface-hover last:border-b-0"
                >
                  <StatusDot status={eng.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {eng.name}
                      </span>
                      {eng.pillar && <PillarBadge pillar={eng.pillar} />}
                    </div>
                    {preview && (
                      <p className="mt-0.5 text-xs text-muted truncate">{preview}</p>
                    )}
                  </div>
                </Link>
              );
            })}
            {linkedEngagements.length > 8 && (
              <div className="px-4 py-2 text-xs text-muted">
                +{linkedEngagements.length - 8} more
              </div>
            )}
          </Section>
        )}

        {/* Open Tasks */}
        {tasksWithContext.length > 0 && (
          <Section title="Open Tasks" count={tasksWithContext.length} viewAllHref="/tasks">
            {tasksWithContext.slice(0, 6).map((t) => {
              const owner = ownerLabels[t.owner] ?? ownerLabels.me;
              const ctx = t.engagement_name ?? (t.meeting_title ? stripPartnerPrefix(t.meeting_title, partner.name) : null);
              return (
                <div key={t.id} className="border-b border-border/30 px-4 py-2.5 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className={`min-w-0 flex-1 truncate text-sm ${t.owner === "me" ? "text-foreground/80" : "text-muted"}`}>
                      {t.description}
                    </span>
                    {t.due_date && (
                      <span className="shrink-0 text-[11px] text-muted">{shortDate(t.due_date)}</span>
                    )}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${owner.cls}`}>
                      {owner.label}
                    </span>
                  </div>
                  {ctx && <span className="mt-0.5 block text-[11px] text-muted/40 truncate">{ctx}</span>}
                </div>
              );
            })}
          </Section>
        )}

        {/* Recent Meetings */}
        {recentMeetings.length > 0 && (
          <Section title="Recent Meetings" count={recentMeetings.length}>
            {recentMeetings.slice(0, 8).map((m) => {
              const firstLine = condensedByMeetingId.get(m.id)?.split("\n").find((l) => l.trim()) ?? null;
              const shifted = isMeetingShifted(m);
              return (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="flex items-start gap-3 border-b border-border/30 px-4 py-2.5 transition-colors hover:bg-surface-hover last:border-b-0"
                >
                  <span className={`w-16 shrink-0 pt-0.5 text-xs ${shifted ? "text-status-blocked/70" : "text-muted"}`} title={shifted ? "Rescheduled from regular day" : undefined}>{shortDate(m.meeting_date)}</span>
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm text-foreground/80 truncate">
                      {(m.recurrence_pattern || m.series_id) && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/70 shrink-0">
                          <path d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" />
                          <path d="M14 2v4h-4M2 14v-4h4" />
                        </svg>
                      )}
                      {cleanMeetingTitle(m.title)}
                    </span>
                    {firstLine && (
                      <span className="mt-0.5 text-xs text-muted/60 truncate block">{firstLine}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </Section>
        )}

        {/* Program Enrollments + Strategic Goals — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="min-w-0">
            <EnrollmentSection
              partnerId={id}
              initialEnrollments={programEnrollments.map((e) => ({
                id: e.id,
                partner_id: e.partner_id,
                program_id: e.program_id,
                program_name: e.program_name ?? null,
                status: e.status,
                date_achieved: e.date_achieved,
                notes: e.notes,
                program_category: (e as unknown as Record<string, unknown>).program_category as string | null ?? null,
                program_mdf_value: (e as unknown as Record<string, unknown>).program_mdf_value as number | null ?? null,
              }))}
              programs={allPrograms.map((p) => ({ id: p.id, name: p.name }))}
            />
          </section>

          <Section title="Strategic Goals" count={partnerGoals.length}>
            {partnerGoals.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted/60">
                No strategic goals set
              </div>
            ) : (
              partnerGoals.map((g) => (
                <div key={g.id} className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 last:border-b-0">
                  <span className="min-w-0 flex-1 text-sm text-foreground/80">{g.goal}</span>
                  {g.category && (
                    <span className="shrink-0 rounded-full bg-accent/8 px-2 py-0.5 text-[11px] font-medium text-accent/70">
                      {g.category.replace(/_/g, " ")}
                    </span>
                  )}
                  {g.status && (
                    <span className={`shrink-0 text-[11px] ${
                      g.status === "in_progress" ? "text-status-active" :
                      g.status === "completed" ? "text-status-completed" :
                      g.status === "deferred" ? "text-status-blocked" :
                      "text-muted"
                    }`}>
                      {g.status === "in_progress" ? "Active" :
                       g.status === "not_started" ? "Planned" :
                       g.status === "completed" ? "Done" :
                       g.status === "deferred" ? "Blocked" : g.status}
                    </span>
                  )}
                </div>
              ))
            )}
          </Section>
        </div>

        {/* Funding + Event Participations — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(mpoppFunding.length > 0 || mdfFunding.length > 0) && (
          <Section title="Funding" count={mpoppFunding.length + mdfFunding.length}>
            {mpoppFunding.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/40">MPOPP</div>
                {mpoppFunding.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 border-b border-border/30 px-4 py-2.5 last:border-b-0">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {f.status && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${f.status?.toLowerCase() === "approved" ? "bg-status-active/10 text-status-active" : "bg-status-blocked/10 text-status-blocked"}`}>
                          {f.status}
                        </span>
                      )}
                      {f.half && <span className="shrink-0 text-[11px] text-muted">{f.half.toUpperCase()}</span>}
                      <span className="min-w-0 truncate text-sm text-foreground/80">{f.track ?? "\u2014"}</span>
                    </div>
                    {f.allocated != null ? (
                      <span className="shrink-0 font-mono text-[11px] text-muted">
                        Allocated: {fmtCurrency(f.allocated)}
                        {" \u00b7 "}Spent: {fmtCurrency(f.spent ?? 0)}
                        {" \u00b7 "}<span className={`font-medium ${(f.allocated - (f.spent ?? 0)) > 0 ? "text-status-active" : "text-muted"}`}>Remaining: {fmtCurrency(f.allocated - (f.spent ?? 0))}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] text-muted">No allocation</span>
                    )}
                  </div>
                ))}
              </>
            )}
            {mdfFunding.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/40">MDF</div>
                {mdfFunding.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 border-b border-border/30 px-4 py-2.5 last:border-b-0">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="min-w-0 truncate text-sm text-foreground/80">{f.record_name ?? "\u2014"}</span>
                      {f.source && (
                        <span className="shrink-0 rounded-full bg-muted/15 px-2 py-0.5 text-[11px] font-medium text-muted">
                          {f.source === "competency_service_ready" ? "Competency/SR" : "Custom"}
                        </span>
                      )}
                      {f.recurrence && (
                        <span className="shrink-0 rounded-full bg-muted/15 px-2 py-0.5 text-[11px] font-medium text-muted">
                          {f.recurrence === "reloads_next_year" ? "Reloads" : "One-Time"}
                        </span>
                      )}
                    </div>
                    {f.allocated != null ? (
                      <span className="shrink-0 font-mono text-[11px] text-muted">
                        Allocated: {fmtCurrency(f.allocated)}
                        {" \u00b7 "}Spent: {fmtCurrency(f.utilized ?? 0)}
                        {" \u00b7 "}<span className={`font-medium ${(f.allocated - (f.utilized ?? 0)) > 0 ? "text-status-active" : "text-muted"}`}>Remaining: {fmtCurrency(f.allocated - (f.utilized ?? 0))}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] text-muted">No allocation</span>
                    )}
                  </div>
                ))}
              </>
            )}
          </Section>
        )}

        {/* Event Participations (interactive — always shown, even when empty) */}
        <section className="min-w-0">
          <EventParticipationSection
            partnerId={id}
            initialParticipations={eventParticipations.map((e) => ({
              id: e.id,
              partner_id: e.partner_id,
              event_id: e.event_id,
              status: e.status,
              sponsoring: e.sponsoring ?? false,
              notes: e.notes,
              event_name: e.event_name,
              event_start_date: e.event_start_date,
            }))}
            events={allEvents.map((e) => ({ id: e.id, name: e.name, start_date: e.start_date }))}
          />
        </section>
        </div>

        {/* People */}
        {hasPeople && (
          <Section title="People">
            {awsTeam.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/40">AWS Team</div>
                {awsTeam.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border/30 px-4 py-2 last:border-b-0">
                    <Link href={`/people?q=${encodeURIComponent(c.name ?? c.email ?? "")}`} className="text-sm text-foreground/80 hover:text-accent transition-colors">{c.name ?? c.email}</Link>
                    {c.role && <span className="text-[11px] text-muted">{c.role}</span>}
                    {c.email && c.name && <span className="text-[11px] text-muted/40">{c.email}</span>}
                  </div>
                ))}
              </>
            )}
            {partnerTeam.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/40">Partner Team</div>
                {partnerTeam.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border/30 px-4 py-2 last:border-b-0">
                    <Link href={`/people?q=${encodeURIComponent(c.name ?? c.email ?? "")}`} className="text-sm text-foreground/80 hover:text-accent transition-colors">{c.name ?? c.email}</Link>
                    {c.role && <span className="text-[11px] text-muted">{c.role}</span>}
                    {c.email && c.name && <span className="text-[11px] text-muted/40">{c.email}</span>}
                  </div>
                ))}
              </>
            )}
            {thirdParties.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted/40">Third Parties</div>
                {thirdParties.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border/30 px-4 py-2 last:border-b-0">
                    <Link href={`/people?q=${encodeURIComponent(c.name ?? c.email ?? "")}`} className="text-sm text-foreground/80 hover:text-accent transition-colors">{c.name ?? c.email}</Link>
                    {c.role && <span className="text-[11px] text-muted">{c.role}</span>}
                    {c.email && c.name && <span className="text-[11px] text-muted/40">{c.email}</span>}
                  </div>
                ))}
              </>
            )}
            {engagementContributors.totalPeople > 0 && (
              <details className="border-t border-border/30">
                <summary className="cursor-pointer select-none px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted/40 hover:text-muted/60 transition-colors">
                  Engagement Contributors ({engagementContributors.totalPeople} people across {engagementContributors.groups.length} engagement{engagementContributors.groups.length !== 1 ? "s" : ""})
                </summary>
                <div className="px-4 pb-3">
                  {engagementContributors.groups.map((group) => (
                    <div key={group.engagement_id} className="mt-3 first:mt-1">
                      <div className="text-[11px] font-medium text-muted/50 mb-1">{group.engagement_name}</div>
                      {group.contributors.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-1">
                          <Link href={`/people?q=${encodeURIComponent(c.name ?? c.email ?? "")}`} className="text-sm text-foreground/70 hover:text-accent transition-colors">{c.name ?? c.email}</Link>
                          {c.org_type && (
                            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                              c.org_type === "internal"
                                ? "bg-accent/10 text-accent"
                                : c.org_type === "partner"
                                ? "bg-status-active/10 text-status-active"
                                : "bg-status-completed/10 text-status-completed"
                            }`}>
                              {c.org_type === "internal" ? "AWS" : c.org_type === "partner" ? "Partner" : "3rd Party"}
                            </span>
                          )}
                          {c.email && c.name && <span className="text-[11px] text-muted/40">{c.email}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Section>
        )}

        {/* Solution Profile + Operational Status — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(partner.what_they_do || partner.joint_value_proposition || partner.architecture) && (
          <Section title="Solution Profile">
            <div className="space-y-3 px-4 py-3">
              {partner.what_they_do && (
                <div>
                  <div className="text-[11px] font-medium text-muted/60 mb-0.5">What They Do</div>
                  <p className="text-sm text-foreground/70">{partner.what_they_do}</p>
                </div>
              )}
              {partner.joint_value_proposition && (
                <div>
                  <div className="text-[11px] font-medium text-muted/60 mb-0.5">Joint Value Proposition</div>
                  <p className="text-sm text-foreground/70">{partner.joint_value_proposition}</p>
                </div>
              )}
              {partner.architecture && (
                <div>
                  <div className="text-[11px] font-medium text-muted/60 mb-0.5">Architecture</div>
                  <p className="text-sm text-foreground/70">{partner.architecture}</p>
                </div>
              )}
              {partner.listing_types && partner.listing_types.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-muted/60 mb-0.5">Listing Types</div>
                  <p className="text-sm text-foreground/70">{partner.listing_types.join(", ")}</p>
                </div>
              )}
              {partner.pricing_model && partner.pricing_model.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-muted/60 mb-0.5">Pricing Model</div>
                  <p className="text-sm text-foreground/70">{partner.pricing_model.join(", ")}</p>
                </div>
              )}
              {partner.aws_stickiness && (
                <div>
                  <div className="text-[11px] font-medium text-muted/60 mb-0.5">AWS Stickiness</div>
                  <p className="text-sm text-foreground/70">{partner.aws_stickiness}</p>
                </div>
              )}
              {partner.key_aws_services.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-muted/60 mb-0.5">Key AWS Services</div>
                  <p className="text-sm text-foreground/70">{partner.key_aws_services.join(", ")}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Operational Status */}
        {(partner.isva_status || partner.deployed_on_aws || partner.prm_status || partner.crm_platform) && (
          <Section title="Operational Status">
            <div className="grid grid-cols-2 gap-3 px-4 py-3">
              {partner.isva_status && (
                <div>
                  <div className="text-[11px] text-muted/60">ISVa Status</div>
                  <div className="text-sm text-foreground/70">{partner.isva_status}</div>
                </div>
              )}
              {partner.deployed_on_aws && (
                <div>
                  <div className="text-[11px] text-muted/60">Deployed on AWS</div>
                  <div className="text-sm text-foreground/70">{partner.deployed_on_aws}</div>
                </div>
              )}
              {partner.prm_status && (
                <div>
                  <div className="text-[11px] text-muted/60">PRM Status</div>
                  <div className="text-sm text-foreground/70">{partner.prm_status}</div>
                </div>
              )}
              {partner.crm_platform && (
                <div>
                  <div className="text-[11px] text-muted/60">CRM Platform</div>
                  <div className="text-sm text-foreground/70">{partner.crm_platform}</div>
                </div>
              )}
              {partner.crm_notes && (
                <div className="col-span-2">
                  <div className="text-[11px] text-muted/60">CRM Notes</div>
                  <div className="text-sm text-foreground/70">{partner.crm_notes}</div>
                </div>
              )}
            </div>
          </Section>
        )}
        </div>

        {/* Scratchpad — always at bottom */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted/60">
            Scratchpad
          </h2>
          <div className="rounded-lg border border-border/50 bg-surface p-4">
            <PartnerScratchpad partnerId={id} initialEntries={scratchpadEntries} compact />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function Section({
  title,
  count,
  viewAllHref,
  children,
}: {
  title: string;
  count?: number;
  viewAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted/60">
            {title}
          </h2>
          {count !== undefined && count > 0 && (
            <span className="text-xs text-muted/40">{count}</span>
          )}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-xs text-muted hover:text-foreground transition-colors">
            View all
          </Link>
        )}
      </div>
      <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-status-active",
    planned: "bg-accent",
    blocked: "bg-status-blocked",
    completed: "bg-status-completed",
    archived: "bg-status-archived",
  };
  return (
    <span
      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colors[status] ?? "bg-muted"}`}
      title={status}
    />
  );
}
