import type { ContextRecord } from '@/types';
import { ContextCard } from './ContextCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TimelineProps {
  events: ContextRecord[];
}

export function Timeline({ events }: TimelineProps) {
  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      <div className="space-y-3 pr-4">
        {events.map((event) => (
          <ContextCard key={event.eventId} event={event} />
        ))}
      </div>
    </ScrollArea>
  );
}
