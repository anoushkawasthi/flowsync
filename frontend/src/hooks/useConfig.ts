'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProjectConfig } from '@/types';
import { LOCAL_STORAGE_KEY } from '@/lib/constants';

export function useConfig() {
  const [config, setConfigState] = useState<ProjectConfig>({
    projectId: '',
    token: '',
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProjectConfig;
        setConfigState(parsed);
      }
    } catch {
      // ignore parse errors
    }
    setLoaded(true);
  }, []);

  const setConfig = useCallback((newConfig: ProjectConfig) => {
    setConfigState(newConfig);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
  }, []);

  const clearConfig = useCallback(() => {
    setConfigState({ projectId: '', token: '' });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('flowsync-use-mock');
  }, []);

  const isConfigured =
    loaded && config.projectId.length > 0 && config.token.length > 0;

  return { config, setConfig, clearConfig, isConfigured, loaded };
}
