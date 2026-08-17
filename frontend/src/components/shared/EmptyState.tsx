import { cn } from '@/lib/utils';

/**
 * Hatched rather than illustrated. Diagonal hatching reads as "an honest empty
 * frame"; a stock illustration reads as filler and dates instantly.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'neo neo-hatch flex flex-col items-center justify-center gap-3 rounded-card bg-surface px-6 py-14 text-center shadow-neo-2',
        className
      )}
    >
      {icon && (
        <div className="neo grid h-14 w-14 place-items-center rounded-chip bg-accent text-accent-ink">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-extrabold tracking-[-0.02em] text-ink">{title}</h3>
      {description && (
        <p className="max-w-[42ch] text-sm text-ink-muted">{description}</p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
