'use client';

import { useMemo } from 'react';
import type { ContextRecord } from '@/types';

export function useBranches(events: ContextRecord[]) {
  return useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      set.add(event.branch);
    }
    const branches = Array.from(set).sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      return a.localeCompare(b);
    });
    return branches;
  }, [events]);
}
