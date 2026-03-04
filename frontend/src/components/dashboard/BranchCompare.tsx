'use client';

import { useEffect, useState, useMemo } from 'react';
import { GitBranch, Minus } from 'lucide-react';
import { getEvents } from '@/lib/api';
import { ContextCard } from './ContextCard';
import { LoadingCards } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ContextRecord } from '@/types';

interface BranchCompareProps {
  projectId: string;
  token: string;
  branches: string[];
}

type Classification = 'left-only' | 'right-only' | 'shared';

function normaliseFeature(f: string): string {
  return f.toLowerCase().trim().replace(/\s+/g, ' ');
}

function entitiesOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b.map((e) => e.toLowerCase()));
  const shared = a.filter((e) => setB.has(e.toLowerCase())).length;
  return shared / Math.min(a.length, b.length) > 0.5;
}

function classifyEvents(
  left: ContextRecord[],
  right: ContextRecord[]
): {
  left: { record: ContextRecord; label: Classification }[];
  right: { record: ContextRecord; label: Classification }[];
} {
  const rightFeatures = new Set(right.map((r) => normaliseFeature(r.feature)));
  const leftFeatures = new Set(left.map((l) => normaliseFeature(l.feature)));

  const labelledLeft = left.map((record) => {
    const norm = normaliseFeature(record.feature);
    if (rightFeatures.has(norm)) return { record, label: 'shared' as Classification };
    const entityMatch = right.some((r) => entitiesOverlap(record.entities, r.entities));
    return { record, label: (entityMatch ? 'shared' : 'left-only') as Classification };
  });

  const labelledRight = right.map((record) => {
    const norm = normaliseFeature(record.feature);
    if (leftFeatures.has(norm)) return { record, label: 'shared' as Classification };
    const entityMatch = left.some((l) => entitiesOverlap(record.entities, l.entities));
    return { record, label: (entityMatch ? 'shared' : 'right-only') as Classification };
  });

  return { left: labelledLeft, right: labelledRight };
}

function ClassifiedCard({
  record,
  label,
}: {
  record: ContextRecord;
  label: Classification;
}) {
  return (
    <div className="relative">
      {label === 'left-only' && (
        <div className="absolute inset-y-0 left-0 w-0.5 rounded-l-lg bg-blue-500 z-10" />
      )}
      {label === 'right-only' && (
        <div className="absolute inset-y-0 left-0 w-0.5 rounded-l-lg bg-purple-500 z-10" />
      )}
      <div className={label === 'shared' ? 'opacity-40' : undefined}>
        <ContextCard event={record} />
      </div>
      {label === 'shared' && (
        <div className="absolute top-3 right-3 rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400 z-10">
          Shared
        </div>
      )}
    </div>
  );
}

function BranchColumn({
  branch,
  branches,
  loading,
  classified,
  onBranchChange,
  accentColor,
  disabledBranches = [],
}: {
  branch: string;
  branches: string[];
  loading: boolean;
  classified: { record: ContextRecord; label: Classification }[];
  onBranchChange: (b: string) => void;
  accentColor: 'blue' | 'purple';
  disabledBranches?: string[];
}) {
  const uniqueCount = classified.filter((c) => c.label !== 'shared').length;
  const sharedCount = classified.filter((c) => c.label === 'shared').length;

  return (
    <div className="flex flex-col min-w-0 md:min-w-auto flex-1 w-full md:w-auto snap-center md:snap-align-none">
      <div
        className={`flex items-center gap-2 rounded-lg border p-2 mb-3 text-xs sm:text-sm ${
          accentColor === 'blue'
            ? 'border-blue-500/30 bg-blue-500/5'
            : 'border-purple-500/30 bg-purple-500/5'
        }`}
      >
        <GitBranch
          className={`h-3.5 w-3.5 shrink-0 ${
            accentColor === 'blue' ? 'text-blue-400' : 'text-purple-400'
          }`}
        />
        <select
          value={branch}
          onChange={(e) => onBranchChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-zinc-200 outline-none cursor-pointer truncate"
        >
          {branches.map((b) => (
            <option
              key={b}
              value={b}
              className="bg-zinc-900 text-zinc-200"
              disabled={disabledBranches.includes(b)}
            >
              {b}
            </option>
          ))}
        </select>
      </div>

      {!loading && classified.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3 text-[11px] sm:text-xs text-zinc-500">
          <span>
            <span
              className={`font-semibold ${
                accentColor === 'blue' ? 'text-blue-400' : 'text-purple-400'
              }`}
            >
              {uniqueCount}
            </span>{' '}
            unique
          </span>
          <span>
            <span className="font-semibold text-zinc-400">{sharedCount}</span> shared
          </span>
        </div>
      )}

      <div className="space-y-2 sm:space-y-3 overflow-y-auto max-h-[calc(100vh-22rem)] sm:max-h-[calc(100vh-18rem)] pr-1 sm:pr-2">
        {loading ? (
          <LoadingCards count={3} />
        ) : classified.length === 0 ? (
          <EmptyState
            icon={<Minus className="h-5 w-5 text-zinc-600" />}
            title="No context yet"
            description={`No pushes captured on "${branch}"`}
          />
        ) : (
          classified.map(({ record, label }) => (
            <ClassifiedCard key={record.eventId} record={record} label={label} />
          ))
        )}
      </div>
    </div>
  );
}

