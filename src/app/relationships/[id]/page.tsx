export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import DetailHeader from "@/components/shared/DetailHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { RelationshipTypeBadge } from "@/components/shared/TypeBadge";
import ExpandableList from "@/components/shared/ExpandableList";
import RelationshipActions from "@/components/actions/RelationshipActions";
import { formatFooterDate } from "@/lib/format-utils";
import {
  getAwsRelationship,
  getEngagementsByAwsRelationship,
} from "@/lib/db";

export default async function RelationshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const relationship = await getAwsRelationship(id);
  if (!relationship) notFound();

  const linkedEngagements = await getEngagementsByAwsRelationship(id);

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

      <DetailHeader
        title={relationship.name}
        badges={<RelationshipTypeBadge type={relationship.relationship_type} />}
        subtitle={relationship.notes ?? undefined}
        fields={[
          { label: "AWS Org", value: relationship.aws_org ?? "—" },
          { label: "AWS Service", value: relationship.aws_service ?? "—" },
          ...(relationship.contacts && relationship.contacts.length > 0
            ? relationship.contacts.map((c, i) => ({
                label: i === 0 ? "Lead Contact" : `Contact ${i + 1}`,
                value: (
                  <span>
                    {c.name ?? "Unknown"}
                    {c.email && c.email !== "—" && (
                      <a href={`mailto:${c.email}`} className="block text-xs text-muted break-all hover:text-accent">
                        {c.email}
                      </a>
                    )}
                  </span>
                ),
              }))
            : [{ label: "Contacts", value: "—" }]),
        ]}
        actions={<RelationshipActions relationship={relationship} />}
      />

      {/* Full-width sections — no sidebar */}
      <div className="space-y-6">

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
          Created {formatFooterDate(relationship.created_at)}
        </p>
      </div>
    </div>
  );
}
