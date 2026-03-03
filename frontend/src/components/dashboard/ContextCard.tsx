'use client';

import { formatDistanceToNow } from 'date-fns';
import { Lightbulb, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { StageBadge } from './StageBadge';
import type { ContextRecord } from '@/types';

interface ContextCardProps {
  event: ContextRecord;
}

export function ContextCard({ event }: ContextCardProps) {
  const relativeTime = formatDistanceToNow(new Date(event.extractedAt), {
    addSuffix: true,
  });

  return (
    <div className="animate-slide-down-fade rounded-lg border border-zinc-800 bg-zinc-900 p-3 sm:p-4 space-y-2.5 sm:space-y-3 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <StageBadge stage={event.stage} />
        <span className="text-xs sm:text-sm text-zinc-300">{event.author}</span>
        <span className="text-xs text-zinc-500">{relativeTime}</span>
        <span className="ml-auto font-mono text-xs text-zinc-500">
          {event.commitHash?.slice(0, 7) ?? ''}
        </span>
      </div>

      {/* Feature title */}
      <h3 className="text-base sm:text-lg font-semibold text-zinc-100">{event.feature}</h3>

      {/* Decision */}
      {event.decision && (
        <div className="flex gap-2 rounded-md border border-teal-500/20 bg-teal-500/10 p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
          <p className="text-sm text-teal-300">{event.decision}</p>
        </div>
      )}

      {/* Risk */}
      {event.risk && (
        <div className="flex gap-2 rounded-md border border-orange-500/20 bg-orange-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
          <p className="text-sm text-orange-300">{event.risk}</p>
        </div>
      )}

      {/* Tasks */}
      {event.tasks.length > 0 && (
        <ul className="space-y-1 pl-4">
          {event.tasks.map((task, i) => (
            <li key={i} className="text-sm text-zinc-300 list-disc">
              {task}
            </li>
          ))}
        </ul>
      )}

      {/* Footer: Entities + Confidence */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {event.entities.map((entity) => (
            <span
              key={entity}
              className="rounded bg-zinc-800 px-1.5 sm:px-2 py-0.5 font-mono text-[11px] sm:text-xs text-zinc-300 truncate max-w-[120px] sm:max-w-none"
            >
              {entity}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Progress value={event.confidence * 100} className="h-1.5 w-16" />
          <span className="text-xs text-zinc-500">{Math.round(event.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
