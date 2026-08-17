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
      <article className="neo rounded-card bg-surface shadow-neo-2">
        <header className="flex items-center justify-between gap-3 border-b-bw border-line px-5 py-3">
          <h3 className="neo-label">Answer</h3>
          {result.answerGrounded ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3" />
              Grounded
            </Badge>
          ) : (
            <Badge variant="warn">
              <AlertCircle className="h-3 w-3" />
              Ungrounded
            </Badge>
          )}
        </header>

        <div className="space-y-3 p-5">
          <p className="neo-measure text-ink">{result.answer}</p>
          {!result.answerGrounded && (
            <p className="text-sm italic text-ink-muted">
              This answer may not be fully supported by the recorded context.
            </p>
          )}
        </div>
      </article>

      {result.sources.length > 0 && (
        <section className="neo rounded-card bg-surface shadow-neo-2">
          <header className="flex items-center gap-2 border-b-bw border-line px-5 py-3">
            <h3 className="neo-label">Sources</h3>
            <span className="ml-auto text-sm font-extrabold tabular-nums text-ink-subtle">
              {result.sources.length}
            </span>
          </header>
          <ul className="space-y-2 p-4">
            {[...result.sources]
              .sort((a, b) => b.relevanceScore - a.relevanceScore)
              .map((source) => (
                <SourceCard key={source.commitHash} source={source} />
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
