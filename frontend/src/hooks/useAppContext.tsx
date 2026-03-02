'use client';

import { createContext, useContext, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useEvents } from '@/hooks/useEvents';
import { useBranches } from '@/hooks/useBranches';
import type { ProjectConfig, ContextRecord } from '@/types';

interface AppContextValue {
  config: ProjectConfig;
  setConfig: (config: ProjectConfig) => void;
  isConfigured: boolean;
  loaded: boolean;
  events: ContextRecord[];
  eventsLoading: boolean;
  eventsError: string | null;
  branches: string[];
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  refetchEvents: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { config, setConfig, isConfigured, loaded } = useConfig();
  const [selectedBranch, setSelectedBranch] = useState('main');

  // Fetch all events (no branch filter) — for branch list
  const {
    events: allEvents,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents(
    isConfigured ? config.projectId : '',
    isConfigured ? config.token : ''
  );

  const branches = useBranches(allEvents);

  // Filter events by selected branch
  const events =
    selectedBranch === 'all'
      ? allEvents
      : allEvents.filter((e) => e.branch === selectedBranch);

  return (
    <AppContext.Provider
      value={{
        config,
        setConfig,
        isConfigured,
        loaded,
        events,
        eventsLoading,
        eventsError,
        branches,
        selectedBranch,
        setSelectedBranch,
        refetchEvents,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
