import { formatDistanceToNow } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import type { SearchSource } from '@/types';

interface SourceCardProps {
  source: SearchSource;
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <li className="neo neo-thin neo-lift-sm flex flex-col gap-2 rounded-chip bg-canvas p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="neo neo-thin shrink-0 rounded-[4px] bg-surface px-1.5 py-0.5 font-mono text-xs text-ink-muted">
          {source.commitHash.slice(0, 7)}
        </span>
        <span className="truncate text-sm font-bold text-ink">{source.feature}</span>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs text-ink-subtle">
          {formatDistanceToNow(new Date(source.extractedAt), { addSuffix: true })}
        </span>
        <div className="flex items-center gap-2">
          <Progress value={source.relevanceScore} className="h-2 w-14" />
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            {source.relevanceScore.toFixed(1)}%
          </span>
        </div>
      </div>
    </li>
  );
}
