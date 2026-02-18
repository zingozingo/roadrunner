export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { MeetingStatusBadge, RelationshipTypeBadge, StrengthBadge } from "@/components/TypeBadge";
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

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">
            {partner.name}
          </h1>
          {partner.category && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent whitespace-nowrap">
              {partner.category.replace("_", " ")}
            </span>
          )}
        </div>
        {partner.sub_category && (
          <p className="mt-1 text-muted">{partner.sub_category}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Linked Engagements */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Engagements
            </h2>
            {linkedEngagements.length === 0 ? (
              <p className="text-sm text-muted">No engagements linked yet</p>
            ) : (
              <div className="space-y-2">
                {linkedEngagements.map((eng) => (
                  <Link
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    className="block rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {eng.name}
                      </span>
                      <StatusBadge status={eng.status} />
                    </div>
                    {eng.current_state && (
                      <p className="mt-1 text-xs text-muted line-clamp-2">
                        {eng.current_state}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Linked Meetings */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Meetings
            </h2>
            {linkedMeetings.length === 0 ? (
              <p className="text-sm text-muted">No meetings linked yet</p>
            ) : (
              <div className="space-y-2">
                {linkedMeetings.map((mtg) => (
                  <Link
                    key={mtg.id}
                    href={`/meetings/${mtg.id}`}
                    className="block rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {mtg.title}
                      </span>
                      <MeetingStatusBadge status={mtg.status} />
                    </div>
                    {mtg.meeting_date && (
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(mtg.meeting_date + "T00:00:00").toLocaleDateString()}
                        {mtg.start_time && ` at ${mtg.start_time}`}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Linked AWS Relationships */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              AWS Relationships
            </h2>
            {linkedRelationships.length === 0 ? (
              <p className="text-sm text-muted">No AWS relationships linked yet</p>
            ) : (
              <div className="space-y-2">
                {linkedRelationships.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/relationships/${rel.id}`}
                    className="block rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {rel.name}
                      </span>
                      <RelationshipTypeBadge type={rel.relationship_type} />
                      <StrengthBadge strength={rel.strength} />
                    </div>
                    {rel.primary_contact_name && (
                      <p className="mt-0.5 text-xs text-muted">
                        {rel.primary_contact_name}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: metadata */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Details
            </h2>
            <dl className="space-y-3 text-sm">
              {partner.category && (
                <div>
                  <dt className="text-muted">Category</dt>
                  <dd className="text-foreground capitalize">{partner.category.replace("_", " ")}</dd>
                </div>
              )}
              {partner.sub_category && (
                <div>
                  <dt className="text-muted">Sub-Category</dt>
                  <dd className="text-foreground">{partner.sub_category}</dd>
                </div>
              )}
              {partner.alliance_lead && (
                <div>
                  <dt className="text-muted">Alliance Lead</dt>
                  <dd className="text-foreground">
                    {partner.alliance_lead}
                    {partner.alliance_lead_email && (
                      <span className="block text-xs text-muted break-all">
                        {partner.alliance_lead_email}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {partner.psa && (
                <div>
                  <dt className="text-muted">PSA</dt>
                  <dd className="text-foreground">{partner.psa}</dd>
                </div>
              )}
              {partner.spms_id && (
                <div>
                  <dt className="text-muted">SPMS ID</dt>
                  <dd className="text-foreground">{partner.spms_id}</dd>
                </div>
              )}
              {partner.partner_contact_emails && partner.partner_contact_emails.length > 0 && (
                <div>
                  <dt className="text-muted">Contact Emails</dt>
                  <dd className="text-foreground break-all">
                    {partner.partner_contact_emails.map((email, i) => (
                      <span key={i} className="block">{email}</span>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(partner.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
