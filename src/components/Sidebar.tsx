"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
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
  {
    href: "/initiatives",
    label: "Initiatives",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 5h12M4 10h12M4 15h8" />
      </svg>
    ),
    showBadge: false,
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
    showBadge: false,
  },
  {
    href: "/tracks",
    label: "Tracks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M7 7h6M7 10h6M7 13h4" />
      </svg>
    ),
    showBadge: false,
  },
];

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
    if (href === "/inbox") return pathname === "/inbox";
    return pathname.startsWith(href);
  };

  const nav = (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <Link
        href="/"
        className="mb-4 flex items-center gap-2 px-3 py-2"
        onClick={() => setMobileOpen(false)}
      >
        <span className="text-lg font-bold text-accent">Relay</span>
      </Link>

      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
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
      })}
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
        className={`fixed top-0 left-0 z-40 h-full w-64 border-r border-border bg-surface transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
