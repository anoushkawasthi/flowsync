'use client';

import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  loading: boolean;
  placeholder: string;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t-bw border-line bg-surface p-3">
      <div className="mx-auto flex max-w-measure gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          className="h-11 flex-1"
          aria-label="Message"
        />
        <Button
          onClick={onSend}
          disabled={!value.trim() || loading || disabled}
          className="h-11 shrink-0 px-4"
          aria-label="Send message"
        >
          {loading ? <LoadingSpinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mx-auto mt-2 hidden max-w-measure text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-subtle sm:block">
        Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}
