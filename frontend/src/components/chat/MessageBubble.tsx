'use client';

import { User, Bot } from 'lucide-react';
import { MarkdownMessage } from './MarkdownMessage';
import { cn } from '@/lib/utils';
import type { ChatMessage } from './types';

/**
 * Square bordered avatars and flat fills. The previous version used gradient
 * circles (teal for the assistant, purple for the user), the only gradients in
 * the app and the only place purple appeared.
 */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <span className="neo grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-accent text-accent-ink">
          <Bot className="h-4 w-4" />
        </span>
      )}

      <div
        className={cn(
          'neo min-w-0 max-w-[min(48rem,85%)] rounded-card p-4 shadow-neo-1',
          isUser ? 'bg-pastel-dashboard text-on-pastel' : 'bg-surface text-ink'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.content}</p>
        ) : (
          <MarkdownMessage content={message.content} />
        )}

        <p
          className={cn(
            'mt-3 border-t-thin border-line pt-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em]',
            isUser ? 'text-on-pastel opacity-60' : 'text-ink-subtle'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {isUser && (
        <span className="neo grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-surface text-ink">
          <User className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
