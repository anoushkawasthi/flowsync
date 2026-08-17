'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { GitBranch, Menu, Copy, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LogoLockup } from '@/components/brand/Logo';
import { useAppContext } from '@/hooks/useAppContext';
import { cn, formatContextSnapshot, normalisePath } from '@/lib/utils';

interface TopBarProps {
  onMenuClick?: () => void;
}

/**
 * Spans the full viewport width above the sidebar, rather than starting where
 * the rail ends. Two header bands meeting at a T — one over the rail, one over
 * the content — put two competing horizontal rules on screen and made the whole
 * shell look misaligned.
 *
 * It deliberately does NOT show the page title: every page opens with its own
 * PageHeader, and printing the title twice six pixels apart is just noise. The
 * bar carries identity (logo, project) and global actions only.
 */
export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const { branches, selectedBranch, setSelectedBranch, projectName, events } = useAppContext();
  const [copied, setCopied] = useState(false);

  const route = normalisePath(pathname);
  const canCopy = events.length > 0;

  const handleCopySnapshot = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(formatContextSnapshot(events, selectedBranch));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy snapshot:', err);
    }
  };

  return (
    <header className="flex h-bar shrink-0 items-center gap-3 border-b-bw border-line bg-surface px-3 sm:px-4">
      <button
        onClick={onMenuClick}
        className="neo neo-lift-sm grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-surface text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <LogoLockup className="shrink-0" />

      {projectName && (
        <span className="neo-label hidden truncate border-l-thin border-line-soft pl-3 text-ink-muted md:block">
          {projectName}
        </span>
      )}

      {/* gap-2.5 rather than gap-2: each control carries a 3px offset shadow, so
          a tighter gap makes the shadow of one touch the border of the next. */}
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopySnapshot}
          disabled={!canCopy}
          title={
            canCopy
              ? 'Copy a context summary to the clipboard'
              : 'No events captured on this branch yet'
          }
          className={cn('hidden sm:inline-flex', copied && 'bg-success-fill text-on-pastel')}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="hidden lg:inline">{copied ? 'Copied' : 'Copy summary'}</span>
        </Button>

        {route !== '/settings' && branches.length > 0 && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="h-8 w-[8rem] sm:w-[11rem]" aria-label="Branch">
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
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
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
