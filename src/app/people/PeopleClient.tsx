"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";

interface PersonResult {
  id: string;
  name: string | null;
  email: string | null;
  title: string | null;
  organization: string | null;
  org_type: string | null;
  partners: { id: string; name: string; role: string | null; source: "curated" | "engagement" }[];
}

const ORG_TYPE_FILTERS = [
  { label: "All", value: null },
  { label: "AWS Team", value: "internal" },
  { label: "Partner", value: "partner" },
  { label: "Third Party", value: "third_party" },
];

const ORG_TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  internal: { label: "AWS", cls: "bg-accent/10 text-accent" },
  partner: { label: "Partner", cls: "bg-status-active/10 text-status-active" },
  third_party: { label: "3rd Party", cls: "bg-status-completed/10 text-status-completed" },
};

const ORG_TYPE_OPTIONS = [
  { label: "AWS Team", value: "internal" },
  { label: "Partner", value: "partner" },
  { label: "Third Party", value: "third_party" },
];

const ROLE_OPTIONS = [
  "Alliance Lead", "PSA", "Account Manager", "PMM",
  "Contact", "AWS Contact", "CRM Contact", "Third Party",
];

interface PeopleClientProps {
  partners: { id: string; name: string }[];
}

export default function PeopleClient({ partners }: PeopleClientProps) {
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState<string | null>(null);
  const [partnerFilter, setPartnerFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ id: string; name: string; email: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formOrg, setFormOrg] = useState("");
  const [formOrgType, setFormOrgType] = useState("");
  const [formPartnerId, setFormPartnerId] = useState("");
  const [formRole, setFormRole] = useState("");

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (orgTypeFilter) params.set("org_type", orgTypeFilter);
      if (partnerFilter) params.set("partner_id", partnerFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/people?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPeople(data.people);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch people:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, orgTypeFilter, partnerFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchPeople, 200);
    return () => clearTimeout(timer);
  }, [fetchPeople]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    setSubmitting(true);
    setFormError(null);
    setDuplicateInfo(null);

    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          title: formTitle.trim() || null,
          organization: formOrg.trim() || null,
          org_type: formOrgType || null,
          partner_id: formPartnerId || null,
          role: formRole || null,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setFormError(data.error);
        if (data.existing) setDuplicateInfo(data.existing);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create person");
      }

      // Success — reset form and refresh
      setFormName("");
      setFormEmail("");
      setFormTitle("");
      setFormOrg("");
      setFormOrgType("");
      setFormPartnerId("");
      setFormRole("");
      setShowForm(false);
      fetchPeople();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create person");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedPartners = [...partners].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">People</h1>
          <p className="text-sm text-muted mt-1">
            {total} {total === 1 ? "person" : "people"} across all partners
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormError(null); setDuplicateInfo(null); }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Person"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-border/50 bg-surface p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  placeholder="Job title"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Organization</label>
                <input
                  type="text"
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  placeholder="Company name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Type</label>
                <select
                  value={formOrgType}
                  onChange={(e) => setFormOrgType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">Select type...</option>
                  {ORG_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted/60 mb-1">Partner</label>
                <select
                  value={formPartnerId}
                  onChange={(e) => setFormPartnerId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">No partner link</option>
                  {sortedPartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {formPartnerId && (
                <div>
                  <label className="block text-[10px] font-medium text-muted/60 mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  >
                    <option value="">Select role...</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {formError && (
              <div className="text-sm text-red-400">
                {formError}
                {duplicateInfo && (
                  <span className="ml-2 text-muted">
                    ({duplicateInfo.name} — {duplicateInfo.email})
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !formName.trim() || !formEmail.trim()}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Person"}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, organization, or title..."
            className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted/40"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        {/* Org type pills */}
        <div className="flex items-center gap-1.5">
          {ORG_TYPE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setOrgTypeFilter(f.value)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                orgTypeFilter === f.value
                  ? "bg-accent text-white"
                  : "bg-surface border border-border/50 text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Partner dropdown */}
        <select
          value={partnerFilter}
          onChange={(e) => setPartnerFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
        >
          <option value="">All partners</option>
          {sortedPartners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-muted">
          {people.length}{total > people.length ? ` of ${total}` : ""} results
        </span>
      </div>

      {/* Results */}
      {loading ? (
        <p className="text-sm text-muted py-8 text-center">Loading...</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-muted/60 py-8 text-center">
          {searchQuery || orgTypeFilter || partnerFilter
            ? "No people match your search"
            : "No people in the system yet"}
        </p>
      ) : (
        <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
          {people.map((person, i) => {
            const badge = person.org_type ? ORG_TYPE_BADGES[person.org_type] : null;

            return (
              <div
                key={person.id}
                className={`px-4 py-3 transition-colors hover:bg-surface-hover ${
                  i < people.length - 1 ? "border-b border-border/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Name + email */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {person.name ?? "Unknown"}
                      </span>
                      {badge && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {person.email && (
                        <span className="text-xs text-muted/60 truncate">{person.email}</span>
                      )}
                      {person.title && (
                        <span className="text-xs text-muted/40 truncate">{person.title}</span>
                      )}
                      {person.organization && (
                        <span className="text-xs text-muted/40 truncate">{person.organization}</span>
                      )}
                    </div>
                  </div>

                  {/* Partner connections */}
                  <div className="shrink-0 flex items-center gap-2">
                    {person.partners.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        href={`/partners/${p.id}`}
                        className={`text-xs whitespace-nowrap transition-colors ${
                          p.source === "curated"
                            ? "text-accent hover:underline"
                            : "text-muted/50 hover:text-muted/70"
                        }`}
                        title={
                          p.source === "curated"
                            ? (p.role ? `${p.name} (${p.role})` : p.name)
                            : `${p.name} (via engagement)`
                        }
                      >
                        {p.name}
                      </Link>
                    ))}
                    {person.partners.length > 3 && (
                      <span className="text-[10px] text-muted/40">
                        +{person.partners.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
