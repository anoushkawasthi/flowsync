'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO, startOfDay } from 'date-fns';
import { ChartSlab } from './ChartSlab';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { chartTheme, chartTooltipStyle } from '@/lib/theme-colors';
import type { ContextRecord } from '@/types';

interface ActivityChartProps {
  events: ContextRecord[];
}

export function ActivityChart({ events }: ActivityChartProps) {
  const { mounted, isDark } = useResolvedTheme();

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

  const t = chartTheme(isDark);
  const tick = { fill: t.inkSubtle, fontSize: 11, fontWeight: 700 };

  return (
    <ChartSlab title="Activity over time">
      <div className="h-[250px]">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={tick} />
              <YAxis axisLine={false} tickLine={false} tick={tick} allowDecimals={false} />
              <Tooltip
                contentStyle={chartTooltipStyle(isDark)}
                itemStyle={{ color: t.ink }}
                labelStyle={{ color: t.ink }}
                cursor={{ fill: t.grid }}
              />
              {/* Squared off with a hard stroke — rounded bars belong to the
                  soft-UI vocabulary this design replaced. */}
              <Bar dataKey="count" fill={t.accent} stroke={t.border} strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartSlab>
  );
}
