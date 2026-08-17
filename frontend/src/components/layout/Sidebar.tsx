'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from 'lucide-react';
import { cn, normalisePath } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAppContext } from '@/hooks/useAppContext';

/**
 * `pastel` is the section's identity colour. Only the active row is filled with
 * it — every other row stays quiet (see .neo-nav-item). A rail of five bordered
 * slabs was a lot of chrome for something you mostly read past.
 */
const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', pastel: 'var(--p-dashboard)' },
  { icon: MessageSquare, label: 'Chat', href: '/chat', pastel: 'var(--p-chat)' },
  { icon: Search, label: 'Search', href: '/search', pastel: 'var(--p-search)' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics', pastel: 'var(--p-analytics)' },
  { icon: Settings, label: 'Settings', href: '/settings', pastel: 'var(--p-neutral)' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const route = normalisePath(usePathname());
  const router = useRouter();
  const { clearConfig } = useAppContext();

  const handleLogout = () => {
    clearConfig();
    onMobileClose();
    router.push('/');
  };

  /** `isDrawer` forces the expanded layout inside the mobile overlay, where the
      rail is always full width regardless of the desktop collapse state. */
  const railBody = (isDrawer: boolean) => {
    const showLabels = isDrawer || !collapsed;

    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex h-full flex-col bg-surface">
          <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
            {navItems.map((item) => {
              const isActive = route === item.href;
              const link = (
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  aria-current={isActive ? 'page' : undefined}
                  data-active={isActive}
                  style={{ ['--pastel' as string]: item.pastel }}
                  className={cn('neo-nav-item', !showLabels && 'justify-center px-0')}
                >
                  <item.icon className="h-[1.0625rem] w-[1.0625rem] shrink-0" />
                  {showLabels && <span className="truncate">{item.label}</span>}
                </Link>
              );

              return showLabels ? (
                <div key={item.href}>{link}</div>
              ) : (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          <div className="space-y-1 border-t-thin border-line-soft p-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className={cn(
                    'neo-nav-item w-full hover:bg-danger-fill hover:text-on-pastel',
                    !showLabels && 'justify-center px-0'
                  )}
                >
                  <LogOut className="h-[1.0625rem] w-[1.0625rem] shrink-0" />
                  {showLabels && <span className="truncate">Sign out</span>}
                </button>
              </TooltipTrigger>
              {!showLabels && <TooltipContent side="right">Sign out</TooltipContent>}
            </Tooltip>

            {/* Desktop only — the drawer is dismissed by its scrim, not collapsed. */}
            <button
              onClick={onToggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className={cn(
                'neo-nav-item hidden w-full lg:flex',
                !showLabels && 'justify-center px-0'
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-[1.0625rem] w-[1.0625rem] shrink-0" />
              ) : (
                <PanelLeftClose className="h-[1.0625rem] w-[1.0625rem] shrink-0" />
              )}
              {showLabels && <span className="truncate">Collapse</span>}
            </button>
          </div>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 border-r-bw border-line transition-[width] duration-hover ease-neo lg:block',
          collapsed ? 'w-rail-collapsed' : 'w-rail'
        )}
      >
        {railBody(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Hatched scrim — no blur anywhere in this design */}
          <div
            className="neo-hatch absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_55%,transparent)]"
            onClick={onMobileClose}
          />
          <div className="animate-slide-in-left absolute inset-y-0 left-0 w-rail border-r-bw border-line">
            {railBody(true)}
          </div>
        </div>
      )}
    </>
  );
}
