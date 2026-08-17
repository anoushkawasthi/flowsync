'use client';

import { cn } from '@/lib/utils';

export { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** A bordered chart panel with an uppercase micro-label header. */
export function ChartSlab({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('neo flex flex-col rounded-card bg-surface shadow-neo-2', className)}>
      <header className="border-b-bw border-line px-4 py-3">
        <h3 className="neo-label">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
