'use client';

import { useRouter, usePathname } from 'next/navigation';
import { AppProvider, useAppContext } from '@/hooks/useAppContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { normalisePath } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShellInner>{children}</AppShellInner>
    </AppProvider>
  );
}

/** A bordered square that tumbles — a ring spinner belongs to the old soft UI. */
function ShellLoader() {
  return (
    <div className="grid h-screen place-items-center bg-canvas">
      <div className="neo-spinner" role="status" aria-label="Loading" />
    </div>
  );
}

/**
 * Shell geometry: the top bar spans the full width, and the sidebar + content
 * sit in a row beneath it. Only the content column scrolls, so the bar and the
 * rail stay put without needing position: sticky on either.
 */
function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isConfigured, loaded } = useAppContext();
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState();
  const route = normalisePath(usePathname());
  const router = useRouter();

  // The public landing page renders standalone — it has its own nav and footer.
  if (route === '/') {
    return <>{children}</>;
  }

  // Wait for localStorage to resolve before deciding anything about auth.
  if (!loaded) {
    return <ShellLoader />;
  }

  if (!isConfigured) {
    router.replace('/');
    return <ShellLoader />;
  }

  // Chat manages its own internal scrolling and needs the full height, so it
  // opts out of the shared padded/scrolling container.
  const isFullHeightRoute = route === '/chat';

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar onMenuClick={openMobile} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          mobileOpen={mobileOpen}
          onMobileClose={closeMobile}
        />

        <main
          className={
            isFullHeightRoute
              ? 'min-w-0 flex-1 overflow-hidden p-3 sm:p-4'
              : 'min-w-0 flex-1 overflow-y-auto'
          }
        >
          {isFullHeightRoute ? (
            children
          ) : (
            // Capped and centred so wide monitors don't stretch text to
            // unreadable line lengths. The extra bottom padding gives the last
            // card's offset shadow somewhere to land — flush against the
            // viewport edge it reads as content that got cut off.
            <div className="mx-auto max-w-content p-4 pb-12 sm:p-6 sm:pb-14">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}
