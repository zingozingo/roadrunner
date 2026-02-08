import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import SummaryCard from "@/components/SummaryCard";
import CollapsibleEmails from "@/components/CollapsibleEmails";
import EntityLinkChip from "@/components/EntityLink";
import InitiativeActions from "@/components/InitiativeActions";
import {
  getInitiativeById,
  getMessagesByInitiative,
  getParticipantsByInitiative,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
} from "@/lib/supabase";

export default async function InitiativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const initiative = await getInitiativeById(id);
  if (!initiative) notFound();

  const [messages, participants, entityLinks] = await Promise.all([
    getMessagesByInitiative(id),
    getParticipantsByInitiative(id),
    getEntityLinksForEntity("initiative", id),
  ]);

  // Resolve entity link target names
  const nameMap = await resolveEntityLinkNames(entityLinks);

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/initiatives"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Initiatives
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {initiative.name}
          </h1>
          {initiative.partner_name && (
            <p className="mt-1 text-muted">{initiative.partner_name}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={initiative.status} />
          <InitiativeActions initiative={initiative} />
        </div>
      </div>

      {initiative.summary && (
        <div className="mb-6">
          <SummaryCard summary={initiative.summary} />
        </div>
      )}

      <div className="mb-6">
        <CollapsibleEmails messages={messages} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Entity links */}
          {entityLinks.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Linked Entities
              </h2>
              <div className="flex flex-wrap gap-2">
                {entityLinks.map((link) => {
                  // Determine the "other" entity (not this initiative)
                  const isSource = link.source_id === id;
                  const otherId = isSource ? link.target_id : link.source_id;
                  const otherName = nameMap.get(otherId);

                  return (
                    <EntityLinkChip
                      key={link.id}
                      link={link}
                      entityName={otherName}
                      entityId={otherId}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: participants + metadata */}
        <div className="space-y-4">
          {/* Participants */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Participants ({participants.length})
            </h2>
            {participants.length === 0 ? (
              <p className="text-sm text-muted">None yet</p>
            ) : (
              <ul className="space-y-2">
                {participants.map((p) => (
                  <li key={p.id} className="text-sm">
                    <p className="font-medium text-foreground">
                      {p.name || p.email}
                    </p>
                    {p.organization && (
                      <p className="text-xs text-muted">{p.organization}</p>
                    )}
                    {p.role && (
                      <p className="text-xs text-accent">{p.role}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Details
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(initiative.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last Updated</dt>
                <dd className="text-foreground">
                  {new Date(initiative.updated_at).toLocaleDateString()}
                </dd>
              </div>
              {initiative.closed_at && (
                <div>
                  <dt className="text-muted">Closed</dt>
                  <dd className="text-foreground">
                    {new Date(initiative.closed_at).toLocaleDateString()}
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
