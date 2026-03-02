'use client';

import { useState } from 'react';
import { AppProvider, useAppContext } from '@/hooks/useAppContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ConfigModal } from '@/components/shared/ConfigModal';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShellInner>{children}</AppShellInner>
    </AppProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const {
    setConfig,
    isConfigured,
    loaded,
    branches,
    selectedBranch,
    setSelectedBranch,
  } = useAppContext();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <ConfigModal open={!isConfigured} onSave={setConfig} />
      <div className="flex h-screen bg-zinc-950">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            showMenu={false}
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </>
  );
}
