'use client';

import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Section pastel used to fill the active segment, e.g. `bg-pastel-timeline`. */
  pastel?: string;
}

/**
 * A chunky bordered segmented control. Each segment is a real slab with its own
 * border and press physics rather than a tinted background inside a track — the
 * old version made the selected tab read as slightly-lighter grey, which is not
 * a state you can see across a room.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'neo neo-lift-sm inline-flex items-center gap-2 rounded-chip px-3.5 py-2 text-sm font-bold',
              isActive
                ? cn(opt.pastel ?? 'bg-accent', opt.pastel ? 'text-on-pastel' : 'text-accent-ink')
                : 'bg-surface text-ink-muted hover:text-ink'
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
