'use client';

import { useState } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { Timeline } from '@/components/dashboard/Timeline';
import { ProjectSummary } from '@/components/dashboard/ProjectSummary';
import { BranchCompare } from '@/components/dashboard/BranchCompare';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingCards } from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { GitBranch, GitCommitHorizontal, LayoutDashboard, List } from 'lucide-react';

type Tab = 'summary' | 'timeline' | 'compare';

const tabs: SegmentedOption<Tab>[] = [
  { value: 'summary', label: 'Summary', icon: LayoutDashboard, pastel: 'bg-pastel-dashboard' },
  { value: 'timeline', label: 'Timeline', icon: List, pastel: 'bg-pastel-timeline' },
  { value: 'compare', label: 'Compare', icon: GitBranch, pastel: 'bg-pastel-compare-b' },
];

const emptyCopy = {
  title: 'No events captured yet',
  description:
    'Push some code to get started. BuildBerry captures context from your commits automatically.',
};

export default function DashboardPage() {
  const { events, eventsLoading, eventsError, refetchEvents, config, branches, selectedBranch } =
    useAppContext();
  const [tab, setTab] = useState<Tab>('summary');

  if (eventsLoading && events.length === 0) {
    return <LoadingCards count={4} />;
  }

  if (eventsError && events.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {eventsError.includes('401')
              ? 'Authentication failed. Check your token in Settings.'
              : eventsError}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={refetchEvents}>
          Retry
        </Button>
      </div>
    );
  }

  const hasEvents = events.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={selectedBranch === 'all' ? 'All branches' : selectedBranch}
        title="Project context"
        lede={
          hasEvents
            ? `${events.length} event${events.length === 1 ? '' : 's'} captured on this branch.`
            : 'Nothing captured on this branch yet.'
        }
      />

      {/* Always rendered, so Compare stays reachable even on an empty branch. */}
      <Segmented options={tabs} value={tab} onChange={setTab} aria-label="Dashboard view" />

      {tab === 'summary' &&
        (hasEvents ? (
          <ProjectSummary events={events} />
        ) : (
          <EmptyState
            icon={<GitCommitHorizontal className="h-7 w-7" />}
            title={emptyCopy.title}
            description={emptyCopy.description}
          />
        ))}

      {tab === 'timeline' &&
        (hasEvents ? (
          <Timeline events={events} />
        ) : (
          <EmptyState
            icon={<GitCommitHorizontal className="h-7 w-7" />}
            title={emptyCopy.title}
            description={emptyCopy.description}
          />
        ))}

      {tab === 'compare' && (
        <BranchCompare projectId={config.projectId} token={config.token} branches={branches} />
      )}
    </div>
  );
}
