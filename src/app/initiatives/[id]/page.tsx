import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import CurrentStateCard from "@/components/CurrentStateCard";
import OpenItemsCard from "@/components/OpenItemsCard";
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

  // Use current_state if available, fall back to summary for backward compat
  const displayState = initiative.current_state ?? initiative.summary;

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

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Left column: state, timeline, open items, emails, entity links */}
        <div className="lg:col-span-2 space-y-6">
          {displayState && (
            <CurrentStateCard text={displayState} />
          )}

          {/* TODO: Phase 4 — TimelineCard removed (timeline_entries eliminated from data model) */}

          <OpenItemsCard
            items={initiative.open_items ?? []}
            initiativeId={id}
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

        {/* Right column: participants + metadata (sticky sidebar) */}
        <div className="mt-6 lg:mt-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
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
                      {p.name || p.email || "Unknown"}
                    </p>
                    {p.organization && (
                      <p className="text-xs text-muted">{p.organization}</p>
                    )}
                    {p.role && p.role !== "forwarder" && (
                      <p className="text-xs text-accent">{p.role}</p>
                    )}
                    {p.role === "forwarder" && (
                      <p className="text-xs text-muted italic">You</p>
                    )}
                    {!p.email && (
                      <p className="text-xs text-muted/50">No email</p>
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
