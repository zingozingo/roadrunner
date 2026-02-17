export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { RelationshipTypeBadge, StrengthBadge } from "@/components/TypeBadge";
import StatusBadge from "@/components/StatusBadge";
import RelationshipActions from "@/components/RelationshipActions";
import {
  getAwsRelationship,
  getEngagementsByAwsRelationship,
} from "@/lib/supabase";

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

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {relationship.name}
            </h1>
            <RelationshipTypeBadge type={relationship.relationship_type} />
            <StrengthBadge strength={relationship.strength} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RelationshipActions relationship={relationship} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Notes */}
          {relationship.notes && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                Notes
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {relationship.notes}
              </p>
            </div>
          )}

          {/* Linked Engagements */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Linked Engagements
            </h2>
            {linkedEngagements.length === 0 ? (
              <p className="text-sm text-muted">No engagements linked yet</p>
            ) : (
              <div className="space-y-2">
                {linkedEngagements.map((eng) => (
                  <Link
                    key={eng.id}
                    href={`/engagements/${eng.id}`}
                    className="block rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {eng.name}
                      </span>
                      <StatusBadge status={eng.status} />
                    </div>
                    {eng.partner_name && (
                      <p className="mt-0.5 text-xs text-muted">
                        {eng.partner_name}
                      </p>
                    )}
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
              {relationship.relationship_type && (
                <div>
                  <dt className="text-muted">Type</dt>
                  <dd className="text-foreground">{relationship.relationship_type}</dd>
                </div>
              )}
              {relationship.aws_org && (
                <div>
                  <dt className="text-muted">AWS Org</dt>
                  <dd className="text-foreground">{relationship.aws_org}</dd>
                </div>
              )}
              {relationship.aws_service && (
                <div>
                  <dt className="text-muted">AWS Service</dt>
                  <dd className="text-foreground">{relationship.aws_service}</dd>
                </div>
              )}
              {relationship.strength && (
                <div>
                  <dt className="text-muted">Strength</dt>
                  <dd className="text-foreground">{relationship.strength}</dd>
                </div>
              )}
              {relationship.primary_contact_name && (
                <div>
                  <dt className="text-muted">Primary Contact</dt>
                  <dd className="text-foreground">{relationship.primary_contact_name}</dd>
                </div>
              )}
              {relationship.primary_contact_email && (
                <div>
                  <dt className="text-muted">Contact Email</dt>
                  <dd className="text-foreground break-all">{relationship.primary_contact_email}</dd>
                </div>
              )}
              {relationship.aws_contact_emails.length > 0 && (
                <div>
                  <dt className="text-muted">AWS Contacts</dt>
                  <dd className="text-foreground break-all">
                    {relationship.aws_contact_emails.join(", ")}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted">Created</dt>
                <dd className="text-foreground">
                  {new Date(relationship.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
