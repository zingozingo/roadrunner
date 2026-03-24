"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { Relationship, RelationshipType } from "@/lib/types";
import { isNamedRole } from "@/lib/contact-display";

type RelationshipWithCount = Relationship & { linked_count: number };

interface RelationshipContact {
  name: string | null;
  role: string | null;
}

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
  contactsByRelationship: Record<string, RelationshipContact[]>;
}

/** Find the best "lead" contact for a relationship from registry data */
function findLeadContact(contacts: RelationshipContact[]): string | null {
  if (!contacts || contacts.length === 0) return null;
  // Prefer contact with a named AT role containing "Lead"
  const lead = contacts.find((c) => c.role && /lead/i.test(c.role));
  if (lead?.name) return lead.name;
  // Fall back to first contact with a named role
  const named = contacts.find((c) => isNamedRole(c.role));
  if (named?.name) return named.name;
  // Fall back to first contact with a name
  const any = contacts.find((c) => c.name);
  return any?.name ?? null;
}

export default function RelationshipsClient({ relationships, contactsByRelationship }: RelationshipsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredRelationships = useMemo(() => {
    return relationships.filter((rel) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = rel.name.toLowerCase().includes(q);
        const matchesOrg = rel.org?.toLowerCase().includes(q);
        const matchesService = rel.service?.toLowerCase().includes(q);
        const leadName = findLeadContact(contactsByRelationship[rel.id] ?? []);
        const matchesContact = leadName?.toLowerCase().includes(q);
        if (!matchesName && !matchesOrg && !matchesService && !matchesContact) return false;
      }
      if (activeFilter && rel.relationship_type !== activeFilter) {
        return false;
      }
      return true;
    });
  }, [relationships, contactsByRelationship, searchQuery, activeFilter]);

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
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
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
              {grouped.map((group) => {
                const defaultOpen = !!searchQuery || group.relationships.length < 10;
                return (
                  <details
                    key={group.type}
                    open={defaultOpen || undefined}
                    className="group"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-2 pb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted/70 [&::-webkit-details-marker]:hidden">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 transition-transform group-open:rotate-90">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      {group.type}s
                      <span className="font-normal text-muted/50">{group.relationships.length}</span>
                    </summary>
                    <div>
                      {group.relationships.map((rel) => (
                        <Link
                          key={rel.id}
                          href={`/relationships/${rel.id}`}
                          className="flex items-baseline gap-4 border-b border-border/20 px-3 py-2.5 transition-colors hover:bg-surface/50"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {rel.name}
                          </span>
                          {rel.org && (
                            <span className="shrink-0 text-xs text-muted">
                              {rel.org}
                            </span>
                          )}
                          {(() => {
                            const leadName = findLeadContact(contactsByRelationship[rel.id] ?? []);
                            return leadName ? (
                              <span className="shrink-0 text-xs text-muted">
                                {leadName}
                              </span>
                            ) : null;
                          })()}
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
