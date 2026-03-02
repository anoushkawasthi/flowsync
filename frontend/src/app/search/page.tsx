'use client';

import { useAppContext } from '@/hooks/useAppContext';
import { useSearch } from '@/hooks/useSearch';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { LoadingSearchResult } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function SearchPage() {
  const { config } = useAppContext();
  const { result, loading, error, search } = useSearch(
    config.projectId,
    config.token
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
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
          icon={<Search className="h-8 w-8 text-zinc-500" />}
          title="Search your project context"
          description="Ask questions about your codebase, decisions, and architecture. FlowSync uses RAG to find answers from your commit history."
        />
      )}
    </div>
  );
}
