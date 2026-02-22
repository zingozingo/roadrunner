export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CompactRow from "@/components/shared/CompactRow";
import { RelationshipTypeBadge } from "@/components/shared/TypeBadge";
import CurrentStateCard from "@/components/engagement/CurrentStateCard";
import OpenItemsCard from "@/components/engagement/OpenItemsCard";
import CollapsibleEmails from "@/components/shared/CollapsibleEmails";
import EntityLinkChip from "@/components/shared/EntityLink";
import EngagementActions from "@/components/actions/EngagementActions";
import ParticipantList from "@/components/shared/ParticipantList";
import {
  getEngagementById,
  getMessagesByEngagement,
  getMeetingsByEngagement,
  getParticipantsByEngagement,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
  getAwsRelationshipsByEngagement,
} from "@/lib/supabase";
import type { Meeting } from "@/lib/types";

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const engagement = await getEngagementById(id);
  if (!engagement) notFound();

  const [messages, meetings, participants, entityLinks, awsRelationships] = await Promise.all([
    getMessagesByEngagement(id),
    getMeetingsByEngagement(id),
    getParticipantsByEngagement(id),
    getEntityLinksForEntity("engagement", id),
    getAwsRelationshipsByEngagement(id),
  ]);

  // Build message_id → meeting map for inline meeting cards
  // Use plain object since Maps can't be serialized across server→client boundary
  const meetingsByMessageId: Record<string, Meeting> = {};
  for (const m of meetings) {
    if (m.message_id) meetingsByMessageId[m.message_id] = m;
  }

  // Resolve entity link target names
  const nameMap = await resolveEntityLinkNames(entityLinks);

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/engagements"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Engagements
      </Link>

      <DetailHeader
        title={engagement.name}
        badges={<StatusBadge status={engagement.status} />}
        fields={[
          {
            label: "Partner",
            value: engagement.partner_name ? (
              engagement.partner_id ? (
                <Link href={`/partners/${engagement.partner_id}`} className="text-accent hover:underline">
                  {engagement.partner_name}
                </Link>
              ) : (
                engagement.partner_name
              )
            ) : "—",
          },
          { label: "Pillar", value: engagement.pillar ?? "—" },
          { label: "Priority", value: engagement.priority ?? "—" },
          { label: "Updated", value: new Date(engagement.updated_at).toLocaleDateString() },
        ]}
        actions={<EngagementActions engagement={engagement} />}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* CurrentState + Participants side-by-side */}
        <div className="grid gap-6 lg:grid-cols-2">
          {engagement.current_state && (
            <CurrentStateCard text={engagement.current_state} />
          )}
          <ParticipantList participants={participants} engagementId={id} />
        </div>

        <OpenItemsCard
          items={engagement.open_items ?? []}
          engagementId={id}
        />

        <CollapsibleEmails messages={messages} meetingsByMessageId={meetingsByMessageId} />

        {/* AWS Relationships */}
        {awsRelationships.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              AWS Relationships
            </h2>
            <div className="space-y-2">
              {awsRelationships.map((rel) => (
                <CompactRow
                  key={rel.id}
                  href={`/relationships/${rel.id}`}
                  primary={rel.name}
                  badges={<RelationshipTypeBadge type={rel.relationship_type} />}
                  secondary={rel.primary_contact_name ?? undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Entity links */}
        {entityLinks.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Entities
            </h2>
            <div className="flex flex-wrap gap-2">
              {entityLinks.map((link) => {
                const isSource = link.source_id === id;
                const otherId = isSource ? link.target_id : link.source_id;
                const otherType = isSource ? link.target_type : link.source_type;
                const otherName = nameMap.get(otherId);

                // Skip orphaned links (target entity was deleted)
                if (!otherName) return null;

                return (
                  <EntityLinkChip
                    key={link.id}
                    link={link}
                    entityName={otherName}
                    entityId={otherId}
                    entityType={otherType}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Compact footer */}
        <p className="mt-6 text-xs text-muted">
          Created {new Date(engagement.created_at).toLocaleDateString()}
          {" · "}
          Last Updated {new Date(engagement.updated_at).toLocaleDateString()}
          {engagement.closed_at && (engagement.status === "completed" || engagement.status === "archived") && (
            <> · Completed {new Date(engagement.closed_at).toLocaleDateString()}</>
          )}
        </p>
      </div>
    </div>
  );
}
