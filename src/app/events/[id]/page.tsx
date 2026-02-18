export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/shared/StatusBadge";
import { EventTypeBadge, MeetingStatusBadge } from "@/components/shared/TypeBadge";
import EntityLinkChip from "@/components/shared/EntityLink";
import EventActions from "@/components/actions/EventActions";
import {
  getEventById,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
  getMeetingsByEvent,
} from "@/lib/supabase";

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

  const [entityLinks, linkedMeetings] = await Promise.all([
    getEntityLinksForEntity("event", id),
    getMeetingsByEvent(id),
  ]);
  const nameMap = await resolveEntityLinkNames(entityLinks);

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

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {event.name}
            </h1>
            <EventTypeBadge type={event.type} />
            {!event.verified && <StatusBadge status="unverified" />}
          </div>
          <p className="mt-1 text-muted">
            {formatDateDisplay(event.start_date, event.end_date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EventActions event={event} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {event.description && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Description
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {event.description}
              </p>
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

          {/* Linked Meetings */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Meetings
            </h2>
            {linkedMeetings.length === 0 ? (
              <p className="text-sm text-muted">No linked meetings yet</p>
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
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      {mtg.meeting_date && (
                        <span>{new Date(mtg.meeting_date + "T00:00:00").toLocaleDateString()}</span>
                      )}
                      {mtg.partner_name && <span>{mtg.partner_name}</span>}
                      {mtg.meeting_type && <span>{mtg.meeting_type}</span>}
                    </div>
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
              <div>
                <dt className="text-muted">Type</dt>
                <dd className="text-foreground capitalize">{event.type.replace("_", " ")}</dd>
              </div>
              {event.host && (
                <div>
                  <dt className="text-muted">Host</dt>
                  <dd className="text-foreground">{event.host}</dd>
                </div>
              )}
              {event.location && (
                <div>
                  <dt className="text-muted">Location</dt>
                  <dd className="text-foreground">{event.location}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Dates</dt>
                <dd className="text-foreground">
                  {formatDateDisplay(event.start_date, event.end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Source</dt>
                <dd className="text-foreground capitalize">{event.source.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-muted">Verified</dt>
                <dd className="text-foreground">{event.verified ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(event.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
