'use client';

import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

/**
 * The search field is the page's hero element, not a toolbar control — it sits
 * in its own bordered slab at display scale so the page has an obvious subject.
 */
export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    if (query.trim() && !loading) {
      onSearch(query.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="neo rounded-card bg-pastel-search p-4 shadow-neo-3 sm:p-5">
      <label htmlFor="rag-search" className="neo-label text-on-pastel opacity-70">
        Ask your project
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            id="rag-search"
            placeholder="What did we decide about auth?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="h-12 pl-10 text-base"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!query.trim() || loading}
          size="lg"
          className="shrink-0 sm:w-28"
        >
          {loading ? <LoadingSpinner className="h-4 w-4" /> : 'Ask'}
        </Button>
      </div>
    </div>
  );
}
