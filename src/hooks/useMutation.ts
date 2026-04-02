"use client";

import { useState, useCallback } from "react";

interface MutationState<T> {
  execute: () => Promise<T | undefined>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Generic async mutation wrapper with loading and error tracking.
 *
 * Usage:
 *   const { execute, isLoading, error, clearError } = useMutation(async () => {
 *     const res = await fetch('/api/something', { method: 'POST', body: ... });
 *     if (!res.ok) throw new Error('Failed');
 *     return res.json();
 *   });
 */
export function useMutation<T = void>(fn: () => Promise<T>): MutationState<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [fn]);

  const clearError = useCallback(() => setError(null), []);

  return { execute, isLoading, error, clearError };
}
