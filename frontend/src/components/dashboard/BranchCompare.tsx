'use client';

import { useEffect, useState, useMemo } from 'react';
import { GitBranch, Minus } from 'lucide-react';
import { getEvents } from '@/lib/api';
import { ContextCard } from './ContextCard';
import { LoadingCards } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ContextRecord } from '@/types';

interface BranchCompareProps {
  projectId: string;
  token: string;
  branches: string[];
}

type Classification = 'left-only' | 'right-only' | 'shared';
type Side = 'a' | 'b';

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

const sideFill: Record<Side, string> = {
  a: 'bg-pastel-compare-a',
  b: 'bg-pastel-compare-b',
};

/**
 * Shared events used to be dimmed to `opacity-40`, which reads as disabled
 * rather than as "present on both sides". They now keep full contrast and are
 * marked with a badge instead, so the eye can still scan them.
 */
function ClassifiedCard({
  record,
  label,
  side,
}: {
  record: ContextRecord;
  label: Classification;
  side: Side;
}) {
  const isShared = label === 'shared';
  return (
    <div className="relative">
      {isShared && (
        <span className="neo neo-thin absolute -top-2 right-3 z-10 rounded-chip bg-pastel-neutral px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-on-pastel">
          Shared
        </span>
      )}
      {!isShared && (
        <span
          aria-hidden
          className={cn(
            'neo absolute -left-1.5 top-6 z-10 h-4 w-4 rounded-[3px]',
            sideFill[side]
          )}
        />
      )}
      <ContextCard event={record} />
    </div>
  );
}

function BranchColumn({
  branch,
  branches,
  loading,
  classified,
  onBranchChange,
  side,
  disabledBranches = [],
}: {
  branch: string;
  branches: string[];
  loading: boolean;
  classified: { record: ContextRecord; label: Classification }[];
  onBranchChange: (b: string) => void;
  side: Side;
  disabledBranches?: string[];
}) {
  const uniqueCount = classified.filter((c) => c.label !== 'shared').length;
  const sharedCount = classified.filter((c) => c.label === 'shared').length;

  return (
    <div className="neo flex min-w-0 flex-1 flex-col rounded-card bg-surface shadow-neo-2">
      <header
        className={cn(
          'flex items-center gap-2 rounded-t-[calc(var(--r-card)-2px)] border-b-bw border-line p-3',
          sideFill[side]
        )}
      >
        <GitBranch className="h-4 w-4 shrink-0 text-on-pastel" />
        <Select value={branch} onValueChange={onBranchChange}>
          <SelectTrigger className="h-9 min-w-0 flex-1 bg-surface">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b} value={b} disabled={disabledBranches.includes(b)}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {!loading && classified.length > 0 && (
        <div className="flex gap-4 border-b-thin border-line px-3 py-2">
          <span className="neo-label-sm text-ink-muted">
            <span className="text-sm font-extrabold tabular-nums text-ink">{uniqueCount}</span>{' '}
            unique
          </span>
          <span className="neo-label-sm text-ink-muted">
            <span className="text-sm font-extrabold tabular-nums text-ink">{sharedCount}</span>{' '}
            shared
          </span>
        </div>
      )}

      {/* No nested scroller. This used to be capped with
          `max-h-[calc(100vh-24rem)] overflow-y-auto`, which trapped a thousand
          pixels of cards inside a 236px box — you'd scroll the page to its end
          and the column would still be cut off. The page is the only scroll
          container now. */}
      <div className="space-y-4 p-3">
        {loading ? (
          <LoadingCards count={2} />
        ) : classified.length === 0 ? (
          <EmptyState
            icon={<Minus className="h-6 w-6" />}
            title="No context yet"
            description={`No pushes captured on "${branch}".`}
          />
        ) : (
          classified.map(({ record, label }) => (
            <ClassifiedCard key={record.eventId} record={record} label={label} side={side} />
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

  // Sync defaults when the branches list first populates
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
        <div className="neo flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card bg-surface px-4 py-3 shadow-neo-1">
          <span className="neo-label">Comparison</span>
          <Tally count={totalLeft} swatch={sideFill.a} label={`unique to ${leftBranch}`} />
          <Tally count={totalRight} swatch={sideFill.b} label={`unique to ${rightBranch}`} />
          <Tally count={totalShared} swatch="bg-pastel-neutral" label="shared" />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <BranchColumn
          branch={leftBranch}
          branches={branches}
          loading={leftLoading}
          classified={classified.left}
          onBranchChange={setLeftBranch}
          side="a"
          disabledBranches={[rightBranch]}
        />
        <BranchColumn
          branch={rightBranch}
          branches={branches}
          loading={rightLoading}
          classified={classified.right}
          onBranchChange={setRightBranch}
          side="b"
          disabledBranches={[leftBranch]}
        />
      </div>
    </div>
  );
}

function Tally({ count, swatch, label }: { count: number; swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-sm text-ink-muted">
      <span aria-hidden className={cn('neo neo-thin h-3 w-3 rounded-[3px]', swatch)} />
      <span className="font-extrabold tabular-nums text-ink">{count}</span>
      {label}
    </span>
  );
}
