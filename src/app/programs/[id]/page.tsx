export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { ProgramTypeBadge } from "@/components/TypeBadge";
import EntityLinkChip from "@/components/EntityLink";
import ProgramActions from "@/components/ProgramActions";
import {
  getProgramById,
  getEntityLinksForEntity,
  resolveEntityLinkNames,
} from "@/lib/supabase";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const program = await getProgramById(id);
  if (!program) notFound();

  const entityLinks = await getEntityLinksForEntity("program", id);
  const nameMap = await resolveEntityLinkNames(entityLinks);

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/programs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Programs
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {program.name}
            </h1>
            <StatusBadge status={program.status} />
            <ProgramTypeBadge type={program.type} />
          </div>
          {program.eligibility && (
            <p className="mt-1 text-sm text-muted">Requirements: {program.eligibility}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ProgramActions program={program} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {program.description && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Description
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {program.description}
              </p>
            </div>
          )}

          {/* Eligibility */}
          {program.eligibility && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Requirements
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {program.eligibility}
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
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Status</dt>
                <dd className="text-foreground capitalize">{program.status}</dd>
              </div>
              {program.type && (
                <div>
                  <dt className="text-muted">Type</dt>
                  <dd className="text-foreground">{program.type}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Lifecycle Type</dt>
                <dd className="text-foreground capitalize">{program.lifecycle_type}</dd>
              </div>
              {program.lifecycle_duration && (
                <div>
                  <dt className="text-muted">Lifecycle Duration</dt>
                  <dd className="text-foreground">{program.lifecycle_duration}</dd>
                </div>
              )}
              {program.url && (
                <div>
                  <dt className="text-muted">External Link</dt>
                  <dd>
                    <a
                      href={program.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline break-all"
                    >
                      {program.url}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(program.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
