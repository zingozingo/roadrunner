"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Persists a single filter value in a URL search parameter.
 *
 * Reads the initial value from the current URL, and updates the URL
 * on change via router.replace (no history entry per filter click).
 *
 * Usage:
 *   const [partner, setPartner] = useFilterParam("partner");
 *   // URL: /engagements?partner=abc → partner === "abc"
 *   // setPartner("xyz") → URL becomes /engagements?partner=xyz
 *   // setPartner(null)  → URL becomes /engagements
 */
export function useFilterParam(key: string): [string | null, (value: string | null) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = searchParams.get(key) || null;

  const setValue = useCallback(
    (newValue: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue) {
        params.set(key, newValue);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [key, searchParams, router, pathname]
  );

  return [value, setValue];
}
