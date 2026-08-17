'use client';

import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/**
 * All the markdown element overrides, extracted from the chat page where they
 * were ~20 inline component functions rebuilt on every render with hardcoded
 * teal/zinc classes.
 *
 * Note the code theme follows the app theme. The old version pinned
 * `vscDarkPlus`, which is unreadable once the surface behind it is paper.
 */
export function MarkdownMessage({ content }: { content: string }) {
  const { isDark } = useResolvedTheme();

  const components = useMemo<Components>(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        if (inline || !match) {
          return (
            <code
              className="neo neo-thin rounded-[4px] bg-canvas px-1.5 py-0.5 font-mono text-[0.8125em]"
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <div className="neo my-4 overflow-hidden rounded-chip">
            <div className="border-b-thin border-line bg-canvas px-3 py-1.5">
              <span className="neo-label-sm">{match[1]}</span>
            </div>
            <SyntaxHighlighter
              style={isDark ? oneDark : oneLight}
              language={match[1]}
              PreTag="div"
              customStyle={{
                margin: 0,
                background: 'transparent',
                padding: '12px',
                fontSize: '0.8125rem',
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        );
      },
      p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="my-3 space-y-1.5">{children}</ul>,
      ol: ({ children }) => (
        <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>
      ),
      // Accent square bullets rather than glyphs, matching the rest of the app.
      li: ({ children, ...props }) => (
        <li className="neo-bullet" {...props}>
          {children}
        </li>
      ),
      h1: ({ children }) => (
        <h1 className="mb-3 mt-6 border-b-thin border-line pb-2 text-xl font-extrabold tracking-[-0.02em] first:mt-0">
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2 className="mb-2.5 mt-5 flex items-center gap-2 text-lg font-extrabold tracking-[-0.02em] first:mt-0">
          <span aria-hidden className="neo neo-thin h-4 w-1.5 shrink-0 bg-accent" />
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3 className="mb-2 mt-4 text-base font-extrabold tracking-[-0.01em]">{children}</h3>
      ),
      h4: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-bold">{children}</h4>,
      blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-[3px] border-accent bg-canvas py-2 pl-4 italic">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-4 border-t-thin border-line opacity-40" />,
      strong: ({ children }) => <strong className="font-extrabold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      a: ({ children, href }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-accent-text underline decoration-2 underline-offset-2"
        >
          {children}
        </a>
      ),
      table: ({ children }) => (
        // Wide tables scroll inside their own container so the message column
        // never forces the page to scroll sideways.
        <div className="neo my-4 overflow-x-auto rounded-chip">
          <table className="min-w-full">{children}</table>
        </div>
      ),
      thead: ({ children }) => (
        <thead className="border-b-bw border-line bg-canvas">{children}</thead>
      ),
      th: ({ children }) => (
        <th className="px-3 py-2 text-left text-[0.6875rem] font-bold uppercase tracking-[0.08em]">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border-t-thin border-line px-3 py-2 text-sm">{children}</td>
      ),
    }),
    [isDark]
  );

  return (
    <div className="text-[0.9375rem]">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
