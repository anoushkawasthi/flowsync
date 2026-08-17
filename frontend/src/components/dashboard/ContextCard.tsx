'use client';

import { formatDistanceToNow } from 'date-fns';
import { Lightbulb, AlertTriangle, GitMerge } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { StageBadge } from './StageBadge';
import { cn } from '@/lib/utils';
import type { ContextRecord } from '@/types';

interface ContextCardProps {
  event: ContextRecord;
}

export function ContextCard({ event }: ContextCardProps) {
  const relativeTime = formatDistanceToNow(new Date(event.extractedAt), { addSuffix: true });
  const confidencePct = Math.round(event.confidence * 100);

  return (
    <article
      className={cn(
        'neo animate-slide-down-fade rounded-card bg-surface p-4 shadow-neo-2',
        'transition-transform duration-hover ease-neo hover:-translate-y-px'
      )}
    >
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={event.stage} />
        {event.mergedFrom && (
          <span className="neo neo-thin inline-flex items-center gap-1 rounded-chip bg-pastel-compare-b px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-on-pastel">
            <GitMerge className="h-3 w-3" />
            merged from {event.mergedFrom}
          </span>
        )}
        <span className="text-sm font-bold text-ink">{event.author}</span>
        <span className="text-xs text-ink-subtle">{relativeTime}</span>
        {event.commitHash && (
          <span className="ml-auto font-mono text-xs text-ink-subtle">
            {event.commitHash.slice(0, 7)}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-lg font-extrabold leading-tight tracking-[-0.02em] text-ink">
        {event.feature}
      </h3>

      {event.decision && (
        <div className="neo neo-thin mt-3 flex gap-2 rounded-chip bg-pastel-dashboard p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-on-pastel" />
          <p className="text-sm font-medium text-on-pastel">{event.decision}</p>
        </div>
      )}

      {event.risk && (
        <div className="neo neo-thin mt-2 flex gap-2 rounded-chip bg-pastel-risk p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-on-pastel" />
          <p className="text-sm font-medium text-on-pastel">{event.risk}</p>
        </div>
      )}

      {event.tasks.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {event.tasks.map((task, i) => (
            <li key={i} className="neo-bullet text-sm text-ink-muted">
              {task}
            </li>
          ))}
        </ul>
      )}

      {/* Entities + confidence */}
      <div className="mt-4 flex flex-col gap-2 border-t-thin border-line pt-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {event.entities.map((entity) => (
            <span
              key={entity}
              className="neo neo-thin max-w-[10rem] truncate rounded-[4px] bg-canvas px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted sm:max-w-none"
            >
              {entity}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="neo-label-sm">Confidence</span>
          <Progress value={confidencePct} className="h-2 w-16" />
          <span className="text-xs font-bold tabular-nums text-ink">{confidencePct}%</span>
        </div>
      </div>
    </article>
  );
}
