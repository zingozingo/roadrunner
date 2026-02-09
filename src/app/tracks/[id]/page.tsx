export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import EntityLinkChip from "@/components/EntityLink";
import TrackActions from "@/components/TrackActions";
import {
  getTrackById,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
} from "@/lib/supabase";

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const track = await getTrackById(id);
  if (!track) notFound();

  const entityLinks = await getEntityLinksForEntity("program", id);

  const nameMap = await resolveEntityLinkNames(entityLinks);

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/tracks"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Tracks
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {track.name}
          </h1>
          {track.eligibility && (
            <p className="mt-1 text-muted">Eligibility: {track.eligibility}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={track.status} />
          <TrackActions track={track} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {track.description && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Description
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {track.description}
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

        </div>

        {/* Sidebar: metadata */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Details
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Status</dt>
                <dd className="text-foreground capitalize">{track.status}</dd>
              </div>
              {track.url && (
                <div>
                  <dt className="text-muted">External Link</dt>
                  <dd>
                    <a
                      href={track.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline break-all"
                    >
                      {track.url}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(track.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
