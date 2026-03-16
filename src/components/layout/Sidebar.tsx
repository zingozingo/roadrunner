"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  showBadge?: boolean;
}

// — Review: what needs attention
const reviewItems: NavItem[] = [
  {
    href: "/inbox",
    label: "Inbox",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="16" height="14" rx="2" />
        <path d="M2 10h5l2 3h2l2-3h5" />
      </svg>
    ),
    showBadge: true,
  },
];

// — Work: core portfolio views
const workItems: NavItem[] = [
  {
    href: "/partners",
    label: "Partners",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />
      </svg>
    ),
  },
  {
    href: "/engagements",
    label: "Engagements",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 5h12M4 10h12M4 15h8" />
      </svg>
    ),
  },
];

// — Activity: meetings & tasks
const activityItems: NavItem[] = [
  {
    href: "/meetings",
    label: "Meetings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="5" width="14" height="11" rx="2" />
        <path d="M7 5V3M13 5V3M3 9h14" />
        <circle cx="10" cy="12.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M7 10l2 2 4-4" />
      </svg>
    ),
  },
];

// — Reference: catalog browsing
const referenceItems: NavItem[] = [
  {
    href: "/programs",
    label: "Programs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M7 7h6M7 10h6M7 13h4" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M3 8h14M7 2v4M13 2v4" />
      </svg>
    ),
  },
  {
    href: "/relationships",
    label: "Relationships",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="13" cy="7" r="2.5" />
        <path d="M2 16c0-2.5 2-4 5-4M13 12c3 0 5 1.5 5 4" />
      </svg>
    ),
  },
];

const IDLE_STYLE = "text-zinc-400 hover:bg-surface-hover hover:text-foreground";
const ACTIVE_STYLE = "bg-accent/10 text-accent font-medium";

export default function Sidebar({
  initialBadgeCount,
}: {
  initialBadgeCount: number;
}) {
  const pathname = usePathname();
  const [badgeCount, setBadgeCount] = useState(initialBadgeCount);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Poll for inbox count every 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/inbox/count");
        if (res.ok) {
          const data = await res.json();
          setBadgeCount(data.count);
        }
      } catch {
        // silently fail — stale count is fine
      }
    };

    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync with initialBadgeCount when it changes (after server-side refresh)
  useEffect(() => {
    setBadgeCount(initialBadgeCount);
  }, [initialBadgeCount]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/inbox") return pathname === "/inbox";
    return pathname.startsWith(href);
  };

  function renderItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
          active ? ACTIVE_STYLE : IDLE_STYLE
        }`}
      >
        {item.icon}
        <span>{item.label}</span>
        {item.showBadge && badgeCount > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
            {badgeCount}
          </span>
        )}
      </Link>
    );
  }

  const nav = (
    <nav className="flex h-full flex-col px-3 py-4">
      {/* Brand */}
      <div className="mb-4 px-3 py-2">
        <span className="text-base font-bold text-accent">Relay</span>
      </div>

      {/* Zone 1 — Review */}
      <div>
        <div className="px-3 mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted/40">Review</div>
        <div className="flex flex-col gap-1">
          {reviewItems.map((item) => renderItem(item))}
        </div>
      </div>

      {/* Zone 2 — Work */}
      <div className="mt-6">
        <div className="px-3 mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted/40">Work</div>
        <div className="flex flex-col gap-1">
          {workItems.map((item) => renderItem(item))}
        </div>
      </div>

      {/* Zone 3 — Activity */}
      <div className="mt-6">
        <div className="px-3 mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted/40">Activity</div>
        <div className="flex flex-col gap-1">
          {activityItems.map((item) => renderItem(item))}
        </div>
      </div>

      {/* Zone 4 — Reference */}
      <div className="mt-6">
        <div className="px-3 mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted/40">Reference</div>
        <div className="flex flex-col gap-1">
          {referenceItems.map((item) => renderItem(item))}
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed left-4 top-4 z-50 rounded-lg bg-surface p-2 text-foreground lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          {mobileOpen ? (
            <path d="M5 5l10 10M15 5L5 15" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 border-r border-border/15 bg-surface transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
