export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import CurrentStateCard from "@/components/CurrentStateCard";
import OpenItemsCard from "@/components/OpenItemsCard";
import CollapsibleEmails from "@/components/CollapsibleEmails";
import EntityLinkChip from "@/components/EntityLink";
import EngagementActions from "@/components/EngagementActions";
import ParticipantList from "@/components/ParticipantList";
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

  // Use current_state if available, fall back to summary for backward compat
  const displayState = engagement.current_state ?? engagement.summary;

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

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {engagement.name}
          </h1>
          {engagement.partner_name && (
            <p className="mt-1 text-muted">{engagement.partner_name}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={engagement.status} />
          <EngagementActions engagement={engagement} />
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Left column: state, open items, emails, entity links */}
        <div className="lg:col-span-2 space-y-6">
          {displayState && (
            <CurrentStateCard text={displayState} />
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
              {engagement.closed_at && (
                <div>
                  <dt className="text-muted">Closed</dt>
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
