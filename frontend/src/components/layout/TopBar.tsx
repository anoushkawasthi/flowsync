'use client';

import { usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GitBranch, Menu } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/search': 'Search',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

interface TopBarProps {
  branches: string[];
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
  onMenuClick?: () => void;
}

export function TopBar({
  branches,
  selectedBranch,
  onBranchChange,
  onMenuClick,
}: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'FlowSync';

  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 sm:px-6 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold text-zinc-100">{title}</h1>
      </div>

      {pathname !== '/settings' && branches.length > 0 && (
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <GitBranch className="hidden h-4 w-4 text-zinc-500 sm:block" />
          <Select value={selectedBranch} onValueChange={onBranchChange}>
            <SelectTrigger className="w-[120px] sm:w-[180px] h-8 text-xs sm:text-sm">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
