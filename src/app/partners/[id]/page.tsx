export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import MeetingTimeline from "@/components/shared/MeetingTimeline";
import ExpandableList from "@/components/shared/ExpandableList";
import PartnerTasksSection from "@/components/partners/PartnerTasksSection";
import PartnerScratchpad from "@/components/partners/PartnerScratchpad";
import { getPartner, getSupabaseClient, getRelationshipsByPartner, getMeetingNotesByPartner, getTasksByPartner, getPartnerContext, getContactsByPartner, getContactsByRelationshipBulk } from "@/lib/db";
import type { Engagement, Meeting, MeetingNoteWithTasks, Task } from "@/lib/types";

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
  const otherPartnerContacts = contacts.filter(c => c.org_type === 'partner' && c.role !== 'Alliance Lead');

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
          {
            label: "Alliance Lead",
            value: allianceLead?.name ? (
              <span>
                {allianceLead.name}
                {allianceLead.email && allianceLead.email !== "—" && (
                  <a href={`mailto:${allianceLead.email}`} className="block text-xs text-muted break-all hover:text-accent">
                    {allianceLead.email}
                  </a>
                )}
              </span>
            ) : "—",
          },
          {
            label: "PSA",
            value: psa?.name ? (
              <span>
                {psa.name}
                {psa.email && psa.email !== "—" && (
                  <a href={`mailto:${psa.email}`} className="block text-xs text-muted break-all hover:text-accent">
                    {psa.email}
                  </a>
                )}
              </span>
            ) : "—",
          },
          {
            label: "Account Manager",
            value: accountManager?.name ? (
              <span>
                {accountManager.name}
                {accountManager.email && accountManager.email !== "—" && (
                  <a href={`mailto:${accountManager.email}`} className="block text-xs text-muted break-all hover:text-accent">
                    {accountManager.email}
                  </a>
                )}
              </span>
            ) : "—",
          },
          {
            label: "PMM",
            value: pmm?.name ? (
              <span>
                {pmm.name}
                {pmm.email && pmm.email !== "—" && (
                  <a href={`mailto:${pmm.email}`} className="block text-xs text-muted break-all hover:text-accent">
                    {pmm.email}
                  </a>
                )}
              </span>
            ) : "—",
          },
          { label: "SPMS ID", value: partner.spms_id?.toString() ?? "—" },
          { label: "Focus Areas", value: partner.focus_area.length > 0 ? partner.focus_area.join(", ") : "—" },
        ]}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* Partner Context — two-column card: What They Do + AWS Stickiness */}
        {(partner.what_they_do || partner.aws_stickiness || partner.key_aws_services.length > 0) && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: What They Do */}
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

              {/* Right: AWS Stickiness */}
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
        )}

        {/* Partner Profile — architecture, listings, pricing, status */}
        {(partner.architecture || partner.listing_types?.length || partner.pricing_model?.length || partner.isva_status || partner.deployed_on_aws || partner.prm_status || partner.crm_status) && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Partner Profile
            </h3>
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
        )}

        {/* Partner Contacts — show non-Alliance-Lead contacts */}
        {otherPartnerContacts.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
              Partner Contacts
            </h2>
            <div className="space-y-1.5">
              {otherPartnerContacts.map((c, i) => (
                <div key={i} className="text-sm text-foreground">
                  <span className="font-medium">{c.name ?? "Unknown"}</span>
                  {c.role && <span className="text-xs text-muted ml-1.5">({c.role})</span>}
                  {c.email && c.email !== "—" && (
                    <a href={`mailto:${c.email}`} className="block text-xs text-muted break-all hover:text-accent">
                      {c.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Living Context — scratchpad + AI synthesis entries */}
        <PartnerScratchpad partnerId={id} initialEntries={partnerContextEntries} />

        {/* Engagements — status right-aligned */}
        {linkedEngagements.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Engagements
            </h2>
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
        )}

        {/* Meetings Timeline — enhanced with note status indicators */}
        {linkedMeetings.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Meetings
            </h2>
            <MeetingTimeline
              meetings={linkedMeetings}
              engagementNames={engagementNames}
              noteStatusByMeetingId={noteStatusByMeetingId}
            />
          </div>
        )}

        {/* Tasks — open tasks grouped by owner */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <PartnerTasksSection partnerId={id} tasks={tasksWithTitles} />
        </div>

        {/* AWS Relationships — simple text links, no cards */}
        {linkedRelationships.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              AWS Relationships
            </h2>
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
        )}
      </div>
    </div>
  );
}
