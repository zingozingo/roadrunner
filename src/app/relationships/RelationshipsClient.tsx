"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { RelationshipTypeBadge, StrengthBadge } from "@/components/TypeBadge";
import FilterBar from "@/components/FilterBar";
import SyncButton from "@/components/SyncButton";
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
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  function handleFilterToggle(value: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

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
      if (activeFilters.size > 0 && rel.relationship_type && !activeFilters.has(rel.relationship_type)) {
        return false;
      }
      if (activeFilters.size > 0 && !rel.relationship_type) {
        return false;
      }
      return true;
    });
  }, [relationships, searchQuery, activeFilters]);

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
            activeFilters={activeFilters}
            onSearchChange={setSearchQuery}
            onFilterToggle={handleFilterToggle}
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
                      <Link
                        key={rel.id}
                        href={`/relationships/${rel.id}`}
                        className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground">
                                {rel.name}
                              </h3>
                              <RelationshipTypeBadge type={rel.relationship_type} />
                              <StrengthBadge strength={rel.strength} />
                            </div>
                            <p className="mt-1 text-sm text-muted">
                              {[rel.aws_org, rel.aws_service]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          {rel.linked_count > 0 && (
                            <span className="shrink-0 text-xs text-muted">
                              {rel.linked_count} link{rel.linked_count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {rel.primary_contact_name && (
                          <p className="mt-2 text-xs text-muted">
                            Contact: {rel.primary_contact_name}
                            {rel.primary_contact_email && ` (${rel.primary_contact_email})`}
                          </p>
                        )}
                      </Link>
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
