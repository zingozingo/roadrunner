export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import MeetingTimeline from "@/components/shared/MeetingTimeline";
import ExpandableList from "@/components/shared/ExpandableList";
import PartnerScratchpad from "@/components/partners/PartnerScratchpad";
import { getPartner, getSupabaseClient, getRelationshipsByPartner, getMeetingNotesByPartner, getTasksByPartner, getPartnerContext, getContactsByPartner, getContactsByRelationshipBulk } from "@/lib/db";
import type { Engagement, Meeting, MeetingNoteWithTasks, Task } from "@/lib/types";

// Chevron icon for collapsible sections
function SectionChevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0 transition-transform group-open:rotate-90"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

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
  const allianceLead = contacts.find(c => c.role === 'Alliance Lead' && c.org_type === 'partner');
  const psa = contacts.find(c => c.role === 'PSA' && c.org_type === 'internal');
  const accountManager = contacts.find(c => c.role === 'Account Manager' && c.org_type === 'internal');
  const pmm = contacts.find(c => c.role === 'PMM' && c.org_type === 'internal');

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

  // Build engagement name map for MeetingTimeline
  const engagementNames = new Map<string, string>();
  for (const eng of linkedEngagements) {
    engagementNames.set(eng.id, eng.name);
  }

  // Build note status map for MeetingTimeline
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

  // Group contacts for Reference > Contacts section
  const partnerTeam = contacts.filter(c => c.org_type === 'partner');
  const awsTeam = contacts.filter(c => c.org_type === 'internal');

  // Owner label map for inline task display
  const ownerLabels: Record<string, { label: string; color: string }> = {
    me: { label: "Me", color: "bg-accent/15 text-accent" },
    internal: { label: "Internal", color: "bg-blue-500/15 text-blue-400" },
    partner: { label: "Partner", color: "bg-amber-500/15 text-amber-400" },
    third_party: { label: "3rd Party", color: "bg-purple-500/15 text-purple-400" },
  };

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

      {/* ═══ PRIMARY TIER ═══ */}

      <DetailHeader
        title={partner.name}
        badges={
          partner.segment ? (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent whitespace-nowrap capitalize">
              {partner.segment}
            </span>
          ) : undefined
        }
        fields={[
          { label: "Alliance Lead", value: allianceLead?.name ?? "—" },
          { label: "PSA", value: psa?.name ?? "—" },
          { label: "Account Manager", value: accountManager?.name ?? "—" },
          { label: "PMM", value: pmm?.name ?? "—" },
          { label: "SPMS ID", value: partner.spms_id?.toString() ?? "—" },
          { label: "Focus Areas", value: partner.focus_area.length > 0 ? partner.focus_area.join(", ") : "—" },
        ]}
      />

      {/* Living Context — brain + scratchpad (always visible, top position) */}
      <div className="space-y-4">
        <PartnerScratchpad partnerId={id} initialEntries={partnerContextEntries} />
      </div>

      {/* ═══ ACTIVITY TIER ═══ */}
      <div className="mt-8 space-y-4">

        {/* Engagements */}
        {linkedEngagements.length > 0 && (
          <details open className="group rounded-xl border border-border/40 bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
              <SectionChevron />
              Engagements
              <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">{linkedEngagements.length}</span>
            </summary>
            <div className="px-4 pb-4">
              <ExpandableList label="engagements">
                {linkedEngagements.map((eng) => (
                  <Link
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    className="flex items-center px-2 py-2 border-b border-border/50 transition-colors duration-150 hover:bg-surface-hover gap-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {eng.name}
                    </span>
                    <span className="shrink-0">
                      <StatusBadge status={eng.status} />
                    </span>
                  </Link>
                ))}
              </ExpandableList>
            </div>
          </details>
        )}

        {/* Meetings */}
        {linkedMeetings.length > 0 && (
          <details open className="group rounded-xl border border-border/40 bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
              <SectionChevron />
              Meetings
              <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">{linkedMeetings.length}</span>
            </summary>
            <div className="px-4 pb-4">
              <MeetingTimeline
                meetings={linkedMeetings}
                engagementNames={engagementNames}
                noteStatusByMeetingId={noteStatusByMeetingId}
              />
            </div>
          </details>
        )}

        {/* Tasks (read-only inline rows) */}
        {tasksWithTitles.length > 0 && (
          <details open className="group rounded-xl border border-border/40 bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
              <SectionChevron />
              Open Tasks
              <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">{tasksWithTitles.length}</span>
            </summary>
            <div className="px-4 pb-4 space-y-1">
              {tasksWithTitles.map((t) => {
                const owner = ownerLabels[t.owner] ?? ownerLabels.me;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded px-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-foreground">{t.description}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${owner.color}`}>
                      {owner.label}
                    </span>
                    {t.due_date && (
                      <span className="shrink-0 text-xs text-muted">
                        {new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* ═══ REFERENCE TIER ═══ */}
      <div className="mt-8 space-y-4">

        {/* About — What They Do + AWS Stickiness */}
        {(partner.what_they_do || partner.aws_stickiness || partner.key_aws_services.length > 0) && (
          <details className="group rounded-xl border border-border/40 bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
              <SectionChevron />
              About
            </summary>
            <div className="px-4 pb-4">
              <div className="grid gap-6 lg:grid-cols-2">
                {partner.what_they_do && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      What They Do
                    </h3>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {partner.what_they_do}
                    </p>
                  </div>
                )}
                {(partner.aws_stickiness || partner.key_aws_services.length > 0) && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                      AWS Stickiness
                    </h3>
                    {partner.aws_stickiness && (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {partner.aws_stickiness}
                      </p>
                    )}
                    {partner.key_aws_services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {partner.key_aws_services.map((svc) => (
                          <span
                            key={svc}
                            className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent whitespace-nowrap"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>
        )}

        {/* Profile — architecture, listings, pricing, status */}
        {(partner.architecture || partner.listing_types?.length || partner.pricing_model?.length || partner.isva_status || partner.deployed_on_aws || partner.prm_status || partner.crm_status) && (
          <details className="group rounded-xl border border-border/40 bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
              <SectionChevron />
              Profile
            </summary>
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                {partner.architecture && (
                  <div>
                    <span className="block text-xs text-muted mb-1">Architecture</span>
                    <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400 whitespace-nowrap">
                      {partner.architecture}
                    </span>
                  </div>
                )}
                {partner.listing_types && partner.listing_types.length > 0 && (
                  <div>
                    <span className="block text-xs text-muted mb-1">Listing Types</span>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.listing_types.map((t) => (
                        <span key={t} className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-400 whitespace-nowrap">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.pricing_model && partner.pricing_model.length > 0 && (
                  <div>
                    <span className="block text-xs text-muted mb-1">Pricing Model</span>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.pricing_model.map((m) => (
                        <span key={m} className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-400 whitespace-nowrap">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.isva_status && (
                  <div>
                    <span className="block text-xs text-muted mb-1">ISVa Status</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                      partner.isva_status === "Approved"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {partner.isva_status}
                    </span>
                  </div>
                )}
                {partner.deployed_on_aws && (
                  <div>
                    <span className="block text-xs text-muted mb-1">Deployed on AWS</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                      partner.deployed_on_aws === "Approved"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-gray-500/15 text-gray-400"
                    }`}>
                      {partner.deployed_on_aws}
                    </span>
                  </div>
                )}
                {partner.prm_status && (
                  <div>
                    <span className="block text-xs text-muted mb-1">PRM Status</span>
                    <span className="text-sm text-foreground">{partner.prm_status}</span>
                  </div>
                )}
                {partner.crm_status && (
                  <div>
                    <span className="block text-xs text-muted mb-1">CRM Status</span>
                    <span className="text-sm text-foreground">{partner.crm_status}</span>
                  </div>
                )}
              </div>
            </div>
          </details>
        )}

        {/* Contacts — all contacts with emails, grouped by org_type */}
        {contacts.length > 0 && (
          <details className="group rounded-xl border border-border/40 bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
              <SectionChevron />
              Contacts
              <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">{contacts.length}</span>
            </summary>
            <div className="px-4 pb-4 space-y-4">
              {partnerTeam.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Partner Team</h3>
                  <div className="space-y-1.5">
                    {partnerTeam.map((c, i) => (
                      <div key={i} className="text-sm text-foreground">
                        <span className="font-medium">{c.name ?? "Unknown"}</span>
                        {c.role && <span className="text-xs text-muted ml-1.5">({c.role})</span>}
                        {c.email && c.email !== "—" && (
                          <a href={`mailto:${c.email}`} className="ml-2 text-xs text-muted hover:text-accent">
                            {c.email}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {awsTeam.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">AWS Team</h3>
                  <div className="space-y-1.5">
                    {awsTeam.map((c, i) => (
                      <div key={i} className="text-sm text-foreground">
                        <span className="font-medium">{c.name ?? "Unknown"}</span>
                        {c.role && <span className="text-xs text-muted ml-1.5">({c.role})</span>}
                        {c.email && c.email !== "—" && (
                          <a href={`mailto:${c.email}`} className="ml-2 text-xs text-muted hover:text-accent">
                            {c.email}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        {/* AWS Relationships */}
        {linkedRelationships.length > 0 && (
          <details className="group rounded-xl border border-border/40 bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold uppercase tracking-wider text-muted [&::-webkit-details-marker]:hidden">
              <SectionChevron />
              AWS Relationships
              <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">{linkedRelationships.length}</span>
            </summary>
            <div className="px-4 pb-4">
              <div className="space-y-1">
                {linkedRelationships.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/relationships/${rel.id}`}
                    className="flex items-baseline gap-2 rounded px-2 py-1.5 transition-colors hover:bg-surface-hover"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {rel.name}
                    </span>
                    {(relContactsMap.get(rel.id)?.find(c => c.role === 'Lead Contact')?.name || relContactsMap.get(rel.id)?.[0]?.name) && (
                      <span className="text-xs text-muted">
                        {relContactsMap.get(rel.id)?.find(c => c.role === 'Lead Contact')?.name || relContactsMap.get(rel.id)?.[0]?.name}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
