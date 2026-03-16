export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { RelationshipTypeBadge } from "@/components/shared/TypeBadge";
import PillarBadge from "@/components/shared/PillarBadge";
import RelationshipActions from "@/components/actions/RelationshipActions";
import { formatFooterDate } from "@/lib/format-utils";
import {
  getRelationship,
  getEngagementsByRelationship,
  getContactsByRelationship,
} from "@/lib/db";

// Status dot color map
const statusDotColor: Record<string, string> = {
  active: "bg-emerald-500",
  planned: "bg-blue-400",
  blocked: "bg-amber-500",
  completed: "bg-violet-500",
  archived: "bg-zinc-500",
};

export default async function RelationshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const relationship = await getRelationship(id);
  if (!relationship) notFound();

  const [linkedEngagements, contacts] = await Promise.all([
    getEngagementsByRelationship(id),
    getContactsByRelationship(id),
  ]);

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/relationships"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back to Relationships
      </Link>

      {/* ═══ IDENTITY BAR ═══ */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border/30">
        <h1 className="text-xl font-semibold text-foreground">{relationship.name}</h1>
        <RelationshipTypeBadge type={relationship.relationship_type} />
        <div className="ml-auto">
          <RelationshipActions relationship={relationship} />
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="space-y-8">

        {/* Notes */}
        {relationship.notes && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Notes</h2>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {relationship.notes}
            </p>
          </section>
        )}

        {/* Contacts */}
        {contacts.length > 0 && (
          <section className={relationship.notes ? "pt-6 border-t border-border/20" : ""}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Contacts
              <span className="ml-1.5 font-normal text-muted/50">{contacts.length}</span>
            </h2>
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <div key={i}>
                  <div className="text-sm text-foreground">
                    <span className="font-medium">{c.name ?? "Unknown"}</span>
                    {c.role && <span className="text-xs text-muted ml-1.5">{c.role}</span>}
                  </div>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-[11px] text-accent/70 hover:text-accent">
                      {c.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Linked Engagements */}
        {linkedEngagements.length > 0 && (
          <section className="pt-6 border-t border-border/20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Linked engagements
              <span className="ml-1.5 font-normal text-muted/50">{linkedEngagements.length}</span>
            </h2>
            <div className="space-y-1.5">
              {linkedEngagements.map((eng) => {
                const dotColor = statusDotColor[eng.status] ?? "bg-zinc-500";
                return (
                  <Link
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    className="flex items-center gap-3 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {eng.name}
                    </span>
                    {eng.partner_name && (
                      <span className="shrink-0 text-xs text-muted">{eng.partner_name}</span>
                    )}
                    {eng.pillar && (
                      <span className="shrink-0">
                        <PillarBadge pillar={eng.pillar} />
                      </span>
                    )}
                    <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${dotColor}`} title={eng.status} />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Details */}
        {(relationship.org || relationship.service) && (
          <section className="pt-6 border-t border-border/20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Details</h2>
            <div className="flex gap-8">
              {relationship.org && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">AWS Org</span>
                  <span className="text-sm text-foreground">{relationship.org}</span>
                </div>
              )}
              {relationship.service && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">AWS Service</span>
                  <span className="text-sm text-foreground">{relationship.service}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <p className="pt-6 text-xs text-muted">
          Created {formatFooterDate(relationship.created_at)}
        </p>
      </div>
    </div>
  );
}
