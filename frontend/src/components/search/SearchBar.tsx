'use client';

import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    if (query.trim() && !loading) {
      onSearch(query.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Ask about your project…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="pl-10 text-sm sm:text-base"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!query.trim() || loading}
        className="shrink-0 bg-teal-500 hover:bg-teal-600 text-white"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
      </Button>
    </div>
  );
}
