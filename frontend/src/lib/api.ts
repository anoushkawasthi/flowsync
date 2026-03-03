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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSource {
  eventId: string;
  contextId: string;
  branch: string;
  timestamp: string;
  feature: string;
  stage: string;
  relevance: number;
  snippet: string;
}

export interface ChatResponse {
  reply: string;
  sources: ChatSource[];
  sessionId: string;
  timestamp: string;
}

export async function sendChatMessage(
  projectId: string,
  message: string,
  token: string,
  sessionId?: string | null
): Promise<ChatResponse> {
  if (useMock) {
    await delay(1000);
    // Mock response with varied replies
    const mockReplies = [
      "Based on the recent commits, it looks like you're working on implementing authentication. The JWT token generation was added in the auth module.",
      "The last major feature was the dashboard analytics component. It includes activity charts and risk assessment based on code changes.",
      "I can see that the project is currently in the development stage. The main tasks remaining include testing and deployment preparation.",
    ];
    return {
      reply: mockReplies[Math.floor(Math.random() * mockReplies.length)],
      sources: [
        {
          eventId: 'mock-event-1',
          contextId: 'mock-context-1',
          branch: 'main',
          timestamp: new Date().toISOString(),
          feature: 'Authentication System',
          stage: 'implementation',
          relevance: 0.92,
          snippet: 'Added JWT token generation and validation...',
        },
      ],
      sessionId: sessionId || `mock-session-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  const response = await api.post<ChatResponse>(
    '/api/v1/chat',
    {
      projectId,
      message,
      sessionId,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
}
