'use client';

import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StageBadge } from '@/components/dashboard/StageBadge';
import { cn } from '@/lib/utils';
import type { ChatSource } from './types';

/**
 * Sources are collapsed by default and open into a bordered list. They used to
 * render inline beneath every answer, which meant a three-source reply pushed
 * the next question off screen.
 */
export function SourcePanel({
  sources,
  expanded,
  onToggle,
}: {
  sources: ChatSource[];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="neo neo-lift-sm inline-flex items-center gap-2 rounded-chip bg-surface px-2.5 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink"
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-hover ease-neo',
            expanded && 'rotate-180'
          )}
        />
        {sources.length} source{sources.length > 1 ? 's' : ''}
      </button>

      {expanded && (
        <ul className="animate-slide-down-fade space-y-2">
          {sources.map((source, i) => (
            <li key={`${source.eventId}-${i}`} className="neo neo-thin rounded-chip bg-surface p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <StageBadge stage={source.stage} />
                <Badge variant="outline">{source.branch}</Badge>
                <span className="ml-auto text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-subtle">
                  {Math.round(source.relevance * 100)}% match
                </span>
              </div>

              <p className="mt-2 text-sm font-bold text-ink">{source.feature}</p>
              <p className="neo neo-thin mt-2 line-clamp-3 rounded-[4px] bg-canvas p-2 text-xs leading-relaxed text-ink-muted">
                {source.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
