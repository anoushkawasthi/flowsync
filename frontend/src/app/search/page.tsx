'use client';

import { useAppContext } from '@/hooks/useAppContext';
import { useSearch } from '@/hooks/useSearch';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { LoadingSearchResult } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search } from 'lucide-react';

export default function SearchPage() {
  const { config } = useAppContext();
  const { result, loading, error, search } = useSearch(config.projectId, config.token);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        eyebrow="Retrieval"
        title="Search context"
        lede="Ask about decisions, architecture, or history. Answers are drawn from the context FlowSync has captured."
      />

      <SearchBar onSearch={search} loading={loading} />

      {loading && <LoadingSearchResult />}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && <SearchResults result={result} />}

      {!result && !loading && !error && (
        <EmptyState
          icon={<Search className="h-7 w-7" />}
          title="Nothing searched yet"
          description="Try asking why a library was chosen, what is still outstanding on a feature, or what risks were flagged last week."
        />
      )}
    </div>
  );
}
