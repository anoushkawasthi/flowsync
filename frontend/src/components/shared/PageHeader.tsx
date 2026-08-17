import { cn } from '@/lib/utils';

/**
 * The standard page-opening block: an uppercase eyebrow that draws its own rule
 * across the row, a display-weight title, and an optional lede capped at the
 * measure. Gives every page the same entry rhythm instead of each one starting
 * with whatever control happened to be first.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {eyebrow && <p className="neo-eyebrow">{eyebrow}</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h2 className="neo-heading text-ink">{title}</h2>
          {lede && <p className="neo-measure text-sm text-ink-muted">{lede}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
