'use client';

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Users,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { StatSlab } from '@/components/shared/StatSlab';
import { StageBadge } from './StageBadge';
import type { ContextRecord } from '@/types';

interface ProjectSummaryProps {
  events: ContextRecord[];
}

/* ------------------------------------------------------------------ */
/*  Helper: derive all summary data from the events array             */
/* ------------------------------------------------------------------ */

function useSummary(events: ContextRecord[]) {
  return useMemo(() => {
    const currentStage = events[0]?.stage ?? 'Setup';

    // Active authors (unique), sorted by most-recent activity
    const authorMap = new Map<string, string>(); // author → latest extractedAt
    for (const e of events) {
      const existing = authorMap.get(e.author);
      if (!existing || e.extractedAt > existing) {
        authorMap.set(e.author, e.extractedAt);
      }
    }
    const authors = Array.from(authorMap.entries())
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([name, lastSeen]) => ({ name, lastSeen }));

    // Recent decisions (deduplicated by text, last 5 unique)
    const seenDecisions = new Set<string>();
    const decisions: {
      decision: string;
      feature: string;
      extractedAt: string;
      commitHash: string;
    }[] = [];
    for (const e of events) {
      if (e.decision !== null && !seenDecisions.has(e.decision)) {
        seenDecisions.add(e.decision);
        decisions.push({
          decision: e.decision,
          feature: e.feature,
          extractedAt: e.extractedAt,
          commitHash: e.commitHash,
        });
        if (decisions.length >= 5) break;
      }
    }

    // Active risks (deduplicated by text)
    const seenRisks = new Set<string>();
    const risks: { risk: string; feature: string; extractedAt: string }[] = [];
    for (const e of events) {
      if (e.risk !== null && !seenRisks.has(e.risk)) {
        seenRisks.add(e.risk);
        risks.push({ risk: e.risk, feature: e.feature, extractedAt: e.extractedAt });
      }
    }

    // Pending tasks (deduplicated, preserve order)
    const taskSet = new Set<string>();
    const tasks: string[] = [];
    for (const e of events) {
      for (const t of e.tasks) {
        if (!taskSet.has(t)) {
          taskSet.add(t);
          tasks.push(t);
        }
      }
    }

    // Average confidence + simple trend (first half vs second half).
    // Backend returns 0-1 decimal, convert to 0-100 percentage.
    const avgConfidence =
      events.length > 0
        ? Math.round((events.reduce((s, e) => s + e.confidence, 0) / events.length) * 100)
        : 0;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (events.length >= 4) {
      const mid = Math.floor(events.length / 2);
      // events are newest-first, so "recent" = first half
      const recentAvg = events.slice(0, mid).reduce((s, e) => s + e.confidence, 0) / mid;
      const olderAvg =
        events.slice(mid).reduce((s, e) => s + e.confidence, 0) / (events.length - mid);
      // confidence is 0-1 decimal, so 0.03 = 3 percentage points
      if (recentAvg - olderAvg > 0.03) trend = 'up';
      else if (olderAvg - recentAvg > 0.03) trend = 'down';
    }

    return { currentStage, authors, decisions, risks, tasks, avgConfidence, trend };
  }, [events]);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** A decision or a risk. Both are bordered slabs on the section's pastel. */
function NoteSlab({
  text,
  meta,
  tone,
}: {
  text: string;
  meta: string;
  tone: 'decision' | 'risk';
}) {
  return (
    <li
      className={cn(
        'neo neo-thin rounded-chip p-3',
        tone === 'decision' ? 'bg-pastel-dashboard' : 'bg-pastel-risk'
      )}
    >
      <p className="text-sm font-medium text-on-pastel">{text}</p>
      <p className="mt-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-on-pastel opacity-60">
        {meta}
      </p>
    </li>
  );
}

