'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ChartSlab } from './ChartSlab';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { stageColor, chartTheme, chartTooltipStyle, STAGE_INK } from '@/lib/theme-colors';
import type { ContextRecord } from '@/types';

interface StageChartProps {
  events: ContextRecord[];
}

export function StageChart({ events }: StageChartProps) {
  const { mounted, isDark } = useResolvedTheme();

  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.stage] = (counts[event.stage] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  if (data.length === 0) return null;

  const t = chartTheme(isDark);

  return (
    <ChartSlab title="Stage breakdown">
      <div className="h-[250px]">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                // A hard stroke on every wedge, matching the borders everywhere else.
                stroke={t.border}
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={stageColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={chartTooltipStyle(isDark)}
                itemStyle={{ color: t.ink }}
                // Wedges are pastels with dark ink on them, so the swatch label
                // has to stay dark regardless of theme.
                labelStyle={{ color: STAGE_INK }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
                // Recharts colours each legend label with its series fill.
                // These fills are pastels, so on a white surface the labels
                // drop to ~1.5:1 — unreadable. Force them back to ink.
                formatter={(value: string) => <span style={{ color: t.ink }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartSlab>
  );
}
