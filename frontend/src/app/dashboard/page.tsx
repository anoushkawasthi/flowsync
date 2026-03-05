'use client';
//frontend changed
import { useState } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { Timeline } from '@/components/dashboard/Timeline';
import { ProjectSummary } from '@/components/dashboard/ProjectSummary';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingCards } from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GitBranch, GitCommitHorizontal, LayoutDashboard, List, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatContextSnapshot } from '@/lib/utils';
import { BranchCompare } from '@/components/dashboard/BranchCompare';

type Tab = 'summary' | 'timeline' | 'compare';

export default function DashboardPage() {
  const { events, eventsLoading, eventsError, refetchEvents, config, branches, selectedBranch } = useAppContext();
  const [tab, setTab] = useState<Tab>('summary');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const handleCopySnapshot = async () => {
    if (events.length === 0) return;

    try {
      const snapshot = formatContextSnapshot(events, selectedBranch);
      await navigator.clipboard.writeText(snapshot);

      // Show feedback
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy snapshot:', err);
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Tab switcher — always visible so Compare is reachable even when branch has no events */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab('summary')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === 'summary'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Summary
          </button>
          <button
            onClick={() => setTab('timeline')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === 'timeline'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <List className="h-3.5 w-3.5" />
            Timeline
          </button>
          <button
            onClick={() => setTab('compare')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === 'compare'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Compare
          </button>
        </div>

        {/* Copy snapshot button */}
        <div className="ml-auto">
          <Button
            variant={events.length === 0 ? 'ghost' : 'outline'}
            size="sm"
            onClick={handleCopySnapshot}
            disabled={events.length === 0}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium transition-all',
              copiedFeedback
                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                : 'text-zinc-300 hover:text-zinc-100'
            )}
            title="Copy context summary to clipboard"
          >
            {copiedFeedback ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Summary Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Summary
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'summary' && (
        events.length === 0 ? (
          <EmptyState
            icon={<GitCommitHorizontal className="h-8 w-8 text-zinc-500" />}
            title="No events captured yet"
            description="Push some code to get started. FlowSync will automatically capture context from your commits."
          />
        ) : (
          <ProjectSummary events={events} />
        )
      )}
      {tab === 'timeline' && (
        events.length === 0 ? (
          <EmptyState
            icon={<GitCommitHorizontal className="h-8 w-8 text-zinc-500" />}
            title="No events captured yet"
            description="Push some code to get started. FlowSync will automatically capture context from your commits."
          />
        ) : (
          <Timeline events={events} />
        )
      )}
      {tab === 'compare' && (
        <BranchCompare
          projectId={config.projectId}
          token={config.token}
          branches={branches}
        />
      )}
    </div>
  );
}
