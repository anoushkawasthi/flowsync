import { formatDistanceToNow } from 'date-fns';
import type { SearchSource } from '@/types';

interface SourceCardProps {
  source: SearchSource;
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-700 transition-colors">
      <span className="font-mono text-sm text-zinc-400">
        {source.commitHash.slice(0, 7)}
      </span>
      <span className="text-sm text-zinc-200 flex-1">{source.feature}</span>
      <span className="text-xs text-zinc-500">
        {formatDistanceToNow(new Date(source.extractedAt), {
          addSuffix: true,
        })}
      </span>
      <div className="flex items-center gap-2 min-w-[80px] justify-end">
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
  );
}
