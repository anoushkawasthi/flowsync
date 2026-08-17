import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import type { ContextRecord } from '@/types';

interface RiskListProps {
  events: ContextRecord[];
}

export function RiskList({ events }: RiskListProps) {
  const risks = events.filter((e) => e.risk !== null);

  if (risks.length === 0) return null;

  return (
    <section className="neo rounded-card bg-surface shadow-neo-2">
      <header className="flex items-center gap-2 border-b-bw border-line px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-ink-subtle" />
        <h3 className="neo-label">Active risks</h3>
        <span className="ml-auto text-sm font-extrabold tabular-nums text-ink-subtle">
          {risks.length}
        </span>
      </header>

      <ul className="space-y-2 p-4">
        {risks.map((event) => (
          <li key={event.eventId} className="neo neo-thin rounded-chip bg-pastel-risk p-3">
            <p className="text-sm font-medium text-on-pastel">{event.risk}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-on-pastel opacity-60">
              <span className="max-w-[14rem] truncate">{event.feature}</span>
              <span aria-hidden>·</span>
              <span>{event.author}</span>
              <span aria-hidden>·</span>
              <span>
                {formatDistanceToNow(new Date(event.extractedAt), { addSuffix: true })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
