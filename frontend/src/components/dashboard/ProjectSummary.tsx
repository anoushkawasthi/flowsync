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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

    // Recent decisions (last 5 non-null)
    // Recent decisions (deduplicated by text, last 5 unique)
    const seenDecisions = new Set<string>();
    const decisions: { decision: string; feature: string; extractedAt: string; commitHash: string }[] = [];
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
        risks.push({
          risk: e.risk,
          feature: e.feature,
          extractedAt: e.extractedAt,
        });
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

    // Average confidence + simple trend (first half vs second half)
    // Backend returns 0-1 decimal, convert to 0-100 percentage
    const avgConfidence =
      events.length > 0
        ? Math.round((events.reduce((s, e) => s + e.confidence, 0) / events.length) * 100)
        : 0;

    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (events.length >= 4) {
      const mid = Math.floor(events.length / 2);
      // events are newest-first, so "recent" = first half
      const recentAvg =
        events.slice(0, mid).reduce((s, e) => s + e.confidence, 0) / mid;
      const olderAvg =
        events.slice(mid).reduce((s, e) => s + e.confidence, 0) /
        (events.length - mid);
      // confidence is 0-1 decimal, so 0.03 = 3 percentage points
      if (recentAvg - olderAvg > 0.03) trend = 'up';
      else if (olderAvg - recentAvg > 0.03) trend = 'down';
    }

    return { currentStage, authors, decisions, risks, tasks, avgConfidence, trend };
  }, [events]);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProjectSummary({ events }: ProjectSummaryProps) {
  const { currentStage, authors, decisions, risks, tasks, avgConfidence, trend } =
    useSummary(events);

  return (
    <div className="space-y-4">
      {/* ---- Top stat cards ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Current stage */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <Activity className="h-3.5 w-3.5" />
              Project Stage
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <StageBadge stage={currentStage} />
          </CardContent>
        </Card>

        {/* Active authors */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <Users className="h-3.5 w-3.5" />
              Active Authors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-2xl font-bold text-zinc-100">{authors.length}</span>
          </CardContent>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-2xl font-bold text-zinc-100">{events.length}</span>
          </CardContent>
        </Card>

        {/* Avg confidence + trend */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
              {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
              {trend === 'flat' && <Activity className="h-3.5 w-3.5" />}
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1.5">
            <span className="text-2xl font-bold text-zinc-100">{avgConfidence}%</span>
            <Progress value={avgConfidence} className="h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* ---- Authors row ---- */}
      {authors.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-200">Authors</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-3">
              {authors.map(({ name, lastSeen }) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-1.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-bold uppercase text-zinc-300">
                    {name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-200">{name}</span>
                    <span className="text-[11px] text-zinc-500">
                      {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Two-column: Decisions + Risks ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent decisions */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Lightbulb className="h-4 w-4 text-teal-400" />
              Recent Decisions
              {decisions.length > 0 && (
                <span className="ml-auto text-xs font-normal text-zinc-500">
                  {decisions.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {decisions.length === 0 ? (
              <p className="text-sm text-zinc-500">No decisions recorded yet.</p>
            ) : (
              decisions.map((d, i) => (
                <div
                  key={i}
                  className="rounded-md border border-teal-500/20 bg-teal-500/10 p-3 space-y-1"
                >
                  <p className="text-sm text-teal-300">{d.decision}</p>
                  <p className="text-[11px] text-teal-500/70">
                    {d.feature} &middot;{' '}
                    {formatDistanceToNow(new Date(d.extractedAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Active risks */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              Active Risks
              {risks.length > 0 && (
                <span className="ml-auto text-xs font-normal text-zinc-500">
                  {risks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {risks.length === 0 ? (
              <p className="text-sm text-zinc-500">No risks identified — looking good!</p>
            ) : (
              risks.map((r, i) => (
                <div
                  key={i}
                  className="rounded-md border border-orange-500/20 bg-orange-500/10 p-3 space-y-1"
                >
                  <p className="text-sm text-orange-300">{r.risk}</p>
                  <p className="text-[11px] text-orange-500/70">
                    {r.feature} &middot;{' '}
                    {formatDistanceToNow(new Date(r.extractedAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Pending tasks ---- */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <CheckCircle2 className="h-4 w-4 text-zinc-400" />
              Pending Tasks
              <span className="ml-auto text-xs font-normal text-zinc-500">{tasks.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {tasks.map((task, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-zinc-300"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                  {task}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
