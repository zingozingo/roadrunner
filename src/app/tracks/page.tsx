export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { getAllProgramsWithCounts } from "@/lib/supabase";

export default async function TracksPage() {
  const tracks = await getAllProgramsWithCounts();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Tracks"
        subtitle={`${tracks.length} track${tracks.length !== 1 ? "s" : ""} tracked`}
      />

      {tracks.length === 0 ? (
        <EmptyState
          title="No tracks yet"
          description="Tracks will appear as they are extracted from emails"
        />
      ) : (
        <div className="space-y-3">
          {tracks.map((track) => (
            <Link
              key={track.id}
              href={`/tracks/${track.id}`}
              className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">
                      {track.name}
                    </h3>
                    <StatusBadge status={track.status} />
                  </div>
                  {track.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {track.description}
                    </p>
                  )}
                </div>
                {track.linked_count > 0 && (
                  <span className="shrink-0 text-xs text-muted">
                    {track.linked_count} link{track.linked_count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                {track.eligibility && (
                  <span>Eligibility: {track.eligibility}</span>
                )}
                {track.url && (
                  <span className="text-accent">
                    Has external link
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
