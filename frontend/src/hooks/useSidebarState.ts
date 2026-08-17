'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'flowsync-sidebar-collapsed';

/**
 * Collapse state has to outlive navigation, otherwise collapsing the rail is
 * pointless — every route change would spring it back open. Read on mount
 * rather than during render so the server and client agree on first paint.
 */
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // private mode / storage disabled — the default is fine
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    openMobile: useCallback(() => setMobileOpen(true), []),
    closeMobile: useCallback(() => setMobileOpen(false), []),
  };
}
