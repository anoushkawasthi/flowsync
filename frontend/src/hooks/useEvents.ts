'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContextRecord } from '@/types';
import { getEvents } from '@/lib/api';
import { POLLING_INTERVAL_MS } from '@/lib/constants';

/**
 * Return the newest `extractedAt` from an array of events (newest-first order).
 * Falls back to null when empty.
 */
function newestTimestamp(events: ContextRecord[]): string | null {
  return events.length > 0 ? events[0].extractedAt : null;
}

export function useEvents(
  projectId: string,
  token: string,
  branch?: string
) {
  const [events, setEvents] = useState<ContextRecord[]>([]);
  const [sinceTimestamp, setSinceTimestamp] = useState<string | null>(null);
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
      // Use the newest event's timestamp for subsequent polling
      setSinceTimestamp(newestTimestamp(data.events));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch events';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId, token, branch]);

  const poll = useCallback(async () => {
    if (!projectId || !token || !sinceTimestamp) return;
    try {
      const data = await getEvents(
        projectId,
        token,
        branch,
        sinceTimestamp,
        50
      );
      if (data.events.length > 0) {
        setEvents((prev) => {
          // Deduplicate by eventId to guard against overlap
          const existingIds = new Set(prev.map((e) => e.eventId));
          const newEvents = data.events.filter((e) => !existingIds.has(e.eventId));
          if (newEvents.length === 0) return prev; // stable reference
          return [...newEvents, ...prev];
        });
        setSinceTimestamp(newestTimestamp(data.events));
      }
    } catch {
      // Silently fail on polling; don't overwrite existing data
    }
  }, [projectId, token, branch, sinceTimestamp]);

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
