'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useEvents } from '@/hooks/useEvents';
import { useBranches } from '@/hooks/useBranches';
import { getProjectInfo } from '@/lib/api';
import type { ProjectConfig, ContextRecord } from '@/types';

interface AppContextValue {
  config: ProjectConfig;
  setConfig: (config: ProjectConfig) => void;
  clearConfig: () => void;
  isConfigured: boolean;
  loaded: boolean;
  projectName: string;
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
  const { config, setConfig, clearConfig, isConfigured, loaded } = useConfig();
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [projectName, setProjectName] = useState('');

  // Fetch project name once when configured
  useEffect(() => {
    if (!isConfigured) { setProjectName(''); return; }
    getProjectInfo(config.projectId, config.token)
      .then((info) => { if (info?.name) setProjectName(info.name); })
      .catch(() => {});
  }, [isConfigured, config.projectId, config.token]);

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

  // Filter events by selected branch (memoised so reference is stable when data is unchanged)
  const events = useMemo(
    () =>
      selectedBranch === 'all'
        ? allEvents
        : allEvents.filter((e) => e.branch === selectedBranch),
    [allEvents, selectedBranch]
  );

  return (
    <AppContext.Provider
      value={{
        config,
        setConfig,
        clearConfig,
        isConfigured,
        loaded,
        projectName,
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
