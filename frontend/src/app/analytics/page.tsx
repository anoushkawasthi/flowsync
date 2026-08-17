'use client';

import { useAppContext } from '@/hooks/useAppContext';
import { StatsCards } from '@/components/analytics/StatsCards';
import { StageChart } from '@/components/analytics/StageChart';
import { ActivityChart } from '@/components/analytics/ActivityChart';
import { RiskList } from '@/components/analytics/RiskList';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingCards } from '@/components/shared/LoadingSpinner';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const { events, eventsLoading, selectedBranch } = useAppContext();

  if (eventsLoading && events.length === 0) {
    return <LoadingCards count={2} />;
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Analytics" title="Nothing to measure yet" />
        <EmptyState
          icon={<BarChart3 className="h-7 w-7" />}
          title="No analytics data yet"
          description="Charts appear once FlowSync has captured events from your project."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={selectedBranch === 'all' ? 'All branches' : selectedBranch}
        title="Analytics"
        lede="How work is distributed across pipeline stages, and where the risk is concentrated."
      />

      <StatsCards events={events} />

      <div className="grid gap-4 lg:grid-cols-2">
        <StageChart events={events} />
        <ActivityChart events={events} />
      </div>

      <RiskList events={events} />
    </div>
  );
}
