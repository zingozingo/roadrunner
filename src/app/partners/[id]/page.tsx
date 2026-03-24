export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import PillarBadge from "@/components/shared/PillarBadge";
import BrainSynthesis from "@/components/partners/BrainSynthesis";
import PartnerScratchpad from "@/components/partners/PartnerScratchpad";
import { cleanMeetingTitle } from "@/lib/format-utils";
import { getPartner, getSupabaseClient, getRelationshipsByPartner, getMeetingNotesByPartner, getTasksByPartner, getPartnerContext, getContactsByPartner, getContactsByRelationshipBulk } from "@/lib/db";
import ContactGroup from "@/components/shared/ContactGroup";
import { USER_CONFIG } from "@/lib/user-config";
import type { Engagement, Meeting, MeetingNoteWithTasks } from "@/lib/types";

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

  const [linkedRelationships, partnerNotes, openTasks, partnerContextEntries] = await Promise.all([
    getRelationshipsByPartner(id),
    getMeetingNotesByPartner(id),
    getTasksByPartner(id, { status: "open" }),
    getPartnerContext(id),
  ]);

  // Bulk-fetch relationship contacts for inline display
  const relContactsMap = await getContactsByRelationshipBulk(
    linkedRelationships.map((r) => r.id)
  );

  // Build note status map for meeting rows
  const noteStatusByMeetingId = new Map<string, { noteId: string; status: "draft" | "complete"; taskCount: number }>();
  for (const note of partnerNotes) {
    if (note.meeting_id) {
      noteStatusByMeetingId.set(note.meeting_id, {
        noteId: note.id,
        status: note.status === "complete" ? "complete" : "draft",
        taskCount: note.tasks.length,
      });
    }
  }

  // Build condensed digest map for meeting rows
  const condensedByMeetingId = new Map<string, string>();
  for (const note of partnerNotes) {
    if (note.meeting_id && note.condensed) {
      condensedByMeetingId.set(note.meeting_id, note.condensed);
    }
  }

  // Build note title map for tasks
  const noteTitleMap = new Map<string, string>();
  for (const note of partnerNotes) {
    noteTitleMap.set(note.id, note.title ?? "Untitled");
  }

  const tasksWithTitles = openTasks.map((t) => ({
    ...t,
    note_title: (t.meeting_note_id ? noteTitleMap.get(t.meeting_note_id) : null) ?? "Untitled",
  }));

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
        <span className="ml-auto text-xs text-muted">
          {partner.spms_id ? `SPMS ${partner.spms_id}` : ""}
        </span>
      </div>

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 lg:gap-12">

        {/* ─── LEFT COLUMN: Workflow ─── */}
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
            <PartnerScratchpad partnerId={id} initialEntries={scratchpadEntries} compact />
          </section>

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
                    <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} title={eng.status} />
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

          {/* Open Tasks */}
          {tasksWithTitles.length > 0 && (() => {
            const TASK_VISIBLE = 5;
            const TASK_THRESHOLD = 8;
            const showAllTasks = tasksWithTitles.length < TASK_THRESHOLD;
            const visibleTasks = showAllTasks ? tasksWithTitles : tasksWithTitles.slice(0, TASK_VISIBLE);

            return (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Open tasks
                  <span className="ml-1.5 font-normal text-muted">{tasksWithTitles.length}</span>
                </h2>
                <div>
                  {visibleTasks.map((t) => {
                    const owner = ownerLabels[t.owner] ?? ownerLabels.me;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 border-b border-border/20 px-3 py-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground">{t.description}</span>
                        {t.due_date && (
                          <span className="shrink-0 text-xs text-muted">
                            {new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${owner.color}`}>
                          {owner.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!showAllTasks && (
                  <Link
                    href="/tasks"
                    className="mt-2 inline-block text-sm text-accent hover:underline"
                  >
                    View all {tasksWithTitles.length} tasks →
                  </Link>
                )}
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
                    const noteStatus = noteStatusByMeetingId.get(m.id);
                    const noteDotColor = noteStatus
                      ? noteStatus.status === "complete"
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                      : null;
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
                          {noteDotColor && (
                            <span
                              className={`shrink-0 h-1.5 w-1.5 rounded-full ${noteDotColor}`}
                              title={noteStatus!.status === "complete" ? `Notes complete (${noteStatus!.taskCount} tasks)` : "Notes in progress"}
                            />
                          )}
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
        </div>

        {/* ─── RIGHT COLUMN: Reference ─── */}
        <div className="lg:border-l lg:border-border/20 lg:pl-8">

          {/* ── Section 1: Solution Profile ── */}
          {(partner.what_they_do || partner.aws_stickiness || partner.key_aws_services.length > 0) && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Solution profile</h2>
              {partner.what_they_do && (
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {partner.what_they_do}
                </p>
              )}
              {(partner.aws_stickiness || partner.key_aws_services.length > 0) && (
                <div className={partner.what_they_do ? "mt-4" : ""}>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-accent mb-1.5">AWS Stickiness</span>
                  {partner.aws_stickiness && (
                    <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap mb-2">
                      {partner.aws_stickiness}
                    </p>
                  )}
                  {partner.key_aws_services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {partner.key_aws_services.map((svc) => (
                        <span
                          key={svc}
                          className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Section 2: Deployment & Pricing ── */}
          {(partner.architecture || partner.listing_types?.length || partner.pricing_model?.length) && (
            <section className="mt-6 pt-6 border-t border-border/20">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Deployment & pricing</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {partner.architecture && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Architecture</span>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                      {partner.architecture}
                    </span>
                  </div>
                )}
                {partner.listing_types && partner.listing_types.length > 0 && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Listing Types</span>
                    <div className="flex flex-wrap gap-1">
                      {partner.listing_types.map((t) => (
                        <span key={t} className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.pricing_model && partner.pricing_model.length > 0 && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Pricing</span>
                    <div className="flex flex-wrap gap-1">
                      {partner.pricing_model.map((m) => (
                        <span key={m} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Section 3: Operational Status ── */}
          {/* Ring 3 future: program enrollments, funding wallets, goal progress */}
          {(partner.isva_status || partner.deployed_on_aws || partner.prm_status || partner.crm_status) && (
            <section className="mt-6 pt-6 border-t border-border/20">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Operational status</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {partner.isva_status && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">ISVa</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      partner.isva_status === "Approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {partner.isva_status}
                    </span>
                  </div>
                )}
                {partner.deployed_on_aws && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Deployed on AWS</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      partner.deployed_on_aws === "Approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"
                    }`}>
                      {partner.deployed_on_aws}
                    </span>
                  </div>
                )}
                {partner.prm_status && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">PRM</span>
                    <span className="text-sm text-foreground">{partner.prm_status}</span>
                  </div>
                )}
                {partner.crm_status && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">CRM</span>
                    <span className="text-sm text-foreground">{partner.crm_status}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Section 4: People ── */}
          {contacts.length > 0 && (
            <section className="mt-6 pt-6 border-t border-border/20">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">People</h2>
              <ContactGroup contacts={contacts} currentUserEmail={USER_CONFIG.email} />
            </section>
          )}

          {/* ── Section 5: Relationships ── */}
          <section className="mt-6 pt-6 border-t border-border/20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Relationships</h2>
            {linkedRelationships.length > 0 ? (
              <div className="space-y-1">
                {linkedRelationships.map((rel) => {
                  const leadName = relContactsMap.get(rel.id)?.find(c => c.role === 'Lead Contact')?.name || relContactsMap.get(rel.id)?.[0]?.name;
                  return (
                    <Link
                      key={rel.id}
                      href={`/relationships/${rel.id}`}
                      className="flex items-baseline gap-2 py-1 transition-colors hover:text-accent"
                    >
                      <span className="text-sm font-medium text-foreground">{rel.name}</span>
                      {leadName && <span className="text-xs text-muted">{leadName}</span>}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm italic text-muted">No linked relationships</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
