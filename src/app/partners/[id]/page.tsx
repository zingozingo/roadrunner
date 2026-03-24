export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import PillarBadge from "@/components/shared/PillarBadge";
import BrainSynthesis from "@/components/partners/BrainSynthesis";
import PartnerScratchpad from "@/components/partners/PartnerScratchpad";
import { cleanMeetingTitle } from "@/lib/format-utils";
import { getPartner, getSupabaseClient, getRelationshipsByPartner, getMeetingNotesByPartner, getTasksByPartner, getPartnerContext, getContactsByPartner, getContactsByRelationshipBulk } from "@/lib/db";
import PartnerReferencePanel from "@/components/partners/PartnerReferencePanel";
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
              crm_status: partner.crm_status ?? null,
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
      </div>
    </div>
  );
}
