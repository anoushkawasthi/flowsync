import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Badges are micro-type: uppercase, positively tracked, thin-bordered. They are
 * squared off (rounded-chip, not rounded-full) — a pill badge next to a hard
 * bordered card is the single fastest way to break the system's read.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-chip border-thin border-line px-2 py-0.5 text-[0.6875rem] font-bold uppercase leading-[1.4] tracking-[0.08em]',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-ink',
        neutral: 'bg-pastel-neutral text-on-pastel',
        success: 'bg-success-fill text-on-pastel',
        warn: 'bg-warn-fill text-on-pastel',
        destructive: 'bg-danger-fill text-on-pastel',
        outline: 'bg-transparent text-ink-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
