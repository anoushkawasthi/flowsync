'use client';

import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ContextRecord } from '@/types';

interface StatsCardsProps {
  events: ContextRecord[];
}

export function StatsCards({ events }: StatsCardsProps) {
  const totalEvents = events.length;
  const activeRisks = events.filter((e) => e.risk !== null).length;
  const avgConfidence =
    events.length > 0
      ? Math.round(
          (events.reduce((sum, e) => sum + e.confidence, 0) / events.length) * 100
        )
      : 0;

  const stats = [
    {
      label: 'Total Events',
      value: totalEvents,
      icon: Activity,
      color: 'text-teal-500',
    },
    {
      label: 'Active Risks',
      value: activeRisks,
      icon: AlertTriangle,
      color: 'text-orange-400',
    },
    {
      label: 'Avg Confidence',
      value: `${avgConfidence}%`,
      icon: TrendingUp,
      color: 'text-teal-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-zinc-800 p-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-sm text-zinc-400">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
