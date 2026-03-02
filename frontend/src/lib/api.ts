import axios from 'axios';
import { API_BASE_URL } from './constants';
import { mockEvents, mockSearchResult } from './mock-data';
import type { ContextRecord, EventsResponse, SearchResult } from '@/types';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const api = axios.create({
  baseURL: API_BASE_URL,
});

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getEvents(
  projectId: string,
  token: string,
  branch?: string,
  since?: string,
  limit?: number
): Promise<EventsResponse> {
  if (useMock) {
    await delay(500);
    let events = mockEvents;
    if (branch) {
      events = events.filter((e: ContextRecord) => e.branch === branch);
    }
    if (since) {
      events = events.filter((e: ContextRecord) => e.extractedAt > since!);
    }
    return {
      events: events.slice(0, limit || 50),
      count: events.length,
      lastTimestamp: events.length > 0 ? events[0].extractedAt : null,
    };
  }

  const params: Record<string, string | number> = {};
  if (branch) params.branch = branch;
  if (since) params.since = since;
  if (limit) params.limit = limit;

  const response = await api.get<EventsResponse>(
    `/api/v1/projects/${projectId}/events`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    }
  );
  return response.data;
}

export async function searchContext(
  projectId: string,
  query: string,
  token: string
): Promise<SearchResult> {
  if (useMock) {
    await delay(800);
    return mockSearchResult;
  }

  const response = await api.post<SearchResult>(
    '/api/v1/query',
    { projectId, query },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
}
