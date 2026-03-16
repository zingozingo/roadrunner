export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import PillarBadge from "@/components/shared/PillarBadge";
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

  // Build note title map for tasks
  const noteTitleMap = new Map<string, string>();
  for (const note of partnerNotes) {
    noteTitleMap.set(note.id, note.title ?? "Untitled");
  }

  const tasksWithTitles = openTasks.map((t) => ({
    ...t,
    note_title: (t.meeting_note_id ? noteTitleMap.get(t.meeting_note_id) : null) ?? "Untitled",
  }));

  // Contacts are grouped/sorted by ContactGroup component

  // Owner label map for inline task display
  const ownerLabels: Record<string, { label: string; color: string }> = {
    me: { label: "Me", color: "bg-accent/15 text-accent" },
    internal: { label: "Internal", color: "bg-blue-500/15 text-blue-400" },
    partner: { label: "Partner", color: "bg-amber-500/15 text-amber-400" },
    third_party: { label: "3rd Party", color: "bg-purple-500/15 text-purple-400" },
  };

  // Recent meetings — last 90 days + upcoming
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentMeetings = linkedMeetings.filter((m) => {
    if (!m.meeting_date) return false;
    const d = new Date(m.meeting_date + "T00:00:00");
    return d >= cutoff;
  }).slice(0, 15);

  return (
    <div className="p-6 lg:p-8">
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
        <h1 className="text-xl font-semibold text-foreground">{partner.name}</h1>
        {partner.segment && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent capitalize">
            {partner.segment}
          </span>
        )}
        <span className="ml-auto text-xs text-muted">
          {partner.spms_id ? `SPMS ${partner.spms_id}` : ""}
        </span>
      </div>

      {/* ═══ TWO-COLUMN LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">

        {/* ─── LEFT COLUMN: Workflow ─── */}
        <div className="space-y-10">

          {/* Living Context */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Living context</h2>
            </div>
            <PartnerScratchpad partnerId={id} initialEntries={partnerContextEntries} compact />
          </section>

          {/* Engagements */}
          {linkedEngagements.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Engagements
                <span className="ml-1.5 font-normal text-muted">{linkedEngagements.length}</span>
              </h2>
              <div className="space-y-1.5">
                {linkedEngagements.map((eng) => {
                  const dotColor = statusDotColor[eng.status] ?? "bg-zinc-500";
                  return (
                    <Link
                      key={eng.id}
                      href={`/engagements/${eng.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {eng.name}
                      </span>
                      {eng.pillar && (
                        <span className="shrink-0">
                          <PillarBadge pillar={eng.pillar} />
                        </span>
                      )}
                      <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} title={eng.status} />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Open Tasks */}
          {tasksWithTitles.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Open tasks
                <span className="ml-1.5 font-normal text-muted">{tasksWithTitles.length}</span>
              </h2>
              <div>
                {tasksWithTitles.map((t) => {
                  const owner = ownerLabels[t.owner] ?? ownerLabels.me;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 border-b border-border/20 py-2 text-sm"
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
            </section>
          )}

          {/* Recent Meetings */}
          {recentMeetings.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Recent meetings
              </h2>
              <div>
                {recentMeetings.map((m) => {
                  const shortDate = m.meeting_date
                    ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "TBD";
                  const noteStatus = noteStatusByMeetingId.get(m.id);
                  const noteDotColor = noteStatus
                    ? noteStatus.status === "complete"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                    : null;

                  return (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="flex items-center gap-3 border-b border-border/20 py-2 transition-colors hover:bg-surface-hover"
                    >
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
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ─── RIGHT COLUMN: Reference ─── */}
        <div className="lg:border-l lg:border-border/20 lg:pl-8">

          {/* What They Do */}
          {partner.what_they_do && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">What they do</h2>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {partner.what_they_do}
              </p>
            </section>
          )}

          {/* AWS Stickiness */}
          {(partner.aws_stickiness || partner.key_aws_services.length > 0) && (
            <section className={partner.what_they_do ? "mt-6 pt-6 border-t border-border/20" : ""}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">AWS Stickiness</h2>
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
            </section>
          )}

          {/* Profile */}
          {(partner.architecture || partner.listing_types?.length || partner.pricing_model?.length || partner.isva_status || partner.deployed_on_aws || partner.prm_status || partner.crm_status) && (
            <section className="mt-6 pt-6 border-t border-border/20">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Profile</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {partner.architecture && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Architecture</span>
                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
                      {partner.architecture}
                    </span>
                  </div>
                )}
                {partner.listing_types && partner.listing_types.length > 0 && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Listing Types</span>
                    <div className="flex flex-wrap gap-1">
                      {partner.listing_types.map((t) => (
                        <span key={t} className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
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
                        <span key={m} className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-400">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.isva_status && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">ISVa</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      partner.isva_status === "Approved" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {partner.isva_status}
                    </span>
                  </div>
                )}
                {partner.deployed_on_aws && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Deployed on AWS</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      partner.deployed_on_aws === "Approved" ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/15 text-gray-400"
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

          {/* Contacts */}
          {contacts.length > 0 && (
            <section className="mt-6 pt-6 border-t border-border/20">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Contacts</h2>
              <ContactGroup contacts={contacts} currentUserEmail={USER_CONFIG.email} />
            </section>
          )}

          {/* Relationships */}
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
