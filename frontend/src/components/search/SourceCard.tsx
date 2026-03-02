import { formatDistanceToNow } from 'date-fns';
import type { SearchSource } from '@/types';

interface SourceCardProps {
  source: SearchSource;
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="shrink-0 font-mono text-xs sm:text-sm text-zinc-400">
          {source.commitHash.slice(0, 7)}
        </span>
        <span className="text-sm text-zinc-200 truncate">{source.feature}</span>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
        <span className="text-xs text-zinc-500">
          {formatDistanceToNow(new Date(source.extractedAt), {
            addSuffix: true,
          })}
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-teal-500 rounded-full"
              style={{ width: `${source.relevanceScore}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {source.relevanceScore.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
