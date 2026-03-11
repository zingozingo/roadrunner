"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
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
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = rel.name.toLowerCase().includes(q);
        const matchesOrg = rel.aws_org?.toLowerCase().includes(q);
        const matchesService = rel.aws_service?.toLowerCase().includes(q);
        const matchesContact = rel.contacts?.[0]?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesOrg && !matchesService && !matchesContact) return false;
      }
      if (activeFilter && rel.relationship_type !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [relationships, searchQuery, activeFilter]);

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
      <PageHeader
        title="Relationships"
        subtitle={`${relationships.length} AWS relationship${relationships.length !== 1 ? "s" : ""} tracked`}
      />

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
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {group.type}s
                    <span className="ml-2 text-sm font-normal text-muted">
                      ({group.relationships.length})
                    </span>
                  </h2>
                  {group.relationships.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/relationships/${rel.id}`}
                      className="flex items-baseline gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {rel.name}
                      </span>
                      {rel.aws_org && (
                        <span className="shrink-0 text-xs text-muted">
                          {rel.aws_org}
                        </span>
                      )}
                      {rel.contacts?.[0]?.name && (
                        <span className="shrink-0 text-xs text-muted">
                          {rel.contacts[0].name}
                        </span>
                      )}
                    </Link>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
