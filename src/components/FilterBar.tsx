"use client";

import { useState } from "react";

interface FilterOption {
  label: string;
  value: string;
  color?: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  filterOptions: FilterOption[];
  activeFilters: Set<string>;
  onSearchChange: (query: string) => void;
  onFilterToggle: (value: string) => void;
  resultCount: number;
  totalCount: number;
  entityName?: string;
}

export default function FilterBar({
  searchPlaceholder = "Search...",
  filterOptions,
  activeFilters,
  onSearchChange,
  onFilterToggle,
  resultCount,
  totalCount,
  entityName = "items",
}: FilterBarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearch(value: string) {
    setSearchQuery(value);
    onSearchChange(value);
  }

  const allActive = activeFilters.size === 0;

  return (
    <div className="mb-6 space-y-3">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            // Clear all filters
            for (const f of activeFilters) {
              onFilterToggle(f);
            }
          }}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            allActive
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-background text-muted hover:text-foreground"
          }`}
        >
          All
        </button>
        {filterOptions.map((opt) => {
          const isActive = activeFilters.has(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onFilterToggle(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted">
          {resultCount === totalCount
            ? `${totalCount} ${entityName}`
            : `${resultCount} of ${totalCount} ${entityName}`}
        </span>
      </div>
    </div>
  );
}
