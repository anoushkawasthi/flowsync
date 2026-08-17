'use client';

import { Plus, Trash2, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ChatSession } from './types';

interface SessionRailProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionRail({
  sessions,
  currentSessionId,
  open,
  onClose,
  onCreate,
  onSwitch,
  onDelete,
}: SessionRailProps) {
  const rail = (
    <div className="neo flex h-full flex-col overflow-hidden rounded-card bg-surface">
      <div className="flex items-center gap-2 border-b-bw border-line p-3">
        <h2 className="neo-label flex-1">History</h2>
        <button
          onClick={onClose}
          aria-label="Close history"
          className="neo neo-lift-sm grid h-8 w-8 place-items-center rounded-chip bg-surface text-ink md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b-bw border-line p-3">
        <Button onClick={onCreate} className="w-full" size="sm">
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <ul className="space-y-2 p-3">
          {sessions.length === 0 ? (
            <li className="neo neo-thin neo-hatch rounded-chip bg-canvas px-3 py-8 text-center">
              <History className="mx-auto mb-2 h-6 w-6 text-ink-subtle" />
              <p className="text-sm text-ink-muted">No chat history yet.</p>
            </li>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              return (
                <li key={session.id} className="group relative">
                  <button
                    onClick={() => onSwitch(session.id)}
                    title={session.title}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'neo neo-lift-sm block w-full rounded-chip p-3 pr-9 text-left',
                      isActive
                        ? 'bg-pastel-chat text-on-pastel'
                        : 'bg-canvas text-ink hover:bg-surface'
                    )}
                  >
                    <span className="block truncate text-sm font-bold leading-snug">
                      {session.title}
                    </span>
                    <span className="mt-1 block text-[0.6875rem] font-bold uppercase tracking-[0.08em] opacity-60">
                      {session.messages.length}{' '}
                      {session.messages.length === 1 ? 'message' : 'messages'} ·{' '}
                      {new Date(session.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </button>

                  {/* Always present rather than opacity-0 until hover, so it is
                      reachable by keyboard and on touch. */}
                  <button
                    onClick={() => onDelete(session.id)}
                    aria-label={`Delete chat "${session.title}"`}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-[6px] text-ink-subtle transition-colors duration-micro ease-neo hover:bg-danger-fill hover:text-on-pastel"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* Desktop: part of the grid */}
      <div className="hidden h-full w-64 shrink-0 md:block">{rail}</div>

      {/* Mobile: overlay drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="neo-hatch absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_55%,transparent)]"
            onClick={onClose}
          />
          <div className="animate-slide-in-left absolute inset-y-0 left-0 w-72 p-2">{rail}</div>
        </div>
      )}
    </>
  );
}