export function BranchCompare({ projectId, token, branches }: BranchCompareProps) {
  const defaultLeft = branches.includes('main') ? 'main' : (branches[0] ?? 'main');
  const defaultRight = branches.find((b) => b !== defaultLeft) ?? defaultLeft;

  const [leftBranch, setLeftBranch] = useState(defaultLeft);
  const [rightBranch, setRightBranch] = useState(defaultRight);
  const [leftEvents, setLeftEvents] = useState<ContextRecord[]>([]);
  const [rightEvents, setRightEvents] = useState<ContextRecord[]>([]);
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !token) return;
    setLeftLoading(true);
    getEvents(projectId, token, leftBranch)
      .then((res) => setLeftEvents(res.events))
      .catch(() => setLeftEvents([]))
      .finally(() => setLeftLoading(false));
  }, [projectId, token, leftBranch]);

  useEffect(() => {
    if (!projectId || !token) return;
    setRightLoading(true);
    getEvents(projectId, token, rightBranch)
      .then((res) => setRightEvents(res.events))
      .catch(() => setRightEvents([]))
      .finally(() => setRightLoading(false));
  }, [projectId, token, rightBranch]);

  // Sync defaults when branches list first populates
  useEffect(() => {
    if (branches.length === 0) return;
    const left = branches.includes('main') ? 'main' : branches[0];
    const right = branches.find((b) => b !== left) ?? left;
    setLeftBranch(left);
    setRightBranch(right);
  }, [branches.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const classified = useMemo(
    () => classifyEvents(leftEvents, rightEvents),
    [leftEvents, rightEvents]
  );

  const totalLeft = classified.left.filter((c) => c.label === 'left-only').length;
  const totalRight = classified.right.filter((c) => c.label === 'right-only').length;
  const totalShared = classified.left.filter((c) => c.label === 'shared').length;
  const hasBothLoaded =
    !leftLoading && !rightLoading && (leftEvents.length > 0 || rightEvents.length > 0);

  return (
    <div className="space-y-4">
      {hasBothLoaded && (
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm">
          <span className="text-zinc-500">Comparison:</span>
          <span className="flex flex-wrap gap-1 sm:gap-0">
            <span className="font-semibold text-blue-400">{totalLeft}</span>
            <span className="text-zinc-400 ml-1 mr-1">unique to</span>
            <span className="font-medium text-zinc-300">{leftBranch}</span>
          </span>
          <span className="flex flex-wrap gap-1 sm:gap-0">
            <span className="font-semibold text-purple-400">{totalRight}</span>
            <span className="text-zinc-400 ml-1 mr-1">unique to</span>
            <span className="font-medium text-zinc-300">{rightBranch}</span>
          </span>
          <span className="flex flex-wrap gap-1 sm:gap-0">
            <span className="font-semibold text-zinc-400">{totalShared}</span>
            <span className="text-zinc-400 ml-1">shared</span>
          </span>
        </div>
      )}

      {/* Mobile: Horizontal scroll, Desktop: 2-column grid */}
      <div className="flex md:grid md:grid-cols-2 gap-3 md:gap-4 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory md:snap-none">
        <div className="md:contents">
          <BranchColumn
            branch={leftBranch}
            branches={branches}
            loading={leftLoading}
            classified={classified.left}
            onBranchChange={setLeftBranch}
            accentColor="blue"
            disabledBranches={[rightBranch]}
          />
        </div>
        <div className="md:contents">
          <BranchColumn
            branch={rightBranch}
            branches={branches}
            loading={rightLoading}
            classified={classified.right}
            onBranchChange={setRightBranch}
            accentColor="purple"
            disabledBranches={[leftBranch]}
          />
        </div>
      </div>
    </div>
  );
}
