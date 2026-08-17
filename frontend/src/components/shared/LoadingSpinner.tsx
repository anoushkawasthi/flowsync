import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** The tumbling bordered square used wherever work is in flight. */
export function LoadingSpinner({ className }: { className?: string }) {
  return <div className={cn('neo-spinner rounded-[4px]', className)} role="status" aria-label="Loading" />;
}

/** Card skeletons matching the real dashboard rhythm: a stat row, then slabs. */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for a search answer plus its source list. */
export function LoadingSearchResult() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
