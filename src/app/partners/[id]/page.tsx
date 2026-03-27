export const dynamic = "force-dynamic";

import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PillarBadge from "@/components/shared/PillarBadge";
import BrainSynthesis from "@/components/partners/BrainSynthesis";
import PartnerScratchpad from "@/components/partners/PartnerScratchpad";
import { cleanMeetingTitle, stripPartnerPrefix } from "@/lib/format-utils";
import { getPartner, getSupabaseClient, getRelationshipsByPartner, getMeetingNotesByPartner, getTasksByPartner, getPartnerContext, getContactsByPartner, getContactsByRelationshipBulk, getPartnerGoals, getPartnerProgramEnrollments, getPartnerEventParticipations, getPartnerMpoppFunding, getPartnerMdfFunding } from "@/lib/db";
import PartnerReferencePanel from "@/components/partners/PartnerReferencePanel";
import { USER_CONFIG } from "@/lib/user-config";
import type { Engagement, Meeting, MeetingNoteWithTasks } from "@/lib/types";

// Currency formatting helper
function fmtCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${Math.round(val / 1_000)}k`;
  return `$${Math.round(val)}`;
}

// Status dot color map
const statusDotColor: Record<string, string> = {
  active: "bg-emerald-500",
  planned: "bg-blue-400",
  blocked: "bg-amber-500",
  completed: "bg-violet-500",
  archived: "bg-zinc-500",
};

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const partner = await getPartner(id);
  if (!partner) notFound();

  // Extract role contacts from canonical participants registry
  const contacts = await getContactsByPartner(id);

  const db = getSupabaseClient();

  // Fetch by partner_id FK
  const [{ data: engagements }, { data: meetings }] = await Promise.all([
    db
      .from("engagements")
      .select("*")
      .eq("partner_id", id)
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false }),
    db
      .from("meetings")
      .select("*")
      .eq("partner_id", id)
      .order("meeting_date", { ascending: false, nullsFirst: false }),
  ]);

  const linkedEngagements = (engagements ?? []) as Engagement[];
  const linkedMeetings = (meetings ?? []) as Meeting[];

  const [linkedRelationships, partnerNotes, openTasks, partnerContextEntries, partnerGoals, programEnrollments, eventParticipations, mpoppFunding, mdfFunding] = await Promise.all([
    getRelationshipsByPartner(id),
    getMeetingNotesByPartner(id),
    getTasksByPartner(id, { status: "open" }),
    getPartnerContext(id),
    getPartnerGoals(id),
    getPartnerProgramEnrollments(id),
    getPartnerEventParticipations(id),
    getPartnerMpoppFunding(id),
    getPartnerMdfFunding(id),
  ]);

  // Bulk-fetch relationship contacts and pre-compute lead names for slide-over panel
  const relContactsMap = await getContactsByRelationshipBulk(
    linkedRelationships.map((r) => r.id)
  );
  const relationshipsWithLeads = linkedRelationships.map((rel) => ({
    id: rel.id,
    name: rel.name,
    leadName: relContactsMap.get(rel.id)?.find(c => c.role === 'Lead Contact')?.name || relContactsMap.get(rel.id)?.[0]?.name || null,
  }));

  // Build condensed digest map for meeting rows
  const condensedByMeetingId = new Map<string, string>();
  for (const note of partnerNotes) {
    if (note.meeting_id && note.condensed) {
      condensedByMeetingId.set(note.meeting_id, note.condensed);
    }
  }

  // Build note → meeting resolution for tasks
  const noteMeetingMap = new Map<string, string | null>();
  for (const note of partnerNotes) {
    noteMeetingMap.set(note.id, note.meeting_id ?? null);
  }

  // Resolve meeting titles for tasks
  const taskMeetingIds = new Set<string>();
  for (const t of openTasks) {
    if (t.meeting_note_id) {
      const mid = noteMeetingMap.get(t.meeting_note_id);
      if (mid) taskMeetingIds.add(mid);
    }
  }
  const meetingTitleMap = new Map<string, string>();
  if (taskMeetingIds.size > 0) {
    const { data: mtgRows } = await db.from("meetings").select("id, title").in("id", [...taskMeetingIds]);
    for (const m of (mtgRows ?? []) as { id: string; title: string | null }[]) {
      meetingTitleMap.set(m.id, m.title ?? "Untitled");
    }
  }

  // Resolve engagement names for tasks
  const taskEngIds = [...new Set(openTasks.map(t => t.engagement_id).filter((id): id is string => id !== null))];
  const engNameMap = new Map<string, string>();
  if (taskEngIds.length > 0) {
    const { data: engRows } = await db.from("engagements").select("id, name").in("id", taskEngIds);
    for (const e of (engRows ?? []) as { id: string; name: string | null }[]) {
      engNameMap.set(e.id, e.name ?? "Untitled");
    }
  }

  const tasksWithContext = openTasks.map((t) => {
    const meetingId = t.meeting_note_id ? noteMeetingMap.get(t.meeting_note_id) ?? null : null;
    return {
      ...t,
      meeting_title: meetingId ? meetingTitleMap.get(meetingId) ?? null : null,
      engagement_name: t.engagement_id ? engNameMap.get(t.engagement_id) ?? null : null,
    };
  });

  // Split partner context: brain synthesis vs scratchpad entries
  const brainEntry = partnerContextEntries.find((e) => e.source === "ai_synthesis") ?? null;
  const scratchpadEntries = partnerContextEntries.filter(
    (e) => e.source === "scratchpad" || e.source === "seed_dump"
  );
  const scratchpadLastUpdated = scratchpadEntries.length > 0
    ? scratchpadEntries.reduce((latest, e) => e.created_at > latest ? e.created_at : latest, scratchpadEntries[0].created_at)
    : null;

  // Owner label map for inline task display
  const ownerLabels: Record<string, { label: string; color: string }> = {
    me: { label: "Me", color: "bg-accent/10 text-accent" },
    internal: { label: "Internal", color: "bg-amber-500/10 text-amber-400" },
    partner: { label: "Partner", color: "bg-emerald-500/10 text-emerald-400" },
    third_party: { label: "3rd Party", color: "bg-purple-500/10 text-purple-400" },
  };

  // Recent meetings — last 90 days + upcoming
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentMeetings = linkedMeetings.filter((m) => {
    if (!m.meeting_date) return false;
    const d = new Date(m.meeting_date + "T00:00:00");
    return d >= cutoff;
  }).slice(0, 15);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <Link
        href="/partners"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Partners
      </Link>

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
        <h1 className="text-2xl font-semibold text-foreground">{partner.name}</h1>
        {partner.segment && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent capitalize">
            {partner.segment}
          </span>
        )}
        {partner.spms_id && (
          <span className="text-sm text-muted ml-1">SPMS {partner.spms_id}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <PartnerReferencePanel
            partner={{
              what_they_do: partner.what_they_do,
              aws_stickiness: partner.aws_stickiness,
              key_aws_services: partner.key_aws_services,
              architecture: partner.architecture ?? null,
              listing_types: partner.listing_types ?? null,
              pricing_model: partner.pricing_model ?? null,
              isva_status: partner.isva_status ?? null,
              deployed_on_aws: partner.deployed_on_aws ?? null,
              prm_status: partner.prm_status ?? null,
              crm_platform: partner.crm_platform ?? null,
            }}
            contacts={contacts}
            currentUserEmail={USER_CONFIG.email}
            relationships={relationshipsWithLeads}
          />
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="space-y-10">

          {/* Brain Synthesis */}
          <section>
            <BrainSynthesis
              partnerId={id}
              initialContent={brainEntry?.content ?? null}
              initialDate={brainEntry?.created_at ?? null}
              scratchpadLastUpdated={scratchpadLastUpdated}
            />
          </section>

          {/* Scratchpad */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Scratchpad
              {scratchpadEntries.length > 0 && (
                <span className="ml-1.5 font-normal text-muted">{scratchpadEntries.length}</span>
              )}
            </h2>
            <div className="rounded-lg border border-border/20 bg-surface/50 p-4">
              <PartnerScratchpad partnerId={id} initialEntries={scratchpadEntries} compact />
            </div>
          </section>

          {/* Co-Sell Performance */}
          {(() => {
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
            const hasAny = Object.values(fin).some((v) => v !== null);
            if (!hasAny) return null;

            function attainmentPct(ytd: number | null, goal: number | null): string | null {
              if (ytd === null || goal === null || goal <= 0) return null;
              return `${Math.round((ytd / goal) * 100)}%`;
            }

            const mpAttain = attainmentPct(fin.mp_tcv_ytd, fin.mp_tcv_goal);
            const larrAttain = attainmentPct(fin.larr_ytd, fin.larr_goal);

            const priorRows: { label: string; mp: number | null; larr: number | null }[] = [
              { label: "2025 Actuals", mp: fin.mp_tcv_2025, larr: fin.larr_2025 },
              { label: "2024 Actuals", mp: fin.mp_tcv_2024, larr: fin.larr_2024 },
            ];
            const hasPrior = priorRows.some((r) => r.mp !== null || r.larr !== null);

            return (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Co-Sell Performance
                </h2>
                <div className="rounded-lg border border-border/20 bg-surface/50 p-4 space-y-4">
                  {/* Primary metrics: MP TCV and LARR */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* MP TCV */}
                    <div>
                      <div className="text-xs text-muted mb-1">MP TCV</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold text-foreground">{fmtCurrency(fin.mp_tcv_ytd)}</span>
                        {fin.mp_tcv_goal !== null && (
                          <span className="text-xs text-muted">/ {fmtCurrency(fin.mp_tcv_goal)} goal</span>
                        )}
                      </div>
                      {mpAttain && (
                        <div className="mt-0.5 text-sm font-medium text-accent">{mpAttain} attainment</div>
                      )}
                    </div>
                    {/* LARR */}
                    <div>
                      <div className="text-xs text-muted mb-1">LARR</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold text-foreground">{fmtCurrency(fin.larr_ytd)}</span>
                        {fin.larr_goal !== null && (
                          <span className="text-xs text-muted">/ {fmtCurrency(fin.larr_goal)} goal</span>
                        )}
                      </div>
                      {larrAttain && (
                        <div className="mt-0.5 text-sm font-medium text-accent">{larrAttain} attainment</div>
                      )}
                    </div>
                  </div>

                  {/* Prior year + projections */}
                  {(hasPrior || fin.mp_tcv_target_2025 !== null || fin.mp_tcv_projected_annual !== null || fin.larr_projected_annual !== null) && (
                    <div className="border-t border-border/20 pt-3">
                      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1.5 text-sm">
                        {/* Column headers */}
                        <div className="text-xs text-muted/50" />
                        <div className="text-xs text-muted/50">MP TCV</div>
                        <div className="text-xs text-muted/50">LARR</div>

                        {/* Prior year rows */}
                        {priorRows.map((row) => {
                          if (row.mp === null && row.larr === null) return null;
                          return (
                            <Fragment key={row.label}>
                              <div className="text-xs text-muted">{row.label}</div>
                              <div className="text-sm text-foreground/80">{fmtCurrency(row.mp)}</div>
                              <div className="text-sm text-foreground/80">{fmtCurrency(row.larr)}</div>
                            </Fragment>
                          );
                        })}

                        {/* 2025 Target */}
                        {fin.mp_tcv_target_2025 !== null && (
                          <>
                            <div className="text-xs text-muted">2025 Target</div>
                            <div className="text-sm text-foreground/80">{fmtCurrency(fin.mp_tcv_target_2025)}</div>
                            <div className="text-sm text-foreground/80">—</div>
                          </>
                        )}

                        {/* Projected Annual */}
                        {(fin.mp_tcv_projected_annual !== null || fin.larr_projected_annual !== null) && (
                          <>
                            <div className="text-xs text-muted">Projected Annual</div>
                            <div className="text-sm text-foreground/80">{fmtCurrency(fin.mp_tcv_projected_annual)}</div>
                            <div className="text-sm text-foreground/80">{fmtCurrency(fin.larr_projected_annual)}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Open Tasks */}
          {tasksWithContext.length > 0 && (() => {
            const TASK_VISIBLE = 5;
            const TASK_THRESHOLD = 8;
            const showAllTasks = tasksWithContext.length < TASK_THRESHOLD;
            const visibleTasks = showAllTasks ? tasksWithContext : tasksWithContext.slice(0, TASK_VISIBLE);

            return (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Open tasks
                  <span className="ml-1.5 font-normal text-muted">{tasksWithContext.length}</span>
                </h2>
                <div>
                  {visibleTasks.map((t) => {
                    const owner = ownerLabels[t.owner] ?? ownerLabels.me;
                    const contextLabel = t.engagement_name
                      ? t.engagement_name
                      : t.meeting_title
                        ? stripPartnerPrefix(t.meeting_title, partner.name)
                        : null;
                    return (
                      <div
                        key={t.id}
                        className="border-b border-border/20 px-3 py-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`min-w-0 flex-1 truncate ${t.owner === "me" ? "text-foreground" : "text-muted"}`}>{t.description}</span>
                          {t.due_date && (
                            <span className="shrink-0 text-xs text-muted">
                              {new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${owner.color}`}>
                            {owner.label}
                          </span>
                        </div>
                        {contextLabel && (
                          <span className="mt-0.5 block text-xs text-muted/50 truncate">{contextLabel}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!showAllTasks && (
                  <Link
                    href="/tasks"
                    className="mt-2 inline-block text-sm text-accent hover:underline"
                  >
                    View all {tasksWithContext.length} tasks →
                  </Link>
                )}
              </section>
            );
          })()}

          {/* Engagements */}
          {linkedEngagements.length > 0 && (() => {
            const VISIBLE_COUNT = 5;
            const SHOW_ALL_THRESHOLD = 8;
            const needsExpander = linkedEngagements.length >= SHOW_ALL_THRESHOLD;
            const visibleEngagements = needsExpander ? linkedEngagements.slice(0, VISIBLE_COUNT) : linkedEngagements;
            const overflowEngagements = needsExpander ? linkedEngagements.slice(VISIBLE_COUNT) : [];

            function renderEngagementRow(eng: Engagement) {
              const dotColor = statusDotColor[eng.status] ?? "bg-zinc-500";
              const preview = eng.condensed
                ? eng.condensed.split("\n").filter(Boolean).slice(0, 3).join(" · ")
                : eng.topic ?? null;
              return (
                <Link
                  key={eng.id}
                  href={`/engagements/${eng.id}`}
                  className="block border-b border-border/20 px-3 py-3 transition-colors hover:bg-surface/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {eng.name}
                    </span>
                    {eng.pillar && (
                      <span className="shrink-0">
                        <PillarBadge pillar={eng.pillar} />
                      </span>
                    )}
                    {eng.status !== "active" && (
                      <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} title={eng.status} />
                    )}
                  </div>
                  {preview && (
                    <p className="mt-1 text-sm text-muted line-clamp-2">{preview}</p>
                  )}
                </Link>
              );
            }

            return (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Engagements
                  <span className="ml-1.5 font-normal text-muted">{linkedEngagements.length}</span>
                </h2>
                <div>
                  {visibleEngagements.map(renderEngagementRow)}
                  {overflowEngagements.length > 0 && (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-1 px-3 py-2.5 text-sm text-accent hover:underline [&::-webkit-details-marker]:hidden">
                        Show all {linkedEngagements.length} engagements
                        <svg
                          width="14" height="14" viewBox="0 0 16 16"
                          fill="none" stroke="currentColor" strokeWidth="1.5"
                          className="shrink-0 transition-transform group-open:rotate-90"
                        >
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </summary>
                      {overflowEngagements.map(renderEngagementRow)}
                    </details>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Recent Meetings */}
          {recentMeetings.length > 0 && (() => {
            const MTG_VISIBLE = 5;
            const visibleMeetings = recentMeetings.slice(0, MTG_VISIBLE);

            return (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Recent meetings
                  <span className="ml-1.5 font-normal text-muted">{recentMeetings.length}</span>
                </h2>
                <div>
                  {visibleMeetings.map((m) => {
                    const shortDate = m.meeting_date
                      ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "TBD";
                    const condensedPreview = condensedByMeetingId.get(m.id);
                    const firstLine = condensedPreview
                      ? condensedPreview.split("\n").find((l) => l.trim()) ?? null
                      : null;

                    return (
                      <Link
                        key={m.id}
                        href={`/meetings/${m.id}`}
                        className="block border-b border-border/20 px-3 py-3 transition-colors hover:bg-surface/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-14 shrink-0 text-xs text-muted">{shortDate}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {cleanMeetingTitle(m.title)}
                          </span>
                        </div>
                        {firstLine && (
                          <p className="mt-1 ml-[calc(3.5rem+0.75rem)] text-sm text-muted truncate">{firstLine}</p>
                        )}
                      </Link>
                    );
                  })}
                </div>
                {recentMeetings.length > MTG_VISIBLE && (
                  <Link
                    href="/meetings"
                    className="mt-2 inline-block text-sm text-accent hover:underline"
                  >
                    View all {recentMeetings.length} meetings →
                  </Link>
                )}
              </section>
            );
          })()}

          {/* Program Enrollments */}
          {programEnrollments.length > 0 && (() => {
            const ENROLL_VISIBLE = 5;
            const ENROLL_THRESHOLD = 8;
            const needsExpander = programEnrollments.length >= ENROLL_THRESHOLD;
            const visibleEnrollments = needsExpander ? programEnrollments.slice(0, ENROLL_VISIBLE) : programEnrollments;
            const overflowEnrollments = needsExpander ? programEnrollments.slice(ENROLL_VISIBLE) : [];

            const typeColors: Record<string, string> = {
              "Competency": "bg-violet-500/10 text-violet-400",
              "Service Ready": "bg-emerald-500/10 text-emerald-400",
              "Program": "bg-blue-500/10 text-blue-400",
              "Credit Program": "bg-amber-500/10 text-amber-400",
            };

            const statusColors: Record<string, string> = {
              "Approved": "text-emerald-400",
              "In Progress": "text-amber-400",
              "Not Started": "text-muted",
              "Expired": "text-red-400",
            };

            function renderEnrollmentRow(enroll: typeof programEnrollments[number]) {
              const typeClass = (enroll.type && typeColors[enroll.type]) ?? "bg-zinc-500/10 text-zinc-400";
              const statusClass = (enroll.status && statusColors[enroll.status]) ?? "text-muted";
              const achieved = enroll.date_achieved
                ? new Date(enroll.date_achieved + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : null;
              const hasNotes = enroll.notes && enroll.notes.trim().length > 0;

              return (
                <div
                  key={enroll.id}
                  className="border-b border-border/20 px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {enroll.program_name ?? "Unlinked Program"}
                    </span>
                    {enroll.type && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${typeClass}`}>
                        {enroll.type}
                      </span>
                    )}
                    {enroll.status && (
                      <span className={`shrink-0 text-xs ${statusClass}`}>
                        {enroll.status}
                      </span>
                    )}
                    {achieved && (
                      <span className="shrink-0 text-xs text-muted">Achieved {achieved}</span>
                    )}
                  </div>
                  {hasNotes && (
                    <span className="mt-0.5 block text-xs text-muted/50 truncate">{enroll.notes}</span>
                  )}
                </div>
              );
            }

            return (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Program Enrollments
                  <span className="ml-1.5 font-normal text-muted">{programEnrollments.length}</span>
                </h2>
                <div>
                  {visibleEnrollments.map(renderEnrollmentRow)}
                  {overflowEnrollments.length > 0 && (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-1 px-3 py-2.5 text-sm text-accent hover:underline [&::-webkit-details-marker]:hidden">
                        Show all {programEnrollments.length} enrollments
                        <svg
                          width="14" height="14" viewBox="0 0 16 16"
                          fill="none" stroke="currentColor" strokeWidth="1.5"
                          className="shrink-0 transition-transform group-open:rotate-90"
                        >
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </summary>
                      {overflowEnrollments.map(renderEnrollmentRow)}
                    </details>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Funding (MPOPP + MDF) */}
          {(mpoppFunding.length > 0 || mdfFunding.length > 0) && (() => {
            const totalFunding = mpoppFunding.length + mdfFunding.length;

            const mpoppStatusColor: Record<string, string> = {
              "Approved": "text-emerald-400",
              "Pending": "text-amber-400",
            };

            return (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Funding
                  <span className="ml-1.5 font-normal text-muted">{totalFunding}</span>
                </h2>
                <div className="space-y-4">

                  {/* MPOPP */}
                  {mpoppFunding.length > 0 && (
                    <div>
                      <div className="mb-1 px-3 text-xs font-medium text-muted">MPOPP</div>
                      <div>
                        {mpoppFunding.map((f) => {
                          const remaining = (f.allocated ?? 0) - (f.spent ?? 0);
                          const hasNotes = f.notes && f.notes.trim().length > 0;
                          const statusClass = (f.status && mpoppStatusColor[f.status]) ?? "text-muted";

                          return (
                            <div key={f.id} className="border-b border-border/20 px-3 py-3">
                              <div className="flex items-center gap-3">
                                {f.status && (
                                  <span className={`shrink-0 text-xs ${statusClass}`}>{f.status}</span>
                                )}
                                {f.half && (
                                  <span className="shrink-0 text-xs text-muted">{f.half.toUpperCase()}</span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                  {f.track ?? "—"}
                                </span>
                                <span className="shrink-0 text-xs text-muted">
                                  {fmtCurrency(f.allocated)}
                                </span>
                                <span className="shrink-0 text-xs text-muted">
                                  spent {fmtCurrency(f.spent)}
                                </span>
                                <span className={`shrink-0 text-xs font-medium ${remaining > 0 ? "text-amber-400" : "text-muted"}`}>
                                  {fmtCurrency(remaining)} left
                                </span>
                              </div>
                              {hasNotes && (
                                <span className="mt-0.5 block text-xs text-muted/50 truncate">{f.notes}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* MDF */}
                  {mdfFunding.length > 0 && (
                    <div>
                      <div className="mb-1 px-3 text-xs font-medium text-muted">MDF</div>
                      <div>
                        {mdfFunding.map((f) => {
                          const remaining = (f.allocated ?? 0) - (f.utilized ?? 0);
                          const hasNotes = f.notes && f.notes.trim().length > 0;

                          return (
                            <div key={f.id} className="border-b border-border/20 px-3 py-3">
                              <div className="flex items-center gap-3">
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                  {f.record_name ?? "—"}
                                </span>
                                <span className="shrink-0 text-xs text-muted">
                                  {fmtCurrency(f.allocated)}
                                </span>
                                <span className="shrink-0 text-xs text-muted">
                                  used {fmtCurrency(f.utilized)}
                                </span>
                                <span className={`shrink-0 text-xs font-medium ${remaining > 0 ? "text-amber-400" : "text-muted"}`}>
                                  {fmtCurrency(remaining)} left
                                </span>
                                {f.source && (
                                  <span className="shrink-0 text-xs text-muted">{f.source}</span>
                                )}
                                {f.recurrence && (
                                  <span className="shrink-0 text-xs text-muted">{f.recurrence}</span>
                                )}
                              </div>
                              {hasNotes && (
                                <span className="mt-0.5 block text-xs text-muted/50 truncate">{f.notes}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </section>
            );
          })()}
      </div>
    </div>
  );
}
