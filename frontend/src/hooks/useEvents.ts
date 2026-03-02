'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContextRecord } from '@/types';
import { getEvents } from '@/lib/api';
import { POLLING_INTERVAL_MS } from '@/lib/constants';

export function useEvents(
  projectId: string,
  token: string,
  branch?: string
) {
  const [events, setEvents] = useState<ContextRecord[]>([]);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInitial = useCallback(async () => {
    if (!projectId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEvents(projectId, token, branch, undefined, 50);
      setEvents(data.events);
      setLastTimestamp(data.lastTimestamp);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch events';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId, token, branch]);

  const poll = useCallback(async () => {
    if (!projectId || !token || !lastTimestamp) return;
    try {
      const data = await getEvents(
        projectId,
        token,
        branch,
        lastTimestamp,
        50
      );
      if (data.events.length > 0) {
        setEvents((prev) => [...data.events, ...prev]);
        setLastTimestamp(data.lastTimestamp);
      }
    } catch {
      // Silently fail on polling; don't overwrite existing data
    }
  }, [projectId, token, branch, lastTimestamp]);

  // Initial fetch
  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Polling
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [poll]);

  return { events, loading, error, refetch: fetchInitial };
}
