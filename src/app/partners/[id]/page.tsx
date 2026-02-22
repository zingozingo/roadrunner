export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CompactRow from "@/components/shared/CompactRow";
import MeetingTimeline from "@/components/shared/MeetingTimeline";
import ExpandableList from "@/components/shared/ExpandableList";
import { getPartner, getSupabaseClient, getAwsRelationshipsByPartner } from "@/lib/supabase";
import type { Engagement, Meeting } from "@/lib/types";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const partner = await getPartner(id);
  if (!partner) notFound();

  const db = getSupabaseClient();

  // Fetch by partner_id FK, falling back to partner_name text match for unbackfilled rows
  const [{ data: engByFk }, { data: engByName }, { data: mtgByFk }, { data: mtgByName }] =
    await Promise.all([
      db
        .from("engagements")
        .select("*")
        .eq("partner_id", id)
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false }),
      db
        .from("engagements")
        .select("*")
        .eq("partner_name", partner.name)
        .is("partner_id", null)
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false }),
      db
        .from("meetings")
        .select("*")
        .eq("partner_id", id)
        .order("meeting_date", { ascending: false, nullsFirst: false }),
      db
        .from("meetings")
        .select("*")
        .eq("partner_name", partner.name)
        .is("partner_id", null)
        .order("meeting_date", { ascending: false, nullsFirst: false }),
    ]);
  const engagements = [...(engByFk ?? []), ...(engByName ?? [])];
  const meetings = [...(mtgByFk ?? []), ...(mtgByName ?? [])];

  const linkedEngagements = (engagements ?? []) as Engagement[];
  const linkedMeetings = (meetings ?? []) as Meeting[];
  const linkedRelationships = await getAwsRelationshipsByPartner(id);

  // Build engagement name map for MeetingTimeline
  const engagementNames = new Map<string, string>();
  for (const eng of linkedEngagements) {
    engagementNames.set(eng.id, eng.name);
  }

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
            value: partner.alliance_lead ? (
              <span>
                {partner.alliance_lead}
                {partner.alliance_lead_email && (
                  <span className="block text-xs text-muted break-all">
                    {partner.alliance_lead_email}
                  </span>
                )}
              </span>
            ) : "—",
          },
          { label: "PSA", value: partner.psa ?? "—" },
          { label: "SPMS ID", value: partner.spms_id?.toString() ?? "—" },
          { label: "Focus Areas", value: partner.focus_area.length > 0 ? partner.focus_area.join(", ") : "—" },
        ]}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* Partner Context — two-column card: What They Do + AWS Context */}
        {(partner.what_they_do || partner.aws_stickiness || partner.key_aws_services.length > 0) && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: What They Do */}
              {partner.what_they_do && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    What They Do
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">
                    {partner.what_they_do}
                  </p>
                </div>
              )}

              {/* Right: AWS Context */}
              {(partner.aws_stickiness || partner.key_aws_services.length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                    AWS Context
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

        {/* Contact Emails — only show if present, compact inline */}
        {partner.partner_contact_emails && partner.partner_contact_emails.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
              Contact Emails
            </h2>
            <div className="flex flex-wrap gap-2">
              {partner.partner_contact_emails.map((email, i) => (
                <span key={i} className="text-sm text-foreground break-all">
                  {email}{i < partner.partner_contact_emails!.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meetings Timeline — temporal entities get timeline treatment */}
        {linkedMeetings.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Meetings
            </h2>
            <MeetingTimeline
              meetings={linkedMeetings}
              engagementNames={engagementNames}
            />
          </div>
        )}

        {/* Engagements — status right-aligned, no pillar/priority badges */}
        {linkedEngagements.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Engagements
            </h2>
            <div className="space-y-2">
              <ExpandableList label="engagements">
                {linkedEngagements.map((eng) => (
                  <CompactRow
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    primary={eng.name}
                    secondary={eng.partner_name ?? undefined}
                    meta={<StatusBadge status={eng.status} />}
                  />
                ))}
              </ExpandableList>
            </div>
          </div>
        )}

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
                  {rel.primary_contact_name && (
                    <span className="text-xs text-muted">
                      {rel.primary_contact_name}
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
