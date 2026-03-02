'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO, startOfDay } from 'date-fns';
import type { ContextRecord } from '@/types';

interface ActivityChartProps {
  events: ContextRecord[];
}

export function ActivityChart({ events }: ActivityChartProps) {
  const data = useMemo(() => {
    const dayMap: Record<string, number> = {};
    for (const event of events) {
      const day = format(startOfDay(parseISO(event.extractedAt)), 'MMM dd');
      dayMap[day] = (dayMap[day] || 0) + 1;
    }
    return Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .reverse();
  }, [events]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">
          Activity Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717A', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717A', fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181B',
                border: '1px solid #27272A',
                borderRadius: '8px',
                color: '#F4F4F5',
              }}
            />
            <Bar dataKey="count" fill="#14B8A6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
