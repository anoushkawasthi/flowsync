import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SourceCard } from './SourceCard';
import type { SearchResult } from '@/types';

interface SearchResultsProps {
  result: SearchResult;
}

export function SearchResults({ result }: SearchResultsProps) {
  return (
    <div className="space-y-4">
      {/* Answer card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-3">
        <h3 className="text-sm font-medium text-zinc-400">Answer</h3>
        <p className="text-zinc-100 leading-relaxed">{result.answer}</p>
        <div className="pt-2">
          {result.answerGrounded ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Grounded
            </Badge>
          ) : (
            <div className="space-y-1">
              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30">
                <AlertCircle className="mr-1 h-3 w-3" />
                Ungrounded
              </Badge>
              <p className="text-sm italic text-zinc-500">
                This answer may not be fully supported by the recorded context.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sources */}
      {result.sources.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-400">
            Sources ({result.sources.length})
          </h3>
          {result.sources
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .map((source) => (
              <SourceCard key={source.commitHash} source={source} />
            ))}
        </div>
      )}
    </div>
  );
}
