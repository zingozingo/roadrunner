"use client";

import { useEffect, useRef } from "react";
import { useUnsavedChangesContext } from "@/components/shared/UnsavedChangesProvider";

/**
 * Blocks navigation while an async mutation is in-flight.
 *
 * Intercepts three navigation vectors:
 * 1. beforeunload — browser close, reload, external navigation
 * 2. popstate — browser back/forward button
 * 3. Internal navigation — sidebar clicks via UnsavedChangesProvider context
 *
 * Usage:
 *   useNavigationGuard(busyAction !== null);
 *
 * Separate from useUnsavedChanges (which protects dirty form state).
 * Both can coexist on the same page — they compose independently.
 */
export function useNavigationGuard(blocked: boolean) {
  const { register } = useUnsavedChangesContext();
  const unregisterRef = useRef<(() => void) | null>(null);
  const leavingRef = useRef(false);

  // Register/unregister with UnsavedChangesProvider for sidebar interception.
  // This reuses the provider's requestNavigation flow (which the sidebar
  // already calls), so sidebar clicks show the confirmation dialog.
  useEffect(() => {
    if (blocked) {
      if (!unregisterRef.current) {
        unregisterRef.current = register("navigation-guard-mutation");
      }
    } else {
      if (unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
      }
    }
  }, [blocked, register]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unregisterRef.current) {
        unregisterRef.current();
        unregisterRef.current = null;
      }
    };
  }, []);

  // beforeunload — browser close/reload
  useEffect(() => {
    if (!blocked) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [blocked]);

  // popstate — browser back/forward
  useEffect(() => {
    if (!blocked) return;
    window.history.pushState({ navGuard: true }, "");
    const handler = (e: PopStateEvent) => {
      // Spurious popstate (macOS window switch, etc.) — guard entry still current
      if (e.state?.navGuard) return;
      // Real back press — guard entry was popped. Re-push to block.
      window.history.pushState({ navGuard: true }, "");
    };
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("popstate", handler);
      // Clean up the guard entry when mutation completes
      if (window.history.state?.navGuard && !leavingRef.current) {
        window.history.back();
      }
      leavingRef.current = false;
    };
  }, [blocked]);
}
