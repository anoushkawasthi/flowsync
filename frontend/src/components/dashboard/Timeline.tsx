'use client';

import { format } from 'date-fns';
import { ContextCard } from './ContextCard';
import type { ContextRecord } from '@/types';

interface TimelineProps {
  events: ContextRecord[];
}

/**
 * A real timeline rather than a flat list: a rule runs down the left with a
 * marker per event, and a date chip breaks the run when the day changes.
 *
 * The marker is positioned against a wrapper around the card, not against the
 * whole list item — an item that also renders a date heading is taller, so
 * anchoring to the item put the first marker of each day beside the date chip
 * instead of beside its card.
 */
export function Timeline({ events }: TimelineProps) {
  let lastDay = '';

  return (
    <div className="relative pl-7">
      {/* the rail */}
      <div
        aria-hidden
        className="absolute bottom-1 left-[0.3125rem] top-1 w-[var(--bw)] bg-line-soft"
      />

      <ol className="space-y-3">
        {events.map((event, i) => {
          const day = format(new Date(event.extractedAt), 'EEE d MMM yyyy');
          const isNewDay = day !== lastDay;
          lastDay = day;

          return (
            <li key={event.commitHash ? `${event.commitHash}-${i}` : i}>
              {isNewDay && (
                <h3 className="neo-label-sm relative mb-2 mt-5 first:mt-0">
                  <span
                    aria-hidden
                    className="absolute left-[-1.6875rem] top-[-0.125rem] h-3 w-3 rounded-[2px] border-thin border-line bg-surface"
                  />
                  {day}
                </h3>
              )}

              <div className="relative">
                {/* aligned to the card's meta row, which sits ~1.25rem in */}
                <span
                  aria-hidden
                  className="absolute left-[-1.5625rem] top-[1.1875rem] h-2 w-2 rounded-[1px] bg-accent"
                />
                <ContextCard event={event} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
