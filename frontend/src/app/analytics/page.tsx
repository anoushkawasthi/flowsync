'use client';

import { useAppContext } from '@/hooks/useAppContext';
import { StatsCards } from '@/components/analytics/StatsCards';
import { StageChart } from '@/components/analytics/StageChart';
import { ActivityChart } from '@/components/analytics/ActivityChart';
import { RiskList } from '@/components/analytics/RiskList';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingCards } from '@/components/shared/LoadingSpinner';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const { events, eventsLoading } = useAppContext();

  if (eventsLoading && events.length === 0) {
    return <LoadingCards count={3} />;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8 text-zinc-500" />}
        title="No analytics data yet"
        description="Analytics will appear once events are captured from your project."
      />
    );
  }

  return (
    <div className="space-y-6">
      <StatsCards events={events} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StageChart events={events} />
        <ActivityChart events={events} />
      </div>
      <RiskList events={events} />
    </div>
  );
}
