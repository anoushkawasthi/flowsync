import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContextRecord } from '@/types';

interface RiskListProps {
  events: ContextRecord[];
}

export function RiskList({ events }: RiskListProps) {
  const risks = events.filter((e) => e.risk !== null);

  if (risks.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">
          Active Risks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.map((event) => (
          <div
            key={event.eventId}
            className="flex gap-3 rounded-md border-l-2 border-orange-500 bg-zinc-800/50 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <div className="flex-1 space-y-1">
              <p className="text-sm text-orange-300">{event.risk}</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{event.feature}</span>
                <span>·</span>
                <span>{event.author}</span>
                <span>·</span>
                <span>
                  {formatDistanceToNow(new Date(event.extractedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
