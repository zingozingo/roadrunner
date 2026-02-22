export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CompactRow from "@/components/shared/CompactRow";
import { RelationshipTypeBadge } from "@/components/shared/TypeBadge";
import MeetingTimeline from "@/components/shared/MeetingTimeline";
import ExpandableList from "@/components/shared/ExpandableList";
import RelationshipActions from "@/components/actions/RelationshipActions";
import {
  getAwsRelationship,
  getEngagementsByAwsRelationship,
  getMeetingsByAwsRelationship,
} from "@/lib/supabase";

export default async function RelationshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const relationship = await getAwsRelationship(id);
  if (!relationship) notFound();

  const [linkedEngagements, linkedMeetings] = await Promise.all([
    getEngagementsByAwsRelationship(id),
    getMeetingsByAwsRelationship(id),
  ]);

  // Build engagement name map for MeetingTimeline
  const engagementNames = new Map<string, string>();
  for (const eng of linkedEngagements) {
    engagementNames.set(eng.id, eng.name);
  }

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/relationships"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Relationships
      </Link>

      <DetailHeader
        title={relationship.name}
        badges={<RelationshipTypeBadge type={relationship.relationship_type} />}
        subtitle={relationship.notes ?? undefined}
        fields={[
          { label: "AWS Org", value: relationship.aws_org ?? "—" },
          { label: "AWS Service", value: relationship.aws_service ?? "—" },
          { label: "Primary Contact", value: relationship.primary_contact_name ?? "—" },
          {
            label: "Contact Email",
            value: relationship.primary_contact_email ?? "—",
          },
          ...(relationship.aws_contact_emails.length > 0
            ? [{
                label: "AWS Contacts",
                value: relationship.aws_contact_emails.join(", "),
              }]
            : []),
        ]}
        actions={<RelationshipActions relationship={relationship} />}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* Linked Engagements */}
        {linkedEngagements.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Engagements
            </h2>
            <div className="space-y-2">
              <ExpandableList label="engagements">
                {linkedEngagements.map((eng) => (
                  <CompactRow
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    primary={eng.name}
                    badges={
                      <>
                        <StatusBadge status={eng.status} />
                        {eng.pillar && (
                          <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                            {eng.pillar}
                          </span>
                        )}
                        {eng.priority && (
                          <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                            {eng.priority}
                          </span>
                        )}
                      </>
                    }
                    secondary={eng.current_state ?? undefined}
                  />
                ))}
              </ExpandableList>
            </div>
          </div>
        )}

        {/* Linked Meetings */}
        {linkedMeetings.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Meetings
            </h2>
            <MeetingTimeline
              meetings={linkedMeetings}
              engagementNames={engagementNames}
            />
          </div>
        )}

        {/* Compact footer */}
        <p className="mt-6 text-xs text-muted">
          Created {new Date(relationship.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
