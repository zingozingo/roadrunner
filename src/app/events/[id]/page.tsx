export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import EntityLinkChip from "@/components/EntityLink";
import EventActions from "@/components/EventActions";
import {
  getEventById,
  getLinkedInitiativesForEntity,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
} from "@/lib/supabase";
import { Event } from "@/lib/types";

const typeColors: Record<Event["type"], string> = {
  conference: "bg-[var(--event-conference)]/20 text-[var(--event-conference)]",
  summit: "bg-[var(--event-summit)]/20 text-[var(--event-summit)]",
  workshop: "bg-[var(--event-workshop)]/20 text-[var(--event-workshop)]",
  kickoff: "bg-[var(--event-kickoff)]/20 text-[var(--event-kickoff)]",
  trade_show: "bg-[var(--event-trade-show)]/20 text-[var(--event-trade-show)]",
  deadline: "bg-[var(--event-deadline)]/20 text-[var(--event-deadline)]",
  review_cycle: "bg-[var(--event-review-cycle)]/20 text-[var(--event-review-cycle)]",
  training: "bg-[var(--event-training)]/20 text-[var(--event-training)]",
};

function formatDateDisplay(event: Event): string {
  if (!event.start_date) return "No date set";

  const start = new Date(event.start_date);

  switch (event.date_precision) {
    case "quarter": {
      const q = Math.ceil((start.getMonth() + 1) / 3);
      return `Q${q} ${start.getFullYear()}`;
    }
    case "month":
      return start.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    case "week": {
      const weekEnd = new Date(start);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `Week of ${start.toLocaleDateString()}`;
    }
    default: {
      const s = start.toLocaleDateString();
      if (!event.end_date) return s;
      const e = new Date(event.end_date).toLocaleDateString();
      return s === e ? s : `${s} — ${e}`;
    }
  }
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEventById(id);
  if (!event) notFound();

  const [linkedInitiatives, entityLinks] = await Promise.all([
    getLinkedInitiativesForEntity("event", id),
    getEntityLinksForEntity("event", id),
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {event.name}
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                typeColors[event.type] ?? "bg-border text-muted"
              }`}
            >
              {event.type.replace("_", " ")}
            </span>
            {!event.verified && <StatusBadge status="unverified" />}
          </div>
          <p className="mt-1 text-muted">{formatDateDisplay(event)}</p>
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

          {/* Linked initiatives */}
          {linkedInitiatives.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Linked Initiatives ({linkedInitiatives.length})
              </h2>
              <ul className="space-y-2">
                {linkedInitiatives.map((init) => (
                  <li key={init.id}>
                    <Link
                      href={`/initiatives/${init.id}`}
                      className="group flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-background"
                    >
                      <span className="text-sm font-medium text-foreground group-hover:text-accent">
                        {init.name}
                      </span>
                      <StatusBadge status={init.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar: metadata */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Details
            </h2>
            <dl className="space-y-2 text-sm">
              {event.location && (
                <div>
                  <dt className="text-muted">Location</dt>
                  <dd className="text-foreground">{event.location}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Date Precision</dt>
                <dd className="text-foreground capitalize">{event.date_precision}</dd>
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