function SectionSlab({
  title,
  icon,
  count,
  empty,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  empty?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('neo flex flex-col rounded-card bg-surface shadow-neo-2', className)}>
      <header className="flex items-center gap-2 border-b-bw border-line px-4 py-3">
        {icon}
        <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-ink">{title}</h3>
        {count !== undefined && count > 0 && (
          <span className="ml-auto text-sm font-extrabold tabular-nums text-ink-subtle">
            {count}
          </span>
        )}
      </header>
      <div className="p-4">
        {children ?? <p className="text-sm text-ink-muted">{empty}</p>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProjectSummary({ events }: ProjectSummaryProps) {
  const { currentStage, authors, decisions, risks, tasks, avgConfidence, trend } =
    useSummary(events);

  return (
    <div className="space-y-4">
      {/* An even four-up KPI row. Hierarchy comes from the first slab being
          pastel-filled and one type step larger, not from spanning extra
          columns — uneven spans left a ragged trailing slab and stretched the
          confidence bar to the full width of the page. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatSlab
          label="Events captured"
          value={events.length}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="dashboard"
          hero
        />

        <StatSlab label="Project stage" icon={<Activity className="h-4 w-4" />}>
          <StageBadge stage={currentStage} />
        </StatSlab>

        <StatSlab
          label="Active authors"
          value={authors.length}
          icon={<Users className="h-4 w-4" />}
        />

        <StatSlab
          label="Avg confidence"
          value={`${avgConfidence}%`}
          icon={
            trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Activity className="h-4 w-4" />
            )
          }
        >
          <Progress value={avgConfidence} className="h-1.5" />
        </StatSlab>
      </div>

      {/* Authors as a chip rail with square avatars. */}
      {authors.length > 0 && (
        <SectionSlab title="Authors" icon={<Users className="h-4 w-4 text-ink-subtle" />}>
          <ul className="flex flex-wrap gap-2">
            {authors.map(({ name, lastSeen }) => (
              <li
                key={name}
                className="neo neo-thin flex items-center gap-2 rounded-chip bg-canvas px-2.5 py-1.5"
              >
                <span className="neo neo-thin grid h-6 w-6 place-items-center rounded-[4px] bg-accent text-[0.6875rem] font-extrabold uppercase text-accent-ink">
                  {name.charAt(0)}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-bold text-ink">{name}</span>
                  <span className="text-[0.6875rem] text-ink-subtle">
                    {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </SectionSlab>
      )}

      {/* Decisions get twice the width of risks — there are usually more of them
          and they run longer. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionSlab
          title="Recent decisions"
          icon={<Lightbulb className="h-4 w-4 text-ink-subtle" />}
          count={decisions.length}
          className="lg:col-span-2"
        >
          {decisions.length === 0 ? (
            <p className="text-sm text-ink-muted">No decisions recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {decisions.map((d, i) => (
                <NoteSlab
                  key={i}
                  tone="decision"
                  text={d.decision}
                  meta={`${d.feature} · ${formatDistanceToNow(new Date(d.extractedAt), {
                    addSuffix: true,
                  })}`}
                />
              ))}
            </ul>
          )}
        </SectionSlab>

        <SectionSlab
          title="Active risks"
          icon={<AlertTriangle className="h-4 w-4 text-ink-subtle" />}
          count={risks.length}
        >
          {risks.length === 0 ? (
            <p className="text-sm text-ink-muted">No risks identified.</p>
          ) : (
            <ul className="space-y-2">
              {risks.map((r, i) => (
                <NoteSlab
                  key={i}
                  tone="risk"
                  text={r.risk}
                  meta={`${r.feature} · ${formatDistanceToNow(new Date(r.extractedAt), {
                    addSuffix: true,
                  })}`}
                />
              ))}
            </ul>
          )}
        </SectionSlab>
      </div>

      {tasks.length > 0 && (
        <SectionSlab
          title="Pending tasks"
          icon={<CheckCircle2 className="h-4 w-4 text-ink-subtle" />}
          count={tasks.length}
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {tasks.map((task, i) => (
              <li key={i} className="neo-bullet text-sm text-ink-muted">
                {task}
              </li>
            ))}
          </ul>
        </SectionSlab>
      )}
    </div>
  );
}
