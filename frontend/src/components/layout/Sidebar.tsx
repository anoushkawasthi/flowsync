'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAppContext } from '@/hooks/useAppContext';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: MessageSquare, label: 'Chat', href: '/chat' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearConfig } = useAppContext();

  const handleLogout = () => {
    clearConfig();
    onMobileClose();
    router.push('/');
  };

  const sidebarContent = (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200',
          // Desktop: show based on collapsed state
          'max-lg:w-64',
          collapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="FlowSync" width={24} height={24} className="h-6 w-6 shrink-0 rounded" />
            {(!collapsed || mobileOpen) && (
              <span className="text-lg font-bold text-zinc-100">
                FlowSync
              </span>
            )}
          </div>
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-l-2 border-teal-500 bg-teal-500/10 text-teal-500'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {/* Always show label on mobile, respect collapsed on desktop */}
                <span className={cn('lg:hidden', !collapsed && 'lg:inline')}>
                  {item.label}
                </span>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="hidden lg:block">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return link;
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-zinc-800 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  'text-zinc-500 hover:bg-red-500/10 hover:text-red-400'
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className={cn('lg:hidden', !collapsed && 'lg:inline')}>Logout</span>
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="hidden lg:block">Logout</TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Collapse Toggle — desktop only */}
        <div className="hidden border-t border-zinc-800 p-2 lg:block">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-64 animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
