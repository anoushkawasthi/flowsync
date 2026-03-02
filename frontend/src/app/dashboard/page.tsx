'use client';

import { useAppContext } from '@/hooks/useAppContext';
import { Timeline } from '@/components/dashboard/Timeline';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingCards } from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GitCommitHorizontal } from 'lucide-react';

export default function DashboardPage() {
  const { events, eventsLoading, eventsError, refetchEvents } = useAppContext();

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

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<GitCommitHorizontal className="h-8 w-8 text-zinc-500" />}
        title="No events captured yet"
        description="Push some code to get started. FlowSync will automatically capture context from your commits."
      />
    );
  }

  return <Timeline events={events} />;
}
