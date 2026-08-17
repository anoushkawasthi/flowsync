import { cn } from '@/lib/utils';
import type { CardTone } from '@/components/ui/card';

const toneClass: Record<CardTone, string> = {
  surface: 'bg-surface text-ink',
  dashboard: 'bg-pastel-dashboard text-on-pastel',
  timeline: 'bg-pastel-timeline text-on-pastel',
  analytics: 'bg-pastel-analytics text-on-pastel',
  chat: 'bg-pastel-chat text-on-pastel',
  risk: 'bg-pastel-risk text-on-pastel',
  search: 'bg-pastel-search text-on-pastel',
  neutral: 'bg-pastel-neutral text-on-pastel',
};

/**
 * A single measurement.
 *
 * Layout is fixed rather than content-driven: the label row is a constant
 * height and the value sits in a constant-height block beneath it, so a row of
 * slabs lines up on both edges even when one holds a badge, one holds "1", and
 * one holds "81%". Letting each slab size itself is what made the stat row look
 * ragged.
 *
 * `hero` bumps the type one step for the headline figure — enough to establish
 * hierarchy, not enough to break the shared baseline.
 */
export function StatSlab({
  label,
  value,
  icon,
  tone = 'surface',
  hero = false,
  children,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: CardTone;
  hero?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'neo flex flex-col gap-3 rounded-card p-4 shadow-neo-2',
        toneClass[tone],
        className
      )}
    >
      <div className="flex h-4 items-center gap-2">
        {icon && <span className="shrink-0 opacity-70">{icon}</span>}
        <span
          className={cn(
            'truncate text-[0.625rem] font-bold uppercase tracking-[0.1em]',
            tone === 'surface' ? 'text-ink-subtle' : 'opacity-70'
          )}
        >
          {label}
        </span>
      </div>

      <div className="flex min-h-[2.25rem] flex-col justify-end gap-2">
        {value !== undefined && (
          <span
            className={cn(
              'font-extrabold tabular-nums leading-none tracking-[-0.03em]',
              hero ? 'text-4xl' : 'text-2xl'
            )}
          >
            {value}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
