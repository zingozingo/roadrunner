export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { EventTypeBadge } from "@/components/shared/TypeBadge";
import EntityLinkChip from "@/components/shared/EntityLink";
import ExpandableList from "@/components/shared/ExpandableList";
import EventActions from "@/components/actions/EventActions";
import { formatFooterDate } from "@/lib/format-utils";
import {
  getEventById,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
  getLinkedEngagementsForEntity,
} from "@/lib/db";

function formatDateDisplay(start: string | null, end: string | null): string {
  if (!start) return "Date TBD";
  const opts: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-US", opts);
  if (!end) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-US", opts);
  return s === e ? s : `${s} — ${e}`;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEventById(id);
  if (!event) notFound();

  const [entityLinks, linkedEngagements] = await Promise.all([
    getEntityLinksForEntity("event", id),
    getLinkedEngagementsForEntity("event", id),
  ]);
  const nameMap = await resolveEntityLinkNames(entityLinks);

  // Separate non-engagement entity links for EntityLinkChip rendering
  const nonEngagementLinks = entityLinks.filter((link) => {
    const isSource = link.source_id === id;
    const otherType = isSource ? link.target_type : link.source_type;
    return otherType !== "engagement";
  });

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Events
      </Link>

      <DetailHeader
        title={event.name}
        badges={
          <>
            <EventTypeBadge type={event.type} />
            {event.geo && (
              <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted whitespace-nowrap">
                {event.geo}
              </span>
            )}
            {!event.verified && <StatusBadge status="unverified" />}
          </>
        }
        subtitle={event.description ?? undefined}
        fields={[
          { label: "Dates", value: formatDateDisplay(event.start_date, event.end_date) },
          { label: "Location", value: event.location ?? "—" },
          { label: "Host", value: event.host ?? "—" },
          { label: "Source", value: <span className="capitalize">{event.source.replace("_", " ")}</span> },
        ]}
        actions={<EventActions event={event} />}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

        {/* Entity links (non-engagement) */}
        {nonEngagementLinks.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Entities
            </h2>
            <div className="flex flex-wrap gap-2">
              {nonEngagementLinks.map((link) => {
                const isSource = link.source_id === id;
                const otherId = isSource ? link.target_id : link.source_id;
                const otherType = isSource ? link.target_type : link.source_type;
                const otherName = nameMap.get(otherId);

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

        {/* Linked Engagements — status right-aligned */}
        {linkedEngagements.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Engagements
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
                  {eng.partner_name && (
                    <span className="shrink-0 text-xs text-muted">
                      {eng.partner_name}
                    </span>
                  )}
                  <span className="shrink-0">
                    <StatusBadge status={eng.status} />
                  </span>
                </Link>
              ))}
            </ExpandableList>
          </div>
        )}

        {/* Compact footer */}
        <p className="mt-6 text-xs text-muted">
          Created {formatFooterDate(event.created_at)}
          {" · "}
          Source: <span className="capitalize">{event.source.replace("_", " ")}</span>
          {" · "}
          {event.verified ? "Verified" : "Unverified"}
        </p>
      </div>
    </div>
  );
}
