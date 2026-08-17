import { cn } from '@/lib/utils';

/**
 * The mark, inline so it inherits currentColor and stays crisp at every size.
 * Replaces the old 500x300 PNG, which was being rendered into square boxes
 * (h-6 w-6, h-8 w-8, h-20 w-20) in six places and squashed in all of them.
 *
 * Geometry: two blocks on a diagonal joined by a stepped connector — reads as
 * two things converging, as an S, and as a commit graph stepping between
 * branches. Every edge sits on the 32-unit grid so it survives down to 16px.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={cn('h-5 w-5', className)}
    >
      <rect x="2" y="2" width="9" height="9" />
      <rect x="4" y="11" width="5" height="8" />
      <rect x="4" y="14" width="24" height="5" />
      <rect x="23" y="14" width="5" height="8" />
      <rect x="21" y="21" width="9" height="9" />
    </svg>
  );
}

/** The mark in an accent tile — the app-icon treatment, for nav and hero use. */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'neo grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-accent text-accent-ink',
        className
      )}
    >
      <LogoMark className="h-5 w-5" />
    </span>
  );
}

/** Tile + wordmark. `label` lets the sidebar swap in the project name. */
export function LogoLockup({
  label = 'FlowSync',
  className,
  tileClassName,
  wordClassName,
}: {
  label?: string;
  className?: string;
  tileClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <LogoTile className={tileClassName} />
      <span
        className={cn(
          'truncate text-[1.0625rem] font-extrabold tracking-[-0.03em] text-ink',
          wordClassName
        )}
      >
        {label}
      </span>
    </span>
  );
}
