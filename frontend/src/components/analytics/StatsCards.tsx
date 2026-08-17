'use client';

import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { StatSlab } from '@/components/shared/StatSlab';
import type { ContextRecord } from '@/types';
import type { CardTone } from '@/components/ui/card';

interface StatsCardsProps {
  events: ContextRecord[];
}

export function StatsCards({ events }: StatsCardsProps) {
  const totalEvents = events.length;
  const activeRisks = events.filter((e) => e.risk !== null).length;
  const avgConfidence =
    events.length > 0
      ? Math.round((events.reduce((sum, e) => sum + e.confidence, 0) / events.length) * 100)
      : 0;

  const stats: { label: string; value: React.ReactNode; icon: React.ReactNode; tone: CardTone }[] = [
    {
      label: 'Total events',
      value: totalEvents,
      icon: <Activity className="h-4 w-4" />,
      tone: 'analytics',
    },
    {
      label: 'Active risks',
      value: activeRisks,
      // Only colour-code the risk slab when there is something to look at —
      // a pink "0 risks" slab reads as an alarm that isn't happening.
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: activeRisks > 0 ? 'risk' : 'surface',
    },
    {
      label: 'Avg confidence',
      value: `${avgConfidence}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      tone: 'surface',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <StatSlab
          key={stat.label}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          tone={stat.tone}
        />
      ))}
    </div>
  );
}
