"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface UnsavedChangesContextValue {
  /** Register a dirty surface. Returns an unregister function. */
  register: (id: string) => () => void;
  /** Check if any surface has unsaved changes */
  isDirty: boolean;
  /** Attempt navigation — shows dialog if dirty, navigates if clean.
   *  Returns true if navigation is allowed immediately. */
  requestNavigation: (href: string, navigate: () => void) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  register: () => () => {},
  isDirty: false,
  requestNavigation: (_href, navigate) => { navigate(); return true; },
});

export function useUnsavedChangesContext() {
  return useContext(UnsavedChangesContext);
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirtySurfaces, setDirtySurfaces] = useState<Set<string>>(new Set());
  const [pendingNavigation, setPendingNavigation] = useState<{
    href: string;
    navigate: () => void;
  } | null>(null);

  const isDirty = dirtySurfaces.size > 0;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const leavingRef = useRef(false);

  const register = useCallback((id: string) => {
    setDirtySurfaces((prev) => new Set(prev).add(id));
    return () => {
      setDirtySurfaces((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const requestNavigation = useCallback(
    (href: string, navigate: () => void): boolean => {
      if (!isDirtyRef.current) {
        navigate();
        return true;
      }
      setPendingNavigation({ href, navigate });
      return false;
    },
    []
  );

  /* Browser-level protection: beforeunload for tab close/refresh */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* Browser back/forward protection via history API */
  useEffect(() => {
    if (!isDirty) return;
    // Push a guard entry so pressing back triggers popstate instead of leaving
    window.history.pushState({ unsavedGuard: true }, "");
    const handler = () => {
      // User pressed back — show confirmation instead of navigating
      setPendingNavigation({
        href: "",
        navigate: () => window.history.back(),
      });
      // Re-push the guard so subsequent back presses also get caught
      window.history.pushState({ unsavedGuard: true }, "");
    };
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("popstate", handler);
      // Clean up the guard entry if we go clean while still on the page
      // but NOT if we're intentionally leaving (handleLeave was called)
      if (window.history.state?.unsavedGuard && !leavingRef.current) {
        window.history.back();
      }
      leavingRef.current = false;
    };
  }, [isDirty]);

  /* Handle dialog actions */
  function handleStay() {
    setPendingNavigation(null);
  }

  function handleLeave() {
    if (pendingNavigation) {
      // Mark that we're intentionally leaving — skip history cleanup
      leavingRef.current = true;
      // Clear all dirty state before navigating
      setDirtySurfaces(new Set());
      pendingNavigation.navigate();
      setPendingNavigation(null);
    }
  }

  return (
    <UnsavedChangesContext.Provider
      value={{ register, isDirty, requestNavigation }}
    >
      {children}
      {pendingNavigation && <ConfirmDialog onStay={handleStay} onLeave={handleLeave} />}
    </UnsavedChangesContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirmation Dialog                                                */
/* ------------------------------------------------------------------ */

function ConfirmDialog({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  /* Focus trap + ESC to stay */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onStay();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onStay]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onStay}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="rounded-lg border border-border/50 bg-surface p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-foreground mb-2">
          Unsaved changes
        </h2>
        <p className="text-sm text-foreground/70 mb-6">
          You have unsaved changes that will be lost if you leave this page.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onStay}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Stay
          </button>
          <button
            onClick={onLeave}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/*  Hook for individual surfaces                                       */
/* ------------------------------------------------------------------ */

/**
 * Hook for components that need unsaved-changes protection.
 *
 * Usage:
 *   const { setDirty, clearDirty } = useUnsavedChanges("note-workspace");
 *   // Call setDirty() when user makes changes
 *   // Call clearDirty() when changes are saved/discarded
 */
export function useUnsavedChanges(surfaceId: string) {
  const { register } = useUnsavedChangesContext();
  const unregisterRef = useRef<(() => void) | null>(null);

  const setDirty = useCallback(() => {
    if (!unregisterRef.current) {
      unregisterRef.current = register(surfaceId);
    }
  }, [register, surfaceId]);

  const clearDirty = useCallback(() => {
    if (unregisterRef.current) {
      unregisterRef.current();
      unregisterRef.current = null;
    }
  }, []);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (unregisterRef.current) {
        unregisterRef.current();
      }
    };
  }, []);

  return { setDirty, clearDirty };
}
