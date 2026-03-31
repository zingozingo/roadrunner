"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUnsavedChangesContext } from "@/components/shared/UnsavedChangesProvider";

/* ------------------------------------------------------------------ */
/*  Nav structure — 3 tiers, 7 items                                  */
/* ------------------------------------------------------------------ */

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: boolean;
}

const primaryItems: NavItem[] = [
  {
    href: "/",
    label: "Today",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7" />
        <path d="M9 5.5v3.5l2.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/partners",
    label: "Partners",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="5.5" height="5.5" rx="1.5" />
        <rect x="10.5" y="2" width="5.5" height="5.5" rx="1.5" />
        <rect x="2" y="10.5" width="5.5" height="5.5" rx="1.5" />
        <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/inbox",
    label: "Inbox",
    badge: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 10h3.5l1.5 2.5h3L12 10h3.5" />
        <path d="M4 4.5h10a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z" />
      </svg>
    ),
  },
];

const secondaryItems: NavItem[] = [
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="2.5" width="12" height="12" rx="2" />
        <path d="M6 8.5l1.5 1.5L11 7" />
      </svg>
    ),
  },
  {
    href: "/meetings",
    label: "Meetings",
    icon: (
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="4" width="12" height="10.5" rx="2" />
        <path d="M5.5 4V2M11.5 4V2M2.5 7.5h12" />
      </svg>
    ),
  },
  {
    href: "/people",
    label: "People",
    icon: (
      <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8.5" cy="5.5" r="2.5" />
        <path d="M3.5 14.5c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      </svg>
    ),
  },
];

const tertiaryItems: NavItem[] = [
  {
    href: "/programs",
    label: "Programs",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2.5h10a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12V4A1.5 1.5 0 0 1 3 2.5z" />
        <path d="M5 6h6M5 8.5h6M5 11h3.5" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3.5h10a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12.5V5A1.5 1.5 0 0 1 3 3.5z" />
        <path d="M1.5 7h13M5 2v3M11 2v3" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Tier styling — hierarchy through brightness, not labels           */
/* ------------------------------------------------------------------ */

const tiers = {
  primary: {
    idle: "text-foreground/80 hover:text-foreground hover:bg-white/[0.04]",
    active: "text-accent bg-accent/[0.08]",
  },
  secondary: {
    idle: "text-muted hover:text-foreground/70 hover:bg-white/[0.04]",
    active: "text-accent bg-accent/[0.08]",
  },
  tertiary: {
    idle: "text-muted/60 hover:text-muted hover:bg-white/[0.04]",
    active: "text-accent bg-accent/[0.08]",
  },
} as const;

type Tier = keyof typeof tiers;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Sidebar({
  initialBadgeCount,
}: {
  initialBadgeCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { requestNavigation } = useUnsavedChangesContext();
  const [badgeCount, setBadgeCount] = useState(initialBadgeCount);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Poll inbox count every 30s */
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/inbox/count");
        if (res.ok) {
          const data = await res.json();
          setBadgeCount(data.count);
        }
      } catch {
        /* stale count is fine */
      }
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setBadgeCount(initialBadgeCount);
  }, [initialBadgeCount]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/inbox") return pathname === "/inbox";
    return pathname.startsWith(href);
  };

  /* ---- render helpers ---- */

  function renderItem(item: NavItem, tier: Tier) {
    const active = isActive(item.href);
    const style = tiers[tier];

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={(e) => {
          setMobileOpen(false);
          // If we're already on this page, no interception needed
          if (active) return;
          e.preventDefault();
          requestNavigation(item.href, () => router.push(item.href));
        }}
        className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
          active ? style.active : style.idle
        }`}
      >
        {item.icon}
        <span>{item.label}</span>

        {item.badge && badgeCount > 0 && (
          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {badgeCount}
          </span>
        )}
      </Link>
    );
  }

  function renderTier(items: NavItem[], tier: Tier) {
    return (
      <div className="flex flex-col gap-0.5">
        {items.map((item) => renderItem(item, tier))}
      </div>
    );
  }

  /* ---- nav tree ---- */

  const nav = (
    <nav className="flex h-full flex-col px-3 pt-5 pb-4">
      {/* Brand */}
      <div className="mb-6 px-3">
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Roadrunner
        </span>
      </div>

      {/* Primary — daily workflow */}
      {renderTier(primaryItems, "primary")}

      {/* Secondary — tools */}
      <div className="mt-6">
        {renderTier(secondaryItems, "secondary")}
      </div>

      {/* Spacer — pushes tertiary to bottom */}
      <div className="flex-1" />

      {/* Tertiary — reference catalogs */}
      <div>
        {renderTier(tertiaryItems, "tertiary")}
      </div>
    </nav>
  );

  /* ---- shell ---- */

  return (
    <>
      {/* Mobile toggle */}
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
        className={`fixed top-0 left-0 z-40 h-full w-56 border-r border-border/40 bg-surface transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
