export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import CurrentStateCard from "@/components/engagement/CurrentStateCard";
import OpenItemsCard from "@/components/engagement/OpenItemsCard";
import CollapsibleEmails from "@/components/shared/CollapsibleEmails";
import EntityLinkChip from "@/components/shared/EntityLink";
import EngagementActions from "@/components/actions/EngagementActions";
import ParticipantList from "@/components/shared/ParticipantList";
import {
  getEngagementById,
  getMessagesByEngagement,
  getParticipantsByEngagement,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
} from "@/lib/supabase";

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const engagement = await getEngagementById(id);
  if (!engagement) notFound();

  const [messages, participants, entityLinks] = await Promise.all([
    getMessagesByEngagement(id),
    getParticipantsByEngagement(id),
    getEntityLinksForEntity("engagement", id),
  ]);

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

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Left column: state, open items, emails, entity links */}
        <div className="lg:col-span-2 space-y-6">
          {engagement.current_state && (
            <CurrentStateCard text={engagement.current_state} />
          )}

          <OpenItemsCard
            items={engagement.open_items ?? []}
            engagementId={id}
          />

          <CollapsibleEmails messages={messages} />

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
        </div>

        {/* Right column: participants + metadata (sticky sidebar) */}
        <div className="mt-6 lg:mt-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <ParticipantList participants={participants} engagementId={id} />

          {/* Metadata */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Details
            </h2>
            <dl className="space-y-2 text-sm">
              {engagement.pillar && (
                <div>
                  <dt className="text-muted">Pillar</dt>
                  <dd className="text-foreground">{engagement.pillar}</dd>
                </div>
              )}
              {engagement.priority && (
                <div>
                  <dt className="text-muted">Priority</dt>
                  <dd className="text-foreground">{engagement.priority}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(engagement.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last Updated</dt>
                <dd className="text-foreground">
                  {new Date(engagement.updated_at).toLocaleDateString()}
                </dd>
              </div>
              {engagement.closed_at && (engagement.status === "completed" || engagement.status === "archived") && (
                <div>
                  <dt className="text-muted">Completed</dt>
                  <dd className="text-foreground">
                    {new Date(engagement.closed_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
