import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Hatched rather than pulsing. A pulse animates a soft grey block, which is the
 * exact texture this design replaced; hatching says "not loaded" while still
 * reading as part of the system.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('neo neo-thin neo-hatch rounded-chip bg-surface', className)}
      {...props}
    />
  );
}

export { Skeleton };
