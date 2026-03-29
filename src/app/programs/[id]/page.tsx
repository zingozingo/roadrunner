export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramTypeBadge } from "@/components/shared/TypeBadge";
import ProgramActions from "@/components/actions/ProgramActions";
import { formatFooterDate } from "@/lib/format-utils";
import { getProgramById } from "@/lib/db";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const program = await getProgramById(id);
  if (!program) notFound();

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

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
        <h1 className="text-xl font-semibold text-foreground">{program.name}</h1>
        <ProgramTypeBadge type={program.type} />
        <div className="ml-auto">
          <ProgramActions program={program} />
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="space-y-8">

        {/* Description */}
        {program.description && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Description</h2>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {program.description}
            </p>
          </section>
        )}

        {/* Requirements */}
        {program.requirements && (
          <section className="pt-6 border-t border-border/20">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Requirements</h2>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {program.requirements}
            </p>
          </section>
        )}

        {/* What It Unlocks */}
        {program.what_it_unlocks && (
          <section className="pt-6 border-t border-border/20">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">What It Unlocks</h2>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {program.what_it_unlocks}
            </p>
          </section>
        )}

        {/* Lifecycle */}
        {(program.lifecycle_type || program.lifecycle_duration) && (
          <section className="pt-6 border-t border-border/20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Lifecycle</h2>
            <div className="flex gap-8">
              {program.lifecycle_type && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Type</span>
                  <span className="text-sm text-foreground capitalize">{program.lifecycle_type}</span>
                </div>
              )}
              {program.lifecycle_duration && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Duration</span>
                  <span className="text-sm text-foreground">{program.lifecycle_duration}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <p className="pt-6 text-xs text-muted">
          Created {formatFooterDate(program.created_at)}
        </p>
      </div>
    </div>
  );
}
