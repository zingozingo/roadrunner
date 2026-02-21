"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import { RelationshipTypeBadge } from "@/components/shared/TypeBadge";
import FilterBar from "@/components/layout/FilterBar";
import SyncButton from "@/components/shared/SyncButton";
import CompactRow from "@/components/shared/CompactRow";
import { AwsRelationship, RelationshipType } from "@/lib/types";

type RelationshipWithCount = AwsRelationship & { linked_count: number };

const TYPE_ORDER: RelationshipType[] = [
  "Exec/Leader",
  "Product Team",
  "Program Team",
  "Seller",
];

const TYPE_FILTER_OPTIONS = TYPE_ORDER.map((t) => ({
  label: t,
  value: t,
}));

interface RelationshipsClientProps {
  relationships: RelationshipWithCount[];
}

export default function RelationshipsClient({ relationships }: RelationshipsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredRelationships = useMemo(() => {
    return relationships.filter((rel) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = rel.name.toLowerCase().includes(q);
        const matchesOrg = rel.aws_org?.toLowerCase().includes(q);
        const matchesService = rel.aws_service?.toLowerCase().includes(q);
        const matchesContact = rel.primary_contact_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesOrg && !matchesService && !matchesContact) return false;
      }
      // Type filter
      if (activeFilter && rel.relationship_type !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [relationships, searchQuery, activeFilter]);

  // Group by relationship_type
  const grouped = useMemo(() => {
    const groups: { type: RelationshipType; relationships: RelationshipWithCount[] }[] = [];

    for (const type of TYPE_ORDER) {
      const items = filteredRelationships
        .filter((r) => r.relationship_type === type)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (items.length > 0) {
        groups.push({ type, relationships: items });
      }
    }

    // Uncategorized (null type)
    const uncategorized = filteredRelationships
      .filter((r) => !r.relationship_type)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (uncategorized.length > 0) {
      groups.push({ type: "Seller" as RelationshipType, relationships: uncategorized });
    }

    return groups;
  }, [filteredRelationships]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Relationships"
          subtitle={`${relationships.length} AWS relationship${relationships.length !== 1 ? "s" : ""} tracked`}
        />
        <SyncButton entity="relationships" label="Sync Relationships" compact />
      </div>

      {relationships.length === 0 ? (
        <EmptyState
          title="No relationships yet"
          description="AWS relationships will appear when synced from Airtable"
        />
      ) : (
        <>
          <FilterBar
            searchPlaceholder="Search relationships..."
            filterOptions={TYPE_FILTER_OPTIONS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filteredRelationships.length}
            totalCount={relationships.length}
            entityName="relationships"
          />

          {filteredRelationships.length === 0 ? (
            <EmptyState
              title="No matching relationships"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {grouped.map((group) => (
                <section key={group.type}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                      {group.type}s
                    </h2>
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                      {group.relationships.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.relationships.map((rel) => (
                      <CompactRow
                        key={rel.id}
                        href={`/relationships/${rel.id}`}
                        primary={rel.name}
                        badges={<RelationshipTypeBadge type={rel.relationship_type} />}
                        secondary={
                          [rel.aws_org, rel.aws_service].filter(Boolean).join(" · ") || undefined
                        }
                        meta={
                          rel.linked_count > 0 ? (
                            <span>{rel.linked_count} link{rel.linked_count !== 1 ? "s" : ""}</span>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
