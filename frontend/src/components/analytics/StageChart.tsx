'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContextRecord } from '@/types';

const CHART_COLORS: Record<string, string> = {
  'Setup': '#3B82F6',
  'Feature Development': '#10B981',
  'Bug Fix': '#EF4444',
  'Refactoring': '#EAB308',
  'Testing': '#A855F7',
  'Documentation': '#71717A',
};

interface StageChartProps {
  events: ContextRecord[];
}

export function StageChart({ events }: StageChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.stage] = (counts[event.stage] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">
          Stage Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell
          key={entry.name}
          fill={CHART_COLORS[entry.name] || '#71717A'}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181B',
            border: '1px solid #27272A',
            borderRadius: '8px',
            color: '#FFFFFF',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#A1A1AA' }}
        />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
