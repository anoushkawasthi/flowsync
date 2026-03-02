'use client';

import { useState, useCallback } from 'react';
import type { SearchResult } from '@/types';
import { searchContext } from '@/lib/api';

export function useSearch(projectId: string, token: string) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (query: string) => {
      if (!projectId || !token || !query.trim()) return;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const data = await searchContext(projectId, query, token);
        setResult(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Search failed';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [projectId, token]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, search, reset };
}
